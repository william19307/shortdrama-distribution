import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

    const mapping = guessMapping(headers);
    const code = await this.prisma.$transaction(async (tx) => nextCode(tx, 'IM'));
    const batch = await this.prisma.dailyImportBatch.create({
      data: {
        code,
        platformId: platformId || null,
        fileName: name,
        status: 'UPLOADED',
        headers,
        mapping,
        createdById: user.id,
        rows: { create: rawRows.map((raw, index) => ({ rowNo: index + 2, raw, status: 'OK' })) },
      },
    });
    await this.audit.write(user.id, 'daily.import.upload', 'DailyImportBatch', batch.id, { rows: rawRows.length, fileName: name });
    return this.presentBatch(batch.id);
  }

  async getBatch(user: AuthUser, id: string) {
    assertRole(user, ['OPS', 'OPS_MANAGER', 'ADMIN', 'BD', 'FINANCE']);
    return this.presentBatch(id);
  }

  async putMapping(user: AuthUser, id: string, input: { mapping: Record<string, string>; platformId?: string }) {
    assertBusinessWrite(user);
    assertRole(user, [...STAFF]);
    const batch = assertFound(await this.prisma.dailyImportBatch.findUnique({ where: { id } }), '导入批次不存在');
    if (batch.status === 'PUBLISHED' || batch.status === 'FORCE_PUBLISHED') throw new BadRequestException('已发布的批次不能改映射');
    await this.prisma.dailyImportBatch.update({
      where: { id },
      data: { mapping: input.mapping, platformId: input.platformId ?? batch.platformId, status: 'MAPPED' },
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
    for (const row of batch.rows) {
      if (row.status === 'EXCLUDED' || row.status === 'PUBLISHED') continue;
      const raw = row.raw as Record<string, string>;
      const mapped: Record<string, string> = {};
      for (const [field, header] of Object.entries(mapping)) mapped[field] = String(raw[header] ?? '').trim();
      const problems: string[] = [];
      if (!mapped.statDate || !/^\d{4}-\d{2}-\d{2}/.test(mapped.statDate)) problems.push('数据日期无效');
      if (!mapped.titleLocal && !mapped.dramaCode) problems.push('缺少剧名或剧目编号');
      if (!mapped.language) problems.push('缺少语言');
      if (!mapped.views || !/^\d+$/.test(mapped.views)) problems.push('播放量无效');
      if (!mapped.episodesOnline || !/^\d+$/.test(mapped.episodesOnline)) problems.push('上线集数无效');
      if (!mapped.currency) mapped.currency = 'USD';
      if (!mapped.viewMetricDef) mapped.viewMetricDef = '播放次数';
      if (!mapped.statTimezone) mapped.statTimezone = 'America/Los_Angeles';
      if (!mapped.dealType) mapped.dealType = 'NO_MG';
      if (!mapped.dataSource) mapped.dataSource = 'REPORT_EMAIL';
      if (!['NO_MG', 'MG_SHARE', 'BUYOUT'].includes(mapped.dealType)) problems.push('合作模式无效');
      if (!['SCREENSHOT', 'REPORT_EMAIL', 'BD_NOTE'].includes(mapped.dataSource)) problems.push('数据来源无效');
      for (const [field, label] of [['netRevenue', '净收入'], ['grossRevenue', '毛收入']] as const) {
        if (mapped[field] && !MONEY_PATTERN.test(mapped[field])) problems.push(`${label}最多保留两位小数`);
      }

      const drama = mapped.dramaCode
        ? await this.prisma.drama.findFirst({ where: { code: mapped.dramaCode }, include: { company: true } })
        : await this.prisma.drama.findFirst({
          where: { OR: [{ title: mapped.titleLocal }, { titleEn: mapped.titleLocal }] },
          include: { company: true },
        });
      if (!drama) problems.push('未匹配到剧目');
      else {
        mapped.dramaId = drama.id;
        mapped.companyId = drama.companyId;
        if (user.role === 'OPS' || user.role === 'BD') {
          try {
            assertCompanyAccess(user, drama.company);
          } catch {
            problems.push('不在负责范围');
          }
        }
      }

      let platform = batch.platformId ? platforms.find((item) => item.id === batch.platformId) : undefined;
      if (!platform && mapped.platformCode) {
        platform = platformByCode.get(mapped.platformCode.toLowerCase()) || platformByName.get(mapped.platformCode.toLowerCase());
      }
      if (!platform) problems.push('未匹配到平台');
      else mapped.platformId = platform.id;

      const status = problems.length ? 'ERROR' : 'OK';
      if (status === 'OK') ok += 1;
      else err += 1;
      await this.prisma.dailyImportRow.update({
        where: { id: row.id },
        data: { mapped, status, errorReason: problems.join('；') },
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
        status: 'DRAFT' as const,
        enteredById: user.id,
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
          data: { ...data, reviewedById: null, reviewedAt: null, lockedAt: null, version: { increment: 1 } },
        })
        : await this.prisma.dailyStat.create({ data });
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
