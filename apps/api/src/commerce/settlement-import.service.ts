import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { assertCompanyAccess, assertFound } from '../core/access';
import { AuditService } from '../core/audit.service';
import { assertBusinessWrite, assertRole, AuthUser, nextCode } from '../core/auth';
import { MONEY_PATTERN, moneyDecimal } from '../core/money';
import { PrismaService } from '../core/prisma.service';

const STAFF = ['OPS', 'OPS_MANAGER'] as const;

@Injectable()
export class SettlementImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async template(user: AuthUser) {
    assertBusinessWrite(user);
    assertRole(user, [...STAFF]);
    const where: Prisma.SettlementWhereInput = { status: { in: ['PENDING_ENTRY', 'PENDING_REVIEW'] } };
    if (user.role === 'OPS') where.company = { ownerId: user.id };
    const rows = await this.prisma.settlement.findMany({
      where,
      include: { lines: { select: { id: true, lineAmountCny: true } } },
      orderBy: { code: 'asc' },
      take: 500,
    });
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('结算单');
    sheet.addRow(['结算单号', '应结金额', '内部说明', '对客户说明', '修改原因']);
    for (const row of rows) {
      sheet.addRow([row.code, row.amountCny ? row.amountCny.toFixed(2) : '', row.internalNote, row.clientNote, '']);
    }
    const lines = book.addWorksheet('明细');
    lines.addRow(['结算单号', '明细ID', '明细金额']);
    for (const row of rows) {
      for (const line of row.lines) lines.addRow([row.code, line.id, line.lineAmountCny ? line.lineAmountCny.toFixed(2) : '']);
    }
    return Buffer.from(await book.xlsx.writeBuffer());
  }

  async preview(user: AuthUser, file: Express.Multer.File | undefined) {
    assertBusinessWrite(user);
    assertRole(user, [...STAFF]);
    if (!file?.buffer?.length) throw new BadRequestException('请上传 xlsx 文件');
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(file.buffer as unknown as ExcelJS.Buffer);
    const sheet = book.getWorksheet('结算单') || book.worksheets[0];
    if (!sheet) throw new BadRequestException('工作表为空');
    const headers = headerMap(sheet);
    const lineSheet = book.getWorksheet('明细');
    const lineHeaders = lineSheet ? headerMap(lineSheet) : new Map<string, number>();
    const lineAmounts = new Map<string, { lineId: string; amount: string }[]>();
    if (lineSheet) {
      lineSheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const code = cell(row, lineHeaders.get('结算单号'));
        const lineId = cell(row, lineHeaders.get('明细ID'));
        const amount = cell(row, lineHeaders.get('明细金额'));
        if (!code || !lineId || !amount) return;
        const list = lineAmounts.get(code) ?? [];
        list.push({ lineId, amount });
        lineAmounts.set(code, list);
      });
    }
    const parsed: {
      settlementCode: string;
      amountCny: string;
      internalNote: string;
      clientNote: string;
      reason: string;
      lines: { lineId: string; amount: string }[];
    }[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const settlementCode = cell(row, headers.get('结算单号'));
      if (!settlementCode) return;
      parsed.push({
        settlementCode,
        amountCny: cell(row, headers.get('应结金额')),
        internalNote: cell(row, headers.get('内部说明')),
        clientNote: cell(row, headers.get('对客户说明')),
        reason: cell(row, headers.get('修改原因')),
        lines: lineAmounts.get(settlementCode) ?? [],
      });
    });
    if (!parsed.length) throw new BadRequestException('没有结算单行');

    const code = await this.prisma.$transaction((tx) => nextCode(tx, 'SA'));
    const batch = await this.prisma.settlementImportBatch.create({
      data: { code, fileName: file.originalname || 'amounts.xlsx', createdById: user.id },
    });
    for (const item of parsed) {
      const judged = await this.judge(user, item);
      await this.prisma.settlementImportRow.create({
        data: {
          batchId: batch.id,
          settlementId: judged.settlementId,
          settlementCode: item.settlementCode,
          kind: judged.kind,
          amountCny: item.amountCny,
          previousAmount: judged.previousAmount,
          internalNote: item.internalNote,
          clientNote: item.clientNote,
          reason: item.reason,
          errorReason: judged.errorReason,
          lines: item.lines,
        },
      });
    }
    await this.audit.write(user.id, 'settlement.import.preview', 'SettlementImportBatch', batch.id, { rows: parsed.length });
    return this.present(batch.id);
  }

  async confirm(user: AuthUser, id: string) {
    assertBusinessWrite(user);
    assertRole(user, [...STAFF]);
    const batch = assertFound(
      await this.prisma.settlementImportBatch.findUnique({ where: { id }, include: { rows: true } }),
      '导入批次不存在',
    );
    if (batch.status === 'CONFIRMED') throw new BadRequestException('这批已经导入过');
    for (const row of batch.rows) {
      if (row.kind !== 'NEW' && row.kind !== 'MODIFY') continue;
      if (!row.settlementId) continue;
      try {
        await this.prisma.$transaction(async (tx) => {
          const current = assertFound(await tx.settlement.findUnique({ where: { id: row.settlementId! }, include: { lines: true, company: true } }), '结算单不存在');
          if (user.role === 'OPS') assertCompanyAccess(user, current.company);
          if (!['PENDING_ENTRY', 'PENDING_REVIEW'].includes(current.status)) throw new BadRequestException('当前状态不能导入金额');
          const amount = moneyDecimal(row.amountCny);
          const lineInputs = (row.lines ?? []) as { lineId: string; amount: string }[];
          if (lineInputs.length) {
            const sum = lineInputs.reduce((acc, line) => acc.plus(moneyDecimal(line.amount)), new Prisma.Decimal(0));
            if (!sum.equals(amount)) throw new BadRequestException('明细合计与应结金额不一致');
            for (const line of lineInputs) {
              const hit = current.lines.find((item) => item.id === line.lineId);
              if (!hit) throw new BadRequestException('明细不属于这张结算单');
              await tx.settlementLine.update({ where: { id: line.lineId }, data: { lineAmountCny: moneyDecimal(line.amount) } });
            }
          }
          await tx.settlement.update({
            where: { id: current.id },
            data: {
              amountCny: amount,
              internalNote: row.internalNote || current.internalNote,
              clientNote: row.clientNote,
              enteredById: user.id,
              enteredAt: new Date(),
              status: 'PENDING_REVIEW',
              reviewedById: null,
              reviewedAt: null,
            },
          });
          await tx.settlementLog.create({
            data: {
              settlementId: current.id,
              action: row.kind === 'MODIFY' ? 'Excel 修改应结金额' : 'Excel 录入应结金额',
              actorId: user.id,
              reason: row.reason,
              before: { amountCny: current.amountCny?.toFixed(2) ?? null },
              after: { amountCny: amount.toFixed(2), batch: batch.code },
            },
          });
        });
        await this.prisma.settlementImportRow.update({ where: { id: row.id }, data: { applied: true } });
      } catch (error) {
        const message = error instanceof Error ? error.message : '导入失败';
        await this.prisma.settlementImportRow.update({ where: { id: row.id }, data: { kind: 'ERROR', errorReason: message, applied: false } });
      }
    }
    await this.prisma.settlementImportBatch.update({ where: { id }, data: { status: 'CONFIRMED' } });
    await this.audit.write(user.id, 'settlement.import.confirm', 'SettlementImportBatch', id, { code: batch.code });
    return this.present(id);
  }

  private async judge(
    user: AuthUser,
    item: { settlementCode: string; amountCny: string; internalNote: string; reason: string; lines: { lineId: string; amount: string }[] },
  ) {
    const settlement = await this.prisma.settlement.findUnique({ where: { code: item.settlementCode }, include: { company: true, lines: true } });
    if (!settlement) return { kind: 'ERROR', settlementId: null as string | null, previousAmount: '', errorReason: '找不到结算单' };
    if (user.role === 'OPS' && settlement.company.ownerId !== user.id) {
      return { kind: 'ERROR', settlementId: settlement.id, previousAmount: '', errorReason: '不在负责范围' };
    }
    if (!['PENDING_ENTRY', 'PENDING_REVIEW'].includes(settlement.status)) {
      return { kind: 'ERROR', settlementId: settlement.id, previousAmount: settlement.amountCny?.toFixed(2) ?? '', errorReason: '当前状态不能导入金额' };
    }
    const previousAmount = settlement.amountCny?.toFixed(2) ?? '';
    if (!item.amountCny) return { kind: 'UNCHANGED', settlementId: settlement.id, previousAmount, errorReason: '' };
    if (!MONEY_PATTERN.test(item.amountCny)) {
      return { kind: 'ERROR', settlementId: settlement.id, previousAmount, errorReason: '金额最多保留两位小数' };
    }
    if (item.lines.some((line) => !MONEY_PATTERN.test(line.amount))) {
      return { kind: 'ERROR', settlementId: settlement.id, previousAmount, errorReason: '明细金额最多保留两位小数' };
    }
    if (item.lines.length) {
      const sum = item.lines.reduce((acc, line) => acc.plus(moneyDecimal(line.amount)), new Prisma.Decimal(0));
      if (!sum.equals(moneyDecimal(item.amountCny))) {
        return { kind: 'ERROR', settlementId: settlement.id, previousAmount, errorReason: '明细合计与应结金额不一致' };
      }
      if (item.lines.some((line) => !settlement.lines.some((owned) => owned.id === line.lineId))) {
        return { kind: 'ERROR', settlementId: settlement.id, previousAmount, errorReason: '明细不属于这张结算单' };
      }
    }
    const same = previousAmount && previousAmount === moneyDecimal(item.amountCny).toFixed(2);
    if (same) return { kind: 'UNCHANGED', settlementId: settlement.id, previousAmount, errorReason: '' };
    if (!item.internalNote.trim()) return { kind: 'ERROR', settlementId: settlement.id, previousAmount, errorReason: '请填写内部说明' };
    if (previousAmount && !item.reason.trim()) return { kind: 'ERROR', settlementId: settlement.id, previousAmount, errorReason: '修改已有金额时请填写原因' };
    return { kind: previousAmount ? 'MODIFY' : 'NEW', settlementId: settlement.id, previousAmount, errorReason: '' };
  }

  private async present(id: string) {
    const batch = assertFound(
      await this.prisma.settlementImportBatch.findUnique({ where: { id }, include: { rows: { orderBy: { settlementCode: 'asc' } } } }),
      '导入批次不存在',
    );
    const summary = {
      total: batch.rows.length,
      created: batch.rows.filter((row) => row.kind === 'NEW').length,
      modified: batch.rows.filter((row) => row.kind === 'MODIFY').length,
      unchanged: batch.rows.filter((row) => row.kind === 'UNCHANGED').length,
      error: batch.rows.filter((row) => row.kind === 'ERROR').length,
    };
    return { ...batch, summary };
  }
}

function headerMap(sheet: ExcelJS.Worksheet) {
  const map = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, col) => {
    const text = String(cell.value ?? '').trim();
    if (text) map.set(text, col);
  });
  return map;
}

function cell(row: ExcelJS.Row, col?: number) {
  if (!col) return '';
  const value = row.getCell(col).value;
  if (value == null) return '';
  if (typeof value === 'number') {
    const text = value.toString();
    return /e/i.test(text) ? value.toFixed(8).replace(/0+$/, '').replace(/\.$/, '') : text;
  }
  if (typeof value === 'object' && value && 'result' in value) return String(value.result ?? '').trim();
  return String(value).trim();
}
