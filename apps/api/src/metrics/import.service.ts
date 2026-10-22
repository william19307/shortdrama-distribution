import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizeName } from '@shortform/shared';
import ExcelJS from 'exceljs';
import { assertCompanyAccess, assertFound } from '../core/access';
import { AuditService } from '../core/audit.service';
import { assertBusinessWrite, assertRole, AuthUser, day, nextCode } from '../core/auth';
import { moneyDecimal, MONEY_PATTERN } from '../core/money';
import { PrismaService } from '../core/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const FIELD_CANDIDATES: Record<string, string[]> = {
  statDate: ['statDate', '数据日期', '日期', 'date'],
  titleLocal: ['titleLocal', '剧名', '本地片名', 'title'],
  dramaCode: ['dramaCode', '剧目编号', '剧编号', 'code'],
  platformDramaId: ['platformDramaId', '平台剧ID', '平台剧目ID'],
  language: ['language', '语言'],
  platformCode: ['platformCode', '平台代码', '平台'],
  episodesOnline: ['episodesOnline', '上线集数', '集数'],
  views: ['views', '播放', '播放量'],
  viewMetricDef: ['viewMetricDef', '播放口径', '口径'],
  currency: ['currency', '币种'],
  netRevenue: ['netRevenue', '净收入', '收入'],
  grossRevenue: ['grossRevenue', '毛收入'],
  dealType: ['dealType', '合作模式'],
  dataSource: ['dataSource', '数据来源'],
  statTimezone: ['statTimezone', '时区'],
  territory: ['territory', '地区'],
};

const STAFF = ['OPS', 'OPS_MANAGER', 'BD'] as const;

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async upload(user: AuthUser, file: Express.Multer.File | undefined, platformId?: string) {
    assertBusinessWrite(user);
    assertRole(user, [...STAFF]);
    if (!file?.buffer?.length) throw new BadRequestException('请上传 xlsx 文件');
    const name = file.originalname || 'import.xlsx';
    if (!/\.xlsx$/i.test(name)) throw new BadRequestException('仅支持 .xlsx');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('工作表为空');

    const headers: string[] = [];
    sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
      headers[col - 1] = cellText(cell.value);
    });
    if (!headers.some(Boolean)) throw new BadRequestException('表头为空');

    const rawRows: Record<string, string>[] = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => {
        if (!header) return;
        obj[header] = cellText(row.getCell(index + 1).value);
      });
      if (Object.values(obj).some((value) => value.length)) rawRows.push(obj);
    });
    if (!rawRows.length) throw new BadRequestException('没有数据行');

    const cleanHeaders = headers.filter(Boolean);
    const template = platformId
      ? await this.prisma.importFieldTemplate.findFirst({
        where: { platformId },
        orderBy: { version: 'desc' },
      })
      : null;
    const templateHeaders = Array.isArray(template?.headers) ? (template.headers as string[]) : [];
    const headerChanged = Boolean(template && !sameHeaders(templateHeaders, cleanHeaders));
    const templateApplied = Boolean(template && !headerChanged);
    const mapping = templateApplied ? (template!.mapping as Record<string, string>) : guessMapping(cleanHeaders);
    const code = await this.prisma.$transaction(async (tx) => nextCode(tx, 'IM'));
    const batch = await this.prisma.dailyImportBatch.create({
      data: {
        code,
        platformId: platformId || null,
        fileName: name,
        status: templateApplied ? 'MAPPED' : 'UPLOADED',
        headers: cleanHeaders,
        mapping,
        headerChanged,
        templateVersion: templateApplied ? template!.version : null,
        createdById: user.id,
        rows: { create: rawRows.map((raw, index) => ({ rowNo: index + 2, raw, status: 'OK' })) },
      },
    });
    if (platformId) {
      await this.prisma.syncTask.updateMany({
        where: { platformId, status: 'PENDING' },
        data: { status: 'SYNCING' },
      });
    }
    await this.audit.write(user.id, 'daily.import.upload', 'DailyImportBatch', batch.id, {
      rows: rawRows.length,
      fileName: name,
      templateApplied,
      headerChanged,
      templateVersion: template?.version ?? null,
    });
    const presented = await this.presentBatch(batch.id);
    return { ...presented, templateApplied, headerChanged, templateVersion: templateApplied ? template!.version : null };
  }

  async getBatch(user: AuthUser, id: string) {
    assertRole(user, ['OPS', 'OPS_MANAGER', 'ADMIN', 'BD', 'FINANCE']);
    return this.presentBatch(id);
  }

  async putMapping(user: AuthUser, id: string, input: { mapping: Record<string, string>; platformId?: string; saveAsTemplate?: boolean }) {
    assertBusinessWrite(user);
    assertRole(user, [...STAFF]);
    const batch = assertFound(await this.prisma.dailyImportBatch.findUnique({ where: { id } }), '导入批次不存在');
    if (batch.status === 'PUBLISHED' || batch.status === 'FORCE_PUBLISHED') throw new BadRequestException('已发布的批次不能改映射');
    const platformId = input.platformId ?? batch.platformId;
    let templateVersion = batch.templateVersion;
    if (input.saveAsTemplate) {
      if (!platformId) throw new BadRequestException('保存模板需要指定平台');
      const last = await this.prisma.importFieldTemplate.findFirst({ where: { platformId }, orderBy: { version: 'desc' } });
      const version = (last?.version ?? 0) + 1;
      const headers = Array.isArray(batch.headers) ? (batch.headers as string[]) : [];
      await this.prisma.importFieldTemplate.create({
        data: { platformId, version, mapping: input.mapping, headers, createdById: user.id },
      });
      templateVersion = version;
    }
    await this.prisma.dailyImportBatch.update({
      where: { id },
      data: { mapping: input.mapping, platformId, status: 'MAPPED', headerChanged: false, templateVersion },
    });
    return this.validate(user, id);
  }

  async markRow(user: AuthUser, id: string, rowNo: number, reason: string) {
    assertBusinessWrite(user);
    assertRole(user, [...STAFF]);
    const row = assertFound(
      await this.prisma.dailyImportRow.findFirst({ where: { batchId: id, rowNo } }),
      '这一行不存在',
    );
    if (row.status === 'PUBLISHED') throw new BadRequestException('已发布的行不能再标记');
    await this.prisma.dailyImportRow.update({
      where: { id: row.id },
      data: { status: 'ERROR', errorReason: reason },
    });
    await this.audit.write(user.id, 'daily.import.mark', 'DailyImportRow', row.id, { rowNo, reason });
    return this.presentBatch(id);
  }

  async validate(user: AuthUser, id: string) {
    assertBusinessWrite(user);
    assertRole(user, [...STAFF]);
    const batch = assertFound(
      await this.prisma.dailyImportBatch.findUnique({ where: { id }, include: { rows: true, platform: true } }),
      '导入批次不存在',
    );
    const mapping = (batch.mapping ?? {}) as Record<string, string>;
    const platforms = await this.prisma.platform.findMany();
    const platformByCode = new Map(platforms.map((item) => [item.code.toLowerCase(), item]));
    const platformByName = new Map(platforms.map((item) => [item.name.toLowerCase(), item]));
    let ok = 0;
    let err = 0;
    const seen = new Map<string, number>();
    for (const row of batch.rows) {
      if (row.status === 'EXCLUDED' || row.status === 'PUBLISHED') continue;
      if (row.rowAction === 'IGNORED') continue;
      const assessed = await this.assessRow(user, batch, row.raw as Record<string, string>, mapping, platforms, platformByCode, platformByName, seen);
      if (assessed.status === 'OK') ok += 1;
      else err += 1;
      await this.prisma.dailyImportRow.update({
        where: { id: row.id },
        data: {
          mapped: assessed.mapped,
          status: assessed.status,
          errorReason: assessed.problems.join('；'),
          issues: assessed.issues,
          candidates: assessed.candidates,
          rowAction: assessed.rowAction,
        },
      });
    }
    await this.prisma.dailyImportBatch.update({ where: { id }, data: { status: 'VALIDATED' } });
    await this.audit.write(user.id, 'daily.import.validate', 'DailyImportBatch', id, { ok, err });
    return this.presentBatch(id);
  }

  async publish(user: AuthUser, id: string, opts?: { force?: boolean; reason?: string }) {
    assertBusinessWrite(user);
    assertRole(user, [...STAFF]);
    const batch = assertFound(
      await this.prisma.dailyImportBatch.findUnique({ where: { id }, include: { rows: true } }),
      '导入批次不存在',
    );
    if (batch.status === 'PUBLISHED' || batch.status === 'FORCE_PUBLISHED') throw new BadRequestException('批次已发布');
    const force = Boolean(opts?.force);
    if (force) {
      assertRole(user, ['OPS_MANAGER'], '强制发布由运营主管处理');
      if (!opts?.reason?.trim()) throw new BadRequestException('强制发布必须填写理由');
    }
    const errorRows = batch.rows.filter((row) => row.status === 'ERROR');
    if (errorRows.length && !force) throw new BadRequestException(`还有 ${errorRows.length} 条问题行，请修正、提交主管或由主管强制发布`);
    if (force && errorRows.length) {
      await this.prisma.dailyImportRow.updateMany({
        where: { batchId: id, status: 'ERROR' },
        data: { status: 'EXCLUDED' },
      });
    }

    let succeeded = 0;
    for (const row of batch.rows.filter((item) => item.status === 'OK')) {
      const mapped = row.mapped as Record<string, string> | null;
      if (!mapped?.dramaId || !mapped.platformId || !mapped.companyId) continue;
      const statDate = day(String(mapped.statDate).slice(0, 10));
      const data = {
        recordId: `${mapped.platformId}:${String(mapped.statDate).slice(0, 10)}:${mapped.dramaId}:${mapped.language}`,
        companyId: mapped.companyId,
        platformId: mapped.platformId,
        dramaId: mapped.dramaId,
        statDate,
        statTimezone: mapped.statTimezone || 'America/Los_Angeles',
        titleLocal: mapped.titleLocal || mapped.dramaCode || '',
        language: mapped.language,
        territory: mapped.territory || '',
        episodesOnline: Number(mapped.episodesOnline),
        views: Number(mapped.views),
        viewMetricDef: mapped.viewMetricDef || '播放次数',
        netRevenue: mapped.netRevenue ? moneyDecimal(mapped.netRevenue) : null,
        grossRevenue: mapped.grossRevenue ? moneyDecimal(mapped.grossRevenue) : null,
        currency: (mapped.currency || 'USD').toUpperCase(),
        dealType: mapped.dealType as 'NO_MG' | 'MG_SHARE' | 'BUYOUT',
        dataSource: mapped.dataSource as 'SCREENSHOT' | 'REPORT_EMAIL' | 'BD_NOTE',
        evidenceSha256: `import:${batch.code}:${row.rowNo}`,
        status: 'REVIEWED' as const,
        enteredById: user.id,
        reviewedById: user.id,
        reviewedAt: new Date(),
      };
      const existing = await this.prisma.dailyStat.findUnique({
        where: { platformId_statDate_dramaId_language: { platformId: data.platformId, statDate, dramaId: data.dramaId, language: data.language } },
      });
      if (existing?.status === 'LOCKED') {
        await this.prisma.dailyImportRow.update({ where: { id: row.id }, data: { status: 'ERROR', errorReason: '目标日报已锁定' } });
        continue;
      }
      const saved = existing
        ? await this.prisma.dailyStat.update({
          where: { id: existing.id },
          data: { ...data, lockedAt: null, version: { increment: 1 } },
        })
        : await this.prisma.dailyStat.create({ data });
      await this.prisma.syncTask.upsert({
        where: { platformId_statDate: { platformId: data.platformId, statDate } },
        create: { platformId: data.platformId, statDate, status: 'PUBLISHED', publishedAt: new Date() },
        update: { status: 'PUBLISHED', publishedAt: new Date() },
      });
      await this.prisma.dailyImportRow.update({ where: { id: row.id }, data: { status: 'PUBLISHED', dailyStatId: saved.id } });
      succeeded += 1;
    }

    await this.prisma.dailyImportBatch.update({
      where: { id },
      data: { status: force ? 'FORCE_PUBLISHED' : 'PUBLISHED', forceReason: force ? opts?.reason : null, publishedAt: new Date() },
    });
    await this.audit.write(user.id, force ? 'daily.import.force_publish' : 'daily.import.publish', 'DailyImportBatch', id, {
      succeeded,
      reason: opts?.reason,
      excludedErrors: errorRows.length,
    });
    return this.presentBatch(id);
  }

  async forcePublish(user: AuthUser, id: string, input: { reason: string }) {
    return this.publish(user, id, { force: true, reason: input.reason });
  }

  async submitManager(user: AuthUser, id: string, input: { note?: string }) {
    assertBusinessWrite(user);
    assertRole(user, [...STAFF]);
    const batch = assertFound(
      await this.prisma.dailyImportBatch.findUnique({ where: { id }, include: { rows: true } }),
      '导入批次不存在',
    );
    if (batch.status === 'PUBLISHED' || batch.status === 'FORCE_PUBLISHED') throw new BadRequestException('已发布的批次无需提交主管');
    const errors = batch.rows.filter((row) => row.status === 'ERROR');
    if (!errors.length) throw new BadRequestException('没有问题行可提交');
    await this.prisma.dailyImportBatch.update({
      where: { id },
      data: { status: 'SUBMITTED_MANAGER', managerNote: input.note ?? '', submittedToManagerAt: new Date() },
    });
    const managers = await this.prisma.user.findMany({ where: { role: 'OPS_MANAGER', disabled: false }, select: { id: true } });
    await this.notifications.pushMany(managers.map((row) => row.id), {
      type: 'IMPORT_SUBMIT_MANAGER',
      title: `报表导入问题行待处理：${batch.code}`,
      body: `批次 ${batch.code} 有 ${errors.length} 条问题行。${input.note ?? ''}`.trim(),
      entityType: 'DailyImportBatch',
      entityId: batch.id,
    });
    await this.audit.write(user.id, 'daily.import.submit_manager', 'DailyImportBatch', id, { errors: errors.length });
    return this.presentBatch(id);
  }

  async listSync(user: AuthUser) {
    assertRole(user, ['OPS', 'OPS_MANAGER', 'ADMIN', 'BD', 'FINANCE']);
    const tasks = await this.prisma.syncTask.findMany({
      include: { platform: { select: { id: true, code: true, name: true, syncLag: true } } },
      orderBy: [{ statDate: 'desc' }, { platform: { sort: 'asc' } }],
      take: 200,
    });
    return tasks.map((task) => ({
      ...task,
      statDate: task.statDate.toISOString().slice(0, 10),
      asOfLabel: task.platform.syncLag === 'T2' ? '前天' : '昨天',
    }));
  }

  async confirmRow(user: AuthUser, id: string, rowNo: number, dramaId: string) {
    assertBusinessWrite(user);
    assertRole(user, [...STAFF]);
    const row = assertFound(await this.prisma.dailyImportRow.findFirst({ where: { batchId: id, rowNo }, include: { batch: true } }), '这一行不存在');
    const drama = assertFound(await this.prisma.drama.findUnique({ where: { id: dramaId }, include: { company: true } }), '剧目不存在');
    if (user.role === 'OPS' || user.role === 'BD') assertCompanyAccess(user, drama.company);
    const mapped = (row.mapped ?? {}) as Record<string, string>;
    const platformId = mapped.platformId || row.batch.platformId;
    if (!platformId) throw new BadRequestException('先匹配平台再确认剧目');
    const aliasRaw = mapped.titleLocal || drama.title;
    await this.prisma.dramaAlias.upsert({
      where: { platformId_aliasNorm: { platformId, aliasNorm: normalizeName(aliasRaw) } },
      create: {
        platformId,
        dramaId: drama.id,
        aliasNorm: normalizeName(aliasRaw),
        aliasRaw,
        platformSeriesId: mapped.platformDramaId || '',
        createdById: user.id,
      },
      update: { dramaId: drama.id, aliasRaw, platformSeriesId: mapped.platformDramaId || '' },
    });
    await this.audit.write(user.id, 'daily.import.confirm', 'DailyImportRow', row.id, { dramaId, alias: aliasRaw });
    return this.validate(user, id);
  }

  async ignoreRow(user: AuthUser, id: string, rowNo: number, reason: string) {
    assertBusinessWrite(user);
    assertRole(user, [...STAFF]);
    if (!reason.trim()) throw new BadRequestException('标记忽略必须填写原因');
    const row = assertFound(await this.prisma.dailyImportRow.findFirst({ where: { batchId: id, rowNo } }), '这一行不存在');
    if (row.status === 'PUBLISHED') throw new BadRequestException('已发布的行不能忽略');
    await this.prisma.dailyImportRow.update({
      where: { id: row.id },
      data: { status: 'EXCLUDED', rowAction: 'IGNORED', errorReason: reason.trim() },
    });
    await this.audit.write(user.id, 'daily.import.ignore', 'DailyImportRow', row.id, { reason });
    return this.presentBatch(id);
  }

  async patchRow(user: AuthUser, id: string, rowNo: number, values: Record<string, string>) {
    assertBusinessWrite(user);
    assertRole(user, [...STAFF]);
    const row = assertFound(await this.prisma.dailyImportRow.findFirst({ where: { batchId: id, rowNo } }), '这一行不存在');
    if (row.status === 'PUBLISHED') throw new BadRequestException('已发布的行不能修改');
    const raw = { ...(row.raw as Record<string, string>), ...values };
    await this.prisma.dailyImportRow.update({ where: { id: row.id }, data: { raw, rowAction: '' } });
    return this.validate(user, id);
  }

  private async assessRow(
    user: AuthUser,
    batch: { platformId: string | null },
    raw: Record<string, string>,
    mapping: Record<string, string>,
    platforms: { id: string; code: string; name: string }[],
    platformByCode: Map<string, { id: string }>,
    platformByName: Map<string, { id: string }>,
    seen: Map<string, number>,
  ) {
    const mapped: Record<string, string> = {};
    for (const [field, header] of Object.entries(mapping)) mapped[field] = String(raw[header] ?? '').trim();
    const issues: { field: string; message: string }[] = [];
    const problems: string[] = [];
    const add = (field: string, message: string) => {
      issues.push({ field, message });
      problems.push(message);
    };
    if (!mapped.statDate || !/^\d{4}-\d{2}-\d{2}/.test(mapped.statDate)) add('statDate', '数据日期无效');
    if (!mapped.titleLocal && !mapped.dramaCode && !mapped.platformDramaId) add('titleLocal', '缺少剧名或剧目编号');
    if (!mapped.language) add('language', '缺少语言');
    if (mapped.views?.startsWith('-')) add('views', '播放量不能为负数');
    else if (!mapped.views || !/^\d+$/.test(mapped.views)) add('views', '播放量无效');
    if (mapped.episodesOnline?.startsWith('-')) add('episodesOnline', '上线集数不能为负数');
    else if (!mapped.episodesOnline || !/^\d+$/.test(mapped.episodesOnline)) add('episodesOnline', '上线集数无效');
    if (!mapped.currency) mapped.currency = 'USD';
    if (!mapped.viewMetricDef) mapped.viewMetricDef = '播放次数';
    if (!mapped.statTimezone) mapped.statTimezone = 'America/Los_Angeles';
    if (!mapped.dealType) mapped.dealType = 'NO_MG';
    if (!mapped.dataSource) mapped.dataSource = 'REPORT_EMAIL';
    if (!['NO_MG', 'MG_SHARE', 'BUYOUT'].includes(mapped.dealType)) add('dealType', '合作模式无效');
    if (!['SCREENSHOT', 'REPORT_EMAIL', 'BD_NOTE'].includes(mapped.dataSource)) add('dataSource', '数据来源无效');
    for (const [field, label] of [['netRevenue', '净收入'], ['grossRevenue', '毛收入']] as const) {
      if (mapped[field]?.startsWith('-')) add(field, `${label}不能为负数`);
      else if (mapped[field] && !MONEY_PATTERN.test(mapped[field])) add(field, `${label}最多保留两位小数`);
    }

    let platform = batch.platformId ? platforms.find((item) => item.id === batch.platformId) : undefined;
    if (!platform && mapped.platformCode) {
      const hit = platformByCode.get(mapped.platformCode.toLowerCase()) || platformByName.get(mapped.platformCode.toLowerCase());
      platform = hit ? platforms.find((item) => item.id === hit.id) : undefined;
    }
    if (!platform) add('platformCode', '未匹配到平台');
    else mapped.platformId = platform.id;

    const candidates: { dramaId: string; title: string; score: number }[] = [];
    let rowAction = '';
    let drama = await this.matchDrama(mapped, platform?.id);
    if (!drama && mapped.titleLocal && platform) {
      const fuzzy = await this.fuzzyDramas(mapped.titleLocal);
      candidates.push(...fuzzy);
      if (fuzzy.length) {
        rowAction = 'CANDIDATE';
        add('titleLocal', '剧名需要从候选里确认');
      }
    }
    if (!drama && !candidates.length && (mapped.titleLocal || mapped.dramaCode || mapped.platformDramaId)) add('titleLocal', '未匹配到剧目');
    if (drama) {
      mapped.dramaId = drama.id;
      mapped.companyId = drama.companyId;
      if (user.role === 'OPS' || user.role === 'BD') {
        try {
          assertCompanyAccess(user, drama.company);
        } catch {
          add('titleLocal', '不在负责范围');
        }
      }
      if (mapped.platformId && mapped.statDate && mapped.language) {
        const key = `${mapped.platformId}|${mapped.statDate.slice(0, 10)}|${drama.id}|${mapped.language}`;
        if (seen.has(key)) add('statDate', '与本文件其他行重复');
        else seen.set(key, 1);
        const views = Number(mapped.views);
        if (/^\d+$/.test(mapped.views || '')) {
          const prev = await this.prisma.dailyStat.findFirst({
            where: { platformId: mapped.platformId, dramaId: drama.id, language: mapped.language, statDate: { lt: day(mapped.statDate.slice(0, 10)) } },
            orderBy: { statDate: 'desc' },
          });
          if (prev && prev.views > 0 && Math.abs(views - prev.views) / prev.views > 3) add('views', '环比超过 ±300%');
        }
      }
    }
    return { mapped, status: problems.length ? 'ERROR' as const : 'OK' as const, problems, issues, candidates, rowAction };
  }

  private async matchDrama(mapped: Record<string, string>, platformId?: string) {
    if (platformId && mapped.platformDramaId) {
      const bySeries = await this.prisma.dramaAlias.findFirst({
        where: { platformId, platformSeriesId: mapped.platformDramaId },
        include: { drama: { include: { company: true } } },
      });
      if (bySeries) return bySeries.drama;
    }
    const title = mapped.titleLocal?.trim();
    if (platformId && title) {
      const byAlias = await this.prisma.dramaAlias.findUnique({
        where: { platformId_aliasNorm: { platformId, aliasNorm: normalizeName(title) } },
        include: { drama: { include: { company: true } } },
      });
      if (byAlias) return byAlias.drama;
    }
    if (mapped.dramaCode) {
      const byCode = await this.prisma.drama.findFirst({ where: { code: mapped.dramaCode }, include: { company: true } });
      if (byCode) return byCode;
    }
    if (title) {
      const norm = normalizeName(title);
      const exact = await this.prisma.drama.findFirst({
        where: { OR: [{ nameNorm: norm }, { title }, { titleEn: title }] },
        include: { company: true },
      });
      if (exact) return exact;
    }
    return null;
  }

  private async fuzzyDramas(title: string) {
    const norm = normalizeName(title);
    const threshold = Number(process.env.MATCH_THRESHOLD || '0.85');
    const dramas = await this.prisma.drama.findMany({ select: { id: true, title: true, nameNorm: true }, take: 500 });
    return dramas
      .map((drama) => ({ dramaId: drama.id, title: drama.title, score: similarity(norm, drama.nameNorm || normalizeName(drama.title)) }))
      .filter((item) => item.score >= (Number.isFinite(threshold) ? threshold : 0.85) && item.score < 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  private async presentBatch(id: string) {
    const batch = assertFound(
      await this.prisma.dailyImportBatch.findUnique({
        where: { id },
        include: {
          rows: { orderBy: { rowNo: 'asc' } },
          platform: { select: { id: true, code: true, name: true } },
          createdBy: { select: { id: true, name: true, email: true } },
        },
      }),
      '导入批次不存在',
    );
    const summary = {
      total: batch.rows.length,
      ok: batch.rows.filter((row) => row.status === 'OK').length,
      error: batch.rows.filter((row) => row.status === 'ERROR').length,
      excluded: batch.rows.filter((row) => row.status === 'EXCLUDED').length,
      published: batch.rows.filter((row) => row.status === 'PUBLISHED').length,
    };
    return { ...batch, summary };
  }
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    const text = value.toString();
    if (!/e/i.test(text)) return text;
    return value.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  }
  if (typeof value === 'object') {
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue);
    if ('text' in value && typeof value.text === 'string') return value.text.trim();
    if ('richText' in value && Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('').trim();
  }
  return String(value).trim();
}

function sameHeaders(left: string[], right: string[]) {
  const a = [...left].map((item) => item.trim()).filter(Boolean).sort();
  const b = [...right].map((item) => item.trim()).filter(Boolean).sort();
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function similarity(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const grams = (value: string) => {
    const bag = new Map<string, number>();
    const text = value.length === 1 ? `${value}${value}` : value;
    for (let i = 0; i < text.length - 1; i += 1) bag.set(text.slice(i, i + 2), (bag.get(text.slice(i, i + 2)) || 0) + 1);
    return bag;
  };
  const a = grams(left);
  const b = grams(right);
  let overlap = 0;
  let total = 0;
  for (const count of a.values()) total += count;
  for (const count of b.values()) total += count;
  for (const [key, count] of a) overlap += Math.min(count, b.get(key) || 0);
  return total ? (2 * overlap) / total : 0;
}

function guessMapping(headers: string[]) {
  const mapping: Record<string, string> = {};
  const lower = headers.map((header) => header.toLowerCase());
  for (const [field, candidates] of Object.entries(FIELD_CANDIDATES)) {
    for (const candidate of candidates) {
      const index = lower.findIndex((header) => header === candidate.toLowerCase());
      if (index >= 0) {
        mapping[field] = headers[index];
        break;
      }
    }
  }
  return mapping;
}
