import { createHash } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { Prisma } from '@prisma/client';
import {
  clientPhaseFromPlans,
  expectedStatDate,
  formatCnDate,
  normalizeName,
  parseWatermarkFilename,
  shanghaiToday,
} from '@shortform/shared';
import { z } from 'zod';
import { assertCompanyAccess, assertFound } from '../core/access';
import { hidesCommercialTerms, stripCommercialKeys } from '../core/viewer-dto';
import { AuditService } from '../core/audit.service';
import { assertBusinessWrite, assertRole, AuthUser, day, nextCode } from '../core/auth';
import { moneyDecimal } from '../core/money';
import { PrismaService } from '../core/prisma.service';
import { unzip, zipStore } from '../core/zip';
import { StorageService } from '../core/storage.service';
import { shanghaiStamp, stampImage } from './watermark';
import { dailyListSchema, dailyStatSchema, ticketMessageSchema, watermarkAssignSchema, watermarkCreateSchema } from '@shortform/shared';

@Injectable()
export class MetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async expectations() {
    const platforms = await this.prisma.platform.findMany({ where: { enabled: true }, orderBy: { sort: 'asc' } });
    const today = shanghaiToday();
    return platforms.map((platform) => ({
      id: platform.id,
      name: platform.name,
      syncLag: platform.syncLag,
      syncMode: platform.syncMode,
      expectedStatDate: expectedStatDate(platform.syncLag),
      asOfLabel: `数据日期应为 ${expectedStatDate(platform.syncLag)}（${platform.syncLag === 'T2' ? '前天' : '昨天'}）`,
      today,
    }));
  }

  async listDaily(user: AuthUser, query: z.infer<typeof dailyListSchema>) {
    const where = await this.dailyWhere(user, query);
    const [items, total] = await Promise.all([
      this.prisma.dailyStat.findMany({
        where,
        include: { platform: { select: { id: true, name: true, syncLag: true } }, drama: { select: { id: true, code: true, title: true } } },
        orderBy: [{ statDate: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.dailyStat.count({ where }),
    ]);
    return {
      items: hidesCommercialTerms(user.role) ? items.map((item) => stripCommercialKeys(item as unknown as Record<string, unknown>)) : items,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async saveDaily(user: AuthUser, input: z.infer<typeof dailyStatSchema>) {
    assertBusinessWrite(user);
    assertRole(user, ['OPS', 'OPS_MANAGER', 'BD']);
    const drama = assertFound(await this.prisma.drama.findUnique({ where: { id: input.dramaId }, include: { company: true } }), '剧目不存在');
    if (user.role === 'OPS' || user.role === 'BD') assertCompanyAccess(user, drama.company);
    const platform = assertFound(await this.prisma.platform.findUnique({ where: { id: input.platformId } }), '平台不存在');
    const expected = expectedStatDate(platform.syncLag);
    const lagWarning = input.statDate === expected ? null : `平台口径是 ${platform.syncLag}，期望录入 ${expected} 的数据`;
    let evidenceSha256 = '';
    if (input.watermarkId) {
      const shot = assertFound(await this.prisma.watermarkShot.findUnique({ where: { id: input.watermarkId } }), '截图不存在');
      evidenceSha256 = shot.sha256;
    }
    const recordId = `${platform.code}:${input.statDate}:${drama.code}:${input.language}`;
    const data = {
      recordId,
      companyId: drama.companyId,
      platformId: platform.id,
      dramaId: drama.id,
      statDate: day(input.statDate),
      statTimezone: input.statTimezone,
      contractCode: input.contractCode ?? '',
      platformDramaId: input.platformDramaId ?? '',
      titleLocal: input.titleLocal,
      language: input.language,
      territory: input.territory ?? '',
      episodesOnline: input.episodesOnline,
      views: input.views,
      viewMetricDef: input.viewMetricDef,
      uniqueViewers: input.uniqueViewers,
      paidUnlocks: input.paidUnlocks,
      grossRevenue: input.grossRevenue ? moneyDecimal(input.grossRevenue) : null,
      netRevenue: input.netRevenue ? moneyDecimal(input.netRevenue) : null,
      currency: input.currency.toUpperCase(),
      shareRate: input.shareRate ? new Prisma.Decimal(input.shareRate) : null,
      mgAmount: input.mgAmount ? moneyDecimal(input.mgAmount) : null,
      mgRecouped: input.mgRecouped ? moneyDecimal(input.mgRecouped) : null,
      revenueShareDue: input.revenueShareDue ? moneyDecimal(input.revenueShareDue) : null,
      dealType: input.dealType,
      dataSource: input.dataSource,
      evidenceFiles: input.evidenceFiles ?? '',
      evidenceSha256,
      watermarkId: input.watermarkId,
      anomalyNote: input.anomalyNote || (input.views === 0 && input.netRevenue && Number(input.netRevenue) > 0 ? '收入大于 0 但播放为 0' : ''),
      lagWarning,
      status: 'DRAFT' as const,
      enteredById: user.id,
    };
    const existing = await this.prisma.dailyStat.findUnique({ where: { platformId_statDate_dramaId_language: { platformId: platform.id, statDate: day(input.statDate), dramaId: drama.id, language: input.language } } });
    if (existing?.status === 'LOCKED') throw new BadRequestException('这条数据已锁定，不能修改');
    const saved = existing
      ? await this.prisma.dailyStat.update({
          where: { id: existing.id },
          data: { ...data, enteredById: user.id, version: { increment: 1 }, reviewedById: null, reviewedAt: null, lockedAt: null },
        })
      : await this.prisma.dailyStat.create({ data });
    await this.audit.write(user.id, existing ? 'daily.update' : 'daily.create', 'DailyStat', saved.id, { recordId, before: existing?.views, after: input.views });
    return saved;
  }

  async reportDaily(user: AuthUser, id: string, note: string) {
    assertBusinessWrite(user);
    assertRole(user, ['OPS_MANAGER'], '问题行上报由运营主管处理');
    const row = assertFound(await this.prisma.dailyStat.findUnique({ where: { id } }), '日报不存在');
    if (row.status === 'LOCKED') throw new BadRequestException('已锁定的数据不能上报');
    const text = note.trim();
    if (!text) throw new BadRequestException('请填写问题说明');
    const updated = await this.prisma.dailyStat.update({
      where: { id },
      data: { status: 'ANOMALY', anomalyNote: text },
    });
    await this.audit.write(user.id, 'daily.report', 'DailyStat', id, { note: text });
    return updated;
  }

  async forcePublish(user: AuthUser, id: string, reason: string) {
    assertBusinessWrite(user);
    assertRole(user, ['OPS_MANAGER'], '强制发布由运营主管处理');
    const row = assertFound(await this.prisma.dailyStat.findUnique({ where: { id } }), '日报不存在');
    if (row.status === 'LOCKED') throw new BadRequestException('已锁定的数据不能强制发布');
    const updated = await this.prisma.dailyStat.update({
      where: { id },
      data: { status: 'REVIEWED', reviewedById: user.id, reviewedAt: new Date(), anomalyNote: reason },
    });
    await this.audit.write(user.id, 'daily.force_publish', 'DailyStat', id, { reason, from: row.status });
    return updated;
  }

  async reviewDaily(user: AuthUser, id: string) {
    assertBusinessWrite(user);
    assertRole(user, ['OPS', 'OPS_MANAGER', 'FINANCE']);
    const row = assertFound(await this.prisma.dailyStat.findUnique({ where: { id }, include: { company: true } }));
    if (user.role === 'OPS') assertCompanyAccess(user, row.company);
    if (row.enteredById === user.id) throw new ForbiddenException('不能复核自己录入的数据');
    if (!row.evidenceSha256) throw new BadRequestException('请先关联带哈希的防伪截图，再复核');
    if (row.status === 'LOCKED') throw new BadRequestException('已锁定');
    const reviewed = await this.prisma.dailyStat.updateMany({
      where: { id, status: { in: ['DRAFT', 'REVIEWED', 'ANOMALY'] }, NOT: { enteredById: user.id } },
      data: { status: 'REVIEWED', reviewedById: user.id, reviewedAt: new Date() },
    });
    if (reviewed.count !== 1) throw new ConflictException('日报已被修改，请刷新后再复核');
    return this.prisma.dailyStat.findUnique({ where: { id } });
  }

  async lockDaily(user: AuthUser, id: string) {
    assertBusinessWrite(user);
    assertRole(user, ['FINANCE']);
    const row = assertFound(await this.prisma.dailyStat.findUnique({ where: { id } }));
    if (row.status !== 'REVIEWED') throw new BadRequestException('复核通过后才能锁定');
    if (row.enteredById === user.id) throw new ForbiddenException('录入人不能锁定');
    const locked = await this.prisma.dailyStat.updateMany({
      where: { id, status: 'REVIEWED', NOT: { enteredById: user.id } },
      data: { status: 'LOCKED', lockedAt: new Date() },
    });
    if (locked.count !== 1) throw new ConflictException('日报已被修改，请刷新后再锁定');
    return this.prisma.dailyStat.findUnique({ where: { id } });
  }

  async createWatermark(user: AuthUser, input: z.infer<typeof watermarkCreateSchema>) {
    assertBusinessWrite(user);
    assertRole(user, ['OPS', 'OPS_MANAGER', 'BD']);
    let original: Buffer;
    try {
      original = await this.storage.getObject(input.fileKey);
    } catch {
      throw new BadRequestException('原始截图还没有上传完成');
    }
    const shot = await this.persistWatermark(user, original, input);
    const url = shot.watermarkedKey ? await this.storage.presignGet(shot.watermarkedKey) : null;
    return { ...shot, url };
  }

  async uploadEvidenceZip(user: AuthUser, zip: Buffer) {
    assertBusinessWrite(user);
    assertRole(user, ['OPS', 'OPS_MANAGER', 'BD']);
    let entries;
    try {
      entries = unzip(zip);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      throw new BadRequestException(message === '不支持超大压缩包' || message === '不是有效的 zip' ? message : '不是有效的 zip');
    }
    if (!entries.length) throw new BadRequestException('压缩包里没有文件');
    const batchNo = await this.prisma.$transaction((tx) => nextCode(tx, 'PC', 5));
    const items: { filename: string; ok: boolean; result: 'archived' | 'pending' | 'failed'; status?: string; id?: string; ticketCode?: string; batchNo?: string; error?: string }[] = [];
    for (const entry of entries) {
      if (entry.error || !entry.data) {
        items.push({ filename: entry.name, ok: false, result: 'failed', error: entry.error || '这张图解压失败' });
        continue;
      }
      if (!/\.(png|jpe?g|webp)$/i.test(entry.name)) {
        items.push({ filename: entry.name, ok: false, result: 'failed', error: '只接受 png、jpg、webp' });
        continue;
      }
      try {
        const shot = await this.persistWatermark(user, entry.data, {
          filename: entry.name,
          storeOriginal: true,
          poolUnassigned: true,
          batchNo,
        });
        const pending = shot.status !== 'ARCHIVED';
        items.push({
          filename: entry.name,
          ok: true,
          result: pending ? 'pending' : 'archived',
          status: shot.status,
          id: shot.id,
          ticketCode: shot.ticketCode || undefined,
          batchNo: shot.batchNo || undefined,
        });
      } catch (err) {
        const error = err instanceof HttpException ? err.message : '这张图无法加水印，请上传 png 或 jpg';
        items.push({ filename: entry.name, ok: false, result: 'failed', error });
      }
    }
    const archived = items.filter((item) => item.result === 'archived').length;
    const pending = items.filter((item) => item.result === 'pending').length;
    const failed = items.filter((item) => item.result === 'failed').length;
    const succeeded = archived + pending;
    await this.audit.write(user.id, 'evidence.upload', 'WatermarkShot', items.find((item) => item.id)?.id || batchNo, { batchNo, succeeded, archived, pending, failed });
    return { batchNo, succeeded, archived, pending, failed, items };
  }

  private async persistWatermark(
    user: AuthUser,
    original: Buffer,
    input: {
      fileKey?: string;
      filename?: string;
      dramaId?: string;
      platformId?: string;
      shotDate?: string | null;
      kind?: 'LISTING' | 'DATA' | 'DELIST';
      storeOriginal?: boolean;
      poolUnassigned?: boolean;
      batchNo?: string;
    },
  ) {
    await this.assertImage(original);
    const originalSha = createHash('sha256').update(original).digest('hex');
    const parsed = input.filename ? parseWatermarkFilename(input.filename) : null;
    let drama = input.dramaId ? await this.prisma.drama.findUnique({ where: { id: input.dramaId }, include: { company: true } }) : null;
    let platform = input.platformId ? await this.prisma.platform.findUnique({ where: { id: input.platformId } }) : null;
    let shotDate = input.shotDate ?? null;
    let fail: string | null = null;
    if (!drama && parsed?.dramaToken) {
      drama = await this.prisma.drama.findFirst({
        where: { OR: [{ code: parsed.dramaToken }, { nameNorm: normalizeName(parsed.dramaToken) }, { title: parsed.dramaToken }] },
        include: { company: true },
      });
      if (!drama) fail = '文件名没有匹配到唯一剧目';
    }
    if (!platform && parsed?.platformCode) {
      platform = await this.prisma.platform.findFirst({ where: { OR: [{ code: parsed.platformCode }, { name: parsed.platformCode }] } });
      if (!platform) fail = fail || '文件名里的平台无法识别';
    }
    if (!shotDate && parsed?.date) shotDate = parsed.date;
    if (drama && (user.role === 'OPS' || user.role === 'BD')) assertCompanyAccess(user, drama.company);
    if (!drama || !platform || !shotDate) fail = fail || '缺少剧目、平台或日期，进入待归档';
    const storageRoot = drama?.companyId || (input.poolUnassigned && input.batchNo ? `pending/${input.batchNo}` : input.fileKey?.split('/')[0]);
    if (!storageRoot) throw new BadRequestException('没有匹配到剧目，也没有可归属的客户');
    const matched = !fail && drama && platform && shotDate ? { drama, platform, shotDate } : null;
    const ticket = matched
      ? await this.ensureTicket(matched.drama.companyId, matched.drama.id, matched.drama.title, matched.platform.name, matched.shotDate, user.id)
      : null;
    const stamped = await this.stampShot(original, originalSha, platform?.name || parsed?.platformCode || '平台', drama?.title || parsed?.dramaToken || '剧目', user.name, ticket?.code || '');
    const sha256 = createHash('sha256').update(stamped.bytes).digest('hex');
    const key = `${storageRoot}/watermark/${sha256.slice(0, 16)}.png`;
    await this.storage.putObject(key, stamped.bytes, 'image/png');
    let originalKey = input.fileKey || '';
    if (input.storeOriginal) {
      const lower = (input.filename || '').toLowerCase();
      const ext = lower.endsWith('.webp') ? '.webp' : lower.endsWith('.png') ? '.png' : '.jpg';
      const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      originalKey = `${storageRoot}/watermark-src/${originalSha.slice(0, 16)}${ext}`;
      await this.storage.putObject(originalKey, original, contentType);
    }
    const shot = await this.prisma.watermarkShot.create({
      data: {
        companyId: drama?.companyId,
        dramaId: drama?.id,
        platformId: platform?.id,
        shotDate: shotDate ? day(shotDate) : null,
        kind: input.kind || parsed?.kind || 'DATA',
        originalKey,
        watermarkedKey: key,
        sha256,
        shortHash: sha256.slice(0, 12),
        filename: input.filename || '',
        status: fail ? 'PENDING_MATCH' : 'ARCHIVED',
        failReason: fail,
        operatorId: user.id,
        batchNo: input.batchNo || '',
        ticketId: ticket?.id,
        ticketCode: ticket?.code || '',
      },
    });
    await this.audit.write(user.id, 'watermark.create', 'WatermarkShot', shot.id, { sha256, ticketCode: shot.ticketCode });
    return shot;
  }

  private async assertImage(original: Buffer) {
    try {
      const meta = await sharp(original).metadata();
      if (!meta.width || !meta.format || !['png', 'jpeg', 'webp'].includes(meta.format)) throw new BadRequestException('不是有效的图片');
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('不是有效的图片');
    }
  }

  async assignWatermark(user: AuthUser, id: string, input: z.infer<typeof watermarkAssignSchema>) {
    assertBusinessWrite(user);
    assertRole(user, ['OPS', 'OPS_MANAGER', 'BD']);
    const shot = assertFound(await this.prisma.watermarkShot.findUnique({ where: { id } }));
    const drama = assertFound(await this.prisma.drama.findUnique({ where: { id: input.dramaId }, include: { company: true } }));
    const platform = assertFound(await this.prisma.platform.findUnique({ where: { id: input.platformId } }));
    if (user.role === 'OPS' || user.role === 'BD') assertCompanyAccess(user, drama.company);
    const ticketCode = input.ticketCode?.trim();
    const ticket = ticketCode
      ? await this.useTicket(ticketCode, drama.companyId, drama.id, drama.title, platform.name)
      : await this.ensureTicket(drama.companyId, drama.id, drama.title, platform.name, input.shotDate, user.id);
    const data: Prisma.WatermarkShotUpdateInput = {
      company: { connect: { id: drama.companyId } },
      drama: { connect: { id: drama.id } },
      platform: { connect: { id: platform.id } },
      shotDate: day(input.shotDate),
      status: 'ARCHIVED',
      failReason: null,
      ticket: { connect: { id: ticket.id } },
      ticketCode: ticket.code,
    };
    try {
      const original = await this.storage.getObject(shot.originalKey);
      const originalSha = createHash('sha256').update(original).digest('hex');
      const stamped = await this.stampShot(original, originalSha, platform.name, drama.title, user.name, ticket.code);
      const sha256 = createHash('sha256').update(stamped.bytes).digest('hex');
      const key = `${drama.companyId}/watermark/${sha256.slice(0, 16)}.png`;
      await this.storage.putObject(key, stamped.bytes, 'image/png');
      data.watermarkedKey = key;
      data.sha256 = sha256;
      data.shortHash = sha256.slice(0, 12);
    } catch {
      // 原图读不出来时仍记下工单号，列表可以按字段找到这张截图。
    }
    const updated = await this.prisma.watermarkShot.update({ where: { id }, data });
    return updated;
  }

  async archiveEvidence(user: AuthUser, fileKeys: string[]) {
    assertRole(user, ['OPS', 'OPS_MANAGER', 'BD', 'ADMIN'], '运营才能打包截图');
    const files: { name: string; data: Buffer }[] = [];
    for (const key of fileKeys) {
      const companyId = key.split('/')[0];
      const company = assertFound(await this.prisma.company.findUnique({ where: { id: companyId } }), '截图不存在');
      if (user.role === 'OPS' || user.role === 'BD') assertCompanyAccess(user, company);
      let bytes: Buffer;
      try {
        bytes = await this.storage.getObject(key);
      } catch {
        throw new BadRequestException('有截图还没有上传完成');
      }
      const shot = await this.prisma.watermarkShot.findFirst({ where: { OR: [{ watermarkedKey: key }, { originalKey: key }] }, select: { filename: true, ticketCode: true } });
      const name = shot?.filename || key.split('/').pop() || 'shot.png';
      files.push({ name: shot?.ticketCode ? `${shot.ticketCode}-${name}` : name, data: bytes });
    }
    await this.audit.write(user.id, 'evidence.archive', 'WatermarkShot', fileKeys[0], { count: fileKeys.length });
    return zipStore(files);
  }

  async listWatermarks(user: AuthUser, status?: string) {
    const where: Prisma.WatermarkShotWhereInput = {};
    if (status) where.status = status as never;
    if (user.role === 'CLIENT') {
      where.companyId = user.companyId!;
      where.status = 'ARCHIVED';
    } else if (user.role === 'OPS') where.OR = [{ company: { ownerId: user.id } }, { status: 'PENDING_MATCH', operatorId: user.id }];
    else if (user.role === 'BD') where.OR = [{ company: { bdId: user.id } }, { status: 'PENDING_MATCH', operatorId: user.id }];
    const items = await this.prisma.watermarkShot.findMany({
      where,
      include: { drama: { select: { title: true, code: true } }, platform: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const operators = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(items.map((item) => item.operatorId))] } },
      select: { id: true, name: true },
    });
    const operatorName = new Map(operators.map((item) => [item.id, item.name]));
    return Promise.all(
      items.map(async (item) => {
        const { originalKey, ...rest } = item;
        return {
          ...(user.role === 'CLIENT' ? rest : item),
          operatorName: operatorName.get(item.operatorId) || '',
          url: item.watermarkedKey ? await this.storage.presignGet(item.watermarkedKey).catch(() => null) : null,
          originalUrl: user.role === 'CLIENT' ? null : await this.storage.presignGet(originalKey).catch(() => null),
        };
      }),
    );
  }

  async dashboard(user: AuthUser) {
    const where: Prisma.DailyStatWhereInput = { status: { in: ['REVIEWED', 'LOCKED'] } };
    if (user.role === 'CLIENT') where.companyId = user.companyId!;
    else if (user.role === 'OPS') where.company = { ownerId: user.id };
    else if (user.role === 'BD') where.company = { bdId: user.id };
    const grouped = await this.prisma.dailyStat.groupBy({
      by: ['statDate', 'currency'],
      where,
      _sum: { views: true, netRevenue: true },
      orderBy: { statDate: 'asc' },
    });
    const rates = await this.prisma.exchangeRate.findMany({ where: { voidedAt: null }, orderBy: { rateDate: 'desc' } });
    const rateFor = (currency: string) => {
      if (currency === 'CNY') return 1;
      const hit = rates.find((rate) => rate.pair === `${currency}->CNY`);
      return hit ? Number(hit.value) : null;
    };
    const byDate = new Map<string, { views: number; cny: number }>();
    let views = 0;
    let cny = 0;
    let missingRate = false;
    for (const row of grouped) {
      const date = row.statDate.toISOString().slice(0, 10);
      const v = row._sum.views ?? 0;
      const net = Number(row._sum.netRevenue ?? 0);
      const rate = rateFor(row.currency);
      views += v;
      const bucket = byDate.get(date) ?? { views: 0, cny: 0 };
      bucket.views += v;
      if (rate == null) missingRate = true;
      else {
        bucket.cny += net * rate;
        cny += net * rate;
      }
      byDate.set(date, bucket);
    }
    const trend = [...byDate.entries()].map(([date, value]) => ({ date, views: value.views, revenueCny: value.cny.toFixed(2) }));
    const last7 = trend.slice(-7).reduce((sum, row) => sum + row.views, 0);
    const prev7 = trend.slice(-14, -7).reduce((sum, row) => sum + row.views, 0);
    const delta = prev7 ? Math.round(((last7 - prev7) / prev7) * 1000) / 10 : null;
    const topRaw = await this.prisma.dailyStat.groupBy({
      by: ['dramaId'],
      where,
      _sum: { views: true },
      orderBy: { _sum: { views: 'desc' } },
      take: 8,
    });
    const dramas = await this.prisma.drama.findMany({ where: { id: { in: topRaw.map((row) => row.dramaId) } }, select: { id: true, title: true, code: true } });
    const top = topRaw.map((row) => ({ dramaId: row.dramaId, title: dramas.find((drama) => drama.id === row.dramaId)?.title || row.dramaId, views: row._sum.views ?? 0 }));
    const scope = user.role === 'CLIENT' ? { companyId: user.companyId! } : user.role === 'OPS' ? { company: { ownerId: user.id } } : user.role === 'BD' ? { company: { bdId: user.id } } : {};
    const live = await this.prisma.distributionPlan.count({ where: { status: 'LIVE', ...scope } });
    const platforms = await this.prisma.planPlatform.findMany({
      where: { listingStatus: 'LISTED', plan: scope },
      distinct: ['platformId'],
      select: { platformName: true },
    });
    const latest = trend.length ? trend[trend.length - 1].date : null;
    const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const yesterdayDate = new Date(`${yesterday}T00:00:00.000Z`);
    const [pendingSync, reviewedSync] = await Promise.all([
      this.prisma.dailyStat.count({ where: { ...scope, statDate: yesterdayDate, status: { in: ['DRAFT', 'ANOMALY'] } } }),
      this.prisma.dailyStat.count({ where: { ...scope, statDate: yesterdayDate, status: { in: ['REVIEWED', 'LOCKED'] } } }),
    ]);
    const updating = user.role === 'CLIENT' && (pendingSync > 0 || reviewedSync === 0);
    const lead = top[0];
    const conclusion = !trend.length
      ? '还没有已复核的播放数据。数据录入并复核后，这里会告诉你哪部剧在涨。'
      : `近 7 天播放量${delta == null ? '还没有上一周可比' : `较前 7 天 ${delta >= 0 ? '+' : ''}${delta}%`}${lead ? `，播放最多的是《${lead.title}》` : ''}。`;
    return {
      views,
      revenueCny: cny.toFixed(2),
      revenueNote: missingRate ? '有币种缺少汇率，人民币为部分估算，以结算单为准' : '人民币为按当前汇率的估算，以结算单为准',
      liveDramas: live,
      platformCount: platforms.length,
      platforms: platforms.map((item) => item.platformName),
      asOf: latest ? `数据更新到 ${formatCnDate(latest)}` : '还没有数据',
      conclusion,
      delta,
      trend,
      top,
      updating,
      updatingLabel: updating ? '数据更新中' : '',
    };
  }

  async listTickets(user: AuthUser, query: { page: number; pageSize: number; type?: string; status?: string }) {
    const where: Prisma.TicketWhereInput = {};
    if (user.role === 'CLIENT') where.companyId = user.companyId!;
    else if (user.role === 'OPS') where.company = { ownerId: user.id };
    else if (user.role === 'BD') where.company = { bdId: user.id };
    if (query.type) where.type = query.type as never;
    if (query.status) where.status = query.status as never;
    const [items, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { drama: { select: { title: true, code: true } }, _count: { select: { shots: true, messages: true } } },
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async getTicket(user: AuthUser, id: string) {
    const ticket = assertFound(
      await this.prisma.ticket.findUnique({
        where: { id },
        include: { messages: { orderBy: { createdAt: 'asc' } }, shots: true, company: true, drama: { select: { title: true } } },
      }),
    );
    if (user.role === 'CLIENT' || user.role === 'OPS' || user.role === 'BD') assertCompanyAccess(user, ticket.company);
    const shots = await Promise.all(ticket.shots.map(async (shot) => ({ ...shot, url: shot.watermarkedKey ? await this.storage.presignGet(shot.watermarkedKey).catch(() => null) : null, originalKey: user.role === 'CLIENT' ? undefined : shot.originalKey })));
    return { ...ticket, shots };
  }

  async readTicket(user: AuthUser, id: string) {
    const ticket = await this.getTicket(user, id);
    if (user.role === 'CLIENT' && ticket.status === 'PENDING_CLIENT') {
      await this.prisma.ticket.update({ where: { id }, data: { status: 'READ' } });
    }
    return this.getTicket(user, id);
  }

  async message(user: AuthUser, id: string, input: z.infer<typeof ticketMessageSchema>) {
    assertBusinessWrite(user);
    const ticket = await this.getTicket(user, id);
    await this.prisma.ticketMessage.create({ data: { ticketId: id, authorId: user.id, authorName: user.name, content: input.content } });
    const next = user.role === 'CLIENT' ? 'IN_PROGRESS' : ticket.status === 'PENDING_CLIENT' ? 'PENDING_CLIENT' : 'IN_PROGRESS';
    await this.prisma.ticket.update({ where: { id }, data: { status: next } });
    return this.getTicket(user, id);
  }

  private async dailyWhere(user: AuthUser, query: z.infer<typeof dailyListSchema>): Promise<Prisma.DailyStatWhereInput> {
    const where: Prisma.DailyStatWhereInput = {};
    if (user.role === 'CLIENT') {
      where.companyId = user.companyId!;
      where.status = { in: ['REVIEWED', 'LOCKED'] };
    } else if (user.role === 'OPS') where.company = { ownerId: user.id };
    else if (user.role === 'BD') where.company = { bdId: user.id };
    if (query.companyId && user.role !== 'CLIENT') where.companyId = query.companyId;
    if (query.platformId) where.platformId = query.platformId;
    if (query.dramaId) where.dramaId = query.dramaId;
    if (query.status && user.role !== 'CLIENT') where.status = query.status;
    if (query.from || query.to) where.statDate = { gte: query.from ? day(query.from) : undefined, lte: query.to ? day(query.to) : undefined };
    return where;
  }

  private async stampShot(original: Buffer, originalSha: string, platformName: string, dramaTitle: string, operator: string, ticketCode: string) {
    const when = shanghaiStamp();
    const text = `${platformName} | ${dramaTitle} | ${operator} | ${when} | 原图 ${originalSha.slice(0, 12)}${ticketCode ? ` | ${ticketCode}` : ''}`;
    try {
      return { bytes: await stampImage(original, text), text };
    } catch {
      throw new BadRequestException('这张图无法加水印，请上传 png 或 jpg');
    }
  }

  private async useTicket(code: string, companyId: string, dramaId: string, title: string, platformName: string) {
    const ticket = await this.prisma.ticket.findUnique({ where: { code } });
    if (!ticket) throw new BadRequestException('工单不存在');
    if (ticket.companyId !== companyId) throw new BadRequestException('工单不属于该客户');
    return this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { body: `${ticket.body}\n${platformName} · 《${title}》`, dramaId: ticket.dramaId ?? dramaId },
    });
  }

  private async ensureTicket(companyId: string, dramaId: string, title: string, platformName: string, shotDate: string, actorId: string) {
    const ticketTitle = `${shotDate} 平台截图`;
    let ticket = await this.prisma.ticket.findFirst({ where: { companyId, type: 'WATERMARK', title: ticketTitle } });
    if (!ticket) {
      const code = await this.prisma.$transaction((tx) => nextCode(tx, 'GD', 5));
      ticket = await this.prisma.ticket.create({
        data: { code, companyId, type: 'WATERMARK', status: 'PENDING_CLIENT', title: ticketTitle, body: '当天的上架和数据截图都在这张工单里。', createdById: actorId },
      });
    }
    await this.prisma.ticket.update({ where: { id: ticket.id }, data: { body: `${ticket.body}\n${platformName} · 《${title}》`, dramaId: ticket.dramaId ?? dramaId } });
    return ticket;
  }
}

export { clientPhaseFromPlans };
