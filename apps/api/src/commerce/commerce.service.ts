import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, SettlementStatus } from '@prisma/client';
import { CONTRACT_LABEL, SETTLEMENT_LABEL } from '@shortform/shared';
import { z } from 'zod';
import { assertCompanyAccess, assertFound } from '../core/access';
import { AuditService } from '../core/audit.service';
import { assertRole, AuthUser, day, nextCode } from '../core/auth';
import { PrismaService } from '../core/prisma.service';
import { SettingsService } from '../core/settings.service';
import {
  contractCreateSchema,
  contractPatchSchema,
  invoiceReviewSchema,
  invoiceSchema,
  pageSchema,
  paySchema,
  policySchema,
  rateSchema,
  settlementAmountSchema,
  settlementGenerateSchema,
  settlementReviewSchema,
  withdrawalCreateSchema,
} from '@shortform/shared';

const OPEN_FOR_WITHDRAW: SettlementStatus[] = ['PENDING_APPLY', 'BELOW_MINIMUM'];
const CONTRACT_NEXT: Record<string, string[]> = {
  APPLYING: ['DRAFTING'],
  DRAFTING: ['PENDING_SIGN'],
  PENDING_SIGN: ['EFFECTIVE', 'DRAFTING'],
  EFFECTIVE: ['EXPIRED'],
  EXPIRED: [],
};

@Injectable()
export class CommerceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
  ) {}

  async listContracts(user: AuthUser, query: { page: number; pageSize: number; status?: string }) {
    const where: Prisma.ContractWhereInput = {};
    if (user.role === 'CLIENT') where.companyId = user.companyId!;
    else if (user.role === 'OPS') where.company = { ownerId: user.id };
    if (query.status) where.status = query.status as never;
    const [items, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        include: { company: { select: { id: true, name: true } }, dramas: { include: { drama: { select: { id: true, title: true, code: true } } } } },
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.contract.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async createContract(user: AuthUser, input: z.infer<typeof contractCreateSchema>) {
    if (user.role !== 'CLIENT' || !user.companyId) throw new ForbiddenException('只有客户可以申请合同');
    const company = assertFound(await this.prisma.company.findUnique({ where: { id: user.companyId } }));
    if (!['APPROVED', 'CHANGE_PENDING'].includes(company.certStatus)) throw new BadRequestException('企业认证通过后才能申请合同');
    const dramas = await this.prisma.drama.findMany({ where: { id: { in: input.dramaIds }, companyId: company.id } });
    if (dramas.length !== input.dramaIds.length) throw new BadRequestException('有剧目不属于当前企业');
    const contract = await this.prisma.$transaction(async (tx) => {
      const created = await tx.contract.create({
        data: {
          code: await nextCode(tx, 'HT'),
          companyId: company.id,
          planId: input.planId,
          title: input.title,
          type: input.type,
          note: input.note ?? '',
          dramas: { create: input.dramaIds.map((dramaId) => ({ dramaId })) },
        },
      });
      return created;
    });
    await this.audit.write(user.id, 'contract.create', 'Contract', contract.id);
    return this.prisma.contract.findUnique({ where: { id: contract.id }, include: { dramas: { include: { drama: true } } } });
  }

  async patchContract(user: AuthUser, id: string, input: z.infer<typeof contractPatchSchema>) {
    assertRole(user, ['OPS', 'BD', 'ADMIN', 'FINANCE']);
    const contract = assertFound(await this.prisma.contract.findUnique({ where: { id }, include: { company: true } }));
    if (user.role === 'OPS') assertCompanyAccess(user, contract.company);
    if (input.status && input.status !== contract.status && !CONTRACT_NEXT[contract.status]?.includes(input.status)) {
      const from = CONTRACT_LABEL[contract.status] || contract.status;
      const to = CONTRACT_LABEL[input.status] || input.status;
      throw new BadRequestException(`合同不能从「${from}」直接改为「${to}」`);
    }
    const updated = await this.prisma.contract.updateMany({
      where: { id, status: contract.status },
      data: { status: input.status, fileKey: input.fileKey, note: input.note },
    });
    if (updated.count !== 1) throw new ConflictException('合同状态已变化，请刷新');
    return this.prisma.contract.findUnique({ where: { id }, include: { company: true, dramas: { include: { drama: true } } } });
  }

  async getPolicy(user: AuthUser, companyId: string) {
    await this.readCompany(user, companyId);
    const [companyPolicy, plans] = await Promise.all([
      this.prisma.settlementPolicy.findUnique({ where: { companyId } }),
      this.prisma.projectSettlementPolicy.findMany({ where: { plan: { companyId } }, include: { plan: { select: { id: true, code: true, round: true, drama: { select: { title: true } } } } } }),
    ]);
    return { companyPolicy, projects: plans };
  }

  async putCompanyPolicy(user: AuthUser, companyId: string, input: z.infer<typeof policySchema>) {
    assertRole(user, ['OPS', 'FINANCE', 'ADMIN']);
    await this.readCompany(user, companyId);
    return this.prisma.settlementPolicy.upsert({
      where: { companyId },
      create: { companyId, cycleType: input.cycleType, customDays: input.customDays, anchorDate: day(input.anchorDate), note: input.note ?? '' },
      update: { cycleType: input.cycleType, customDays: input.customDays, anchorDate: day(input.anchorDate), note: input.note ?? '' },
    });
  }

  async putProjectPolicy(user: AuthUser, planId: string, input: z.infer<typeof policySchema>) {
    assertRole(user, ['OPS', 'FINANCE', 'ADMIN']);
    const plan = assertFound(await this.prisma.distributionPlan.findUnique({ where: { id: planId }, include: { company: true } }));
    if (user.role === 'OPS') assertCompanyAccess(user, plan.company);
    return this.prisma.projectSettlementPolicy.upsert({
      where: { planId },
      create: { planId, cycleType: input.cycleType, customDays: input.customDays, anchorDate: day(input.anchorDate), note: input.note ?? '', carryoverNote: input.carryoverNote ?? '' },
      update: { cycleType: input.cycleType, customDays: input.customDays, anchorDate: day(input.anchorDate), note: input.note ?? '', carryoverNote: input.carryoverNote ?? '' },
    });
  }

  async listSettlements(user: AuthUser, query: { page: number; pageSize: number; status?: string; companyId?: string }) {
    const where: Prisma.SettlementWhereInput = {};
    if (user.role === 'CLIENT') where.companyId = user.companyId!;
    else if (user.role === 'OPS') where.company = { ownerId: user.id };
    if (query.status) where.status = query.status as never;
    if (query.companyId && user.role !== 'CLIENT') where.companyId = query.companyId;
    const [rows, total] = await Promise.all([
      this.prisma.settlement.findMany({
        where,
        include: { company: { select: { id: true, name: true } } },
        orderBy: { periodEnd: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.settlement.count({ where }),
    ]);
    return { items: rows.map((row) => this.presentSettlement(row, user)), total, page: query.page, pageSize: query.pageSize, minWithdrawAmount: (await this.settings.all()).minWithdrawAmount };
  }

  async getSettlement(user: AuthUser, id: string) {
    const row = assertFound(
      await this.prisma.settlement.findUnique({
        where: { id },
        include: { lines: { include: { drama: { select: { title: true, code: true } } } }, logs: { orderBy: { createdAt: 'asc' } }, company: true },
      }),
    );
    if (user.role === 'CLIENT' || user.role === 'OPS') assertCompanyAccess(user, row.company);
    return this.presentSettlement(row, user);
  }

  async generate(user: AuthUser, input: z.infer<typeof settlementGenerateSchema>) {
    assertRole(user, ['OPS', 'FINANCE', 'ADMIN']);
    const company = await this.readCompany(user, input.companyId);
    if (user.role === 'OPS') assertCompanyAccess(user, company);
    const start = day(input.periodStart);
    const end = day(input.periodEnd);
    if (end < start) throw new BadRequestException('结算周期结束日不能早于开始日');
    const existing = await this.prisma.settlement.findUnique({ where: { companyId_periodStart_periodEnd: { companyId: company.id, periodStart: start, periodEnd: end } } });
    if (existing) return this.getSettlement(user, existing.id);
    const stats = await this.prisma.dailyStat.findMany({
      where: { companyId: company.id, statDate: { gte: start, lte: end }, status: { in: ['REVIEWED', 'LOCKED'] } },
    });
    const buckets = new Map<string, { dramaId: string; platformId: string; currency: string; amount: Prisma.Decimal }>();
    for (const stat of stats) {
      const key = `${stat.dramaId}:${stat.platformId}:${stat.currency}`;
      const current = buckets.get(key) ?? { dramaId: stat.dramaId, platformId: stat.platformId, currency: stat.currency, amount: new Prisma.Decimal(0) };
      current.amount = current.amount.plus(stat.netRevenue ?? 0);
      buckets.set(key, current);
    }
    const platforms = await this.prisma.platform.findMany({ where: { id: { in: [...new Set([...buckets.values()].map((item) => item.platformId))] } } });
    const shares = await this.prisma.shareConfig.findMany({
      where: { reviewStatus: 'APPROVED', plan: { companyId: company.id } },
      include: { plan: { select: { dramaId: true, updatedAt: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    let reference = new Prisma.Decimal(0);
    const lines: Prisma.SettlementLineCreateWithoutSettlementInput[] = [];
    for (const bucket of buckets.values()) {
      const rate = await this.rateFor(bucket.currency, end);
      const referenceCny = rate ? bucket.amount.mul(rate.value) : null;
      if (referenceCny) reference = reference.plus(referenceCny);
      const share = shares.find((item) => item.plan.dramaId === bucket.dramaId && item.platformId === bucket.platformId);
      lines.push({
        drama: { connect: { id: bucket.dramaId } },
        platformId: bucket.platformId,
        platformName: platforms.find((item) => item.id === bucket.platformId)?.name || bucket.platformId,
        currency: bucket.currency,
        originalAmount: bucket.amount,
        rateValue: rate?.value ?? null,
        rateDate: rate?.rateDate ?? null,
        rateSource: rate ? rate.source : bucket.currency === 'CNY' ? '人民币原币' : '缺少汇率，参考换算不可用',
        referenceCny,
        shareMode: share?.mode ?? '',
        clientRate: share?.clientRate ?? null,
        guaranteeAmount: share?.guaranteeAmount ?? null,
      });
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const settlement = await tx.settlement.create({
        data: {
          code: await nextCode(tx, 'JS'),
          companyId: company.id,
          periodStart: start,
          periodEnd: end,
          status: 'PENDING_ENTRY',
          referenceCny: reference,
          lines: { create: lines },
        },
      });
      await tx.settlementLog.create({ data: { settlementId: settlement.id, action: '生成结算单', actorId: user.id, after: { lines: lines.length, reference: reference.toFixed(2) } } });
      return settlement;
    });
    await this.audit.write(user.id, 'settlement.generate', 'Settlement', created.id);
    return this.getSettlement(user, created.id);
  }

  async enterAmount(user: AuthUser, id: string, input: z.infer<typeof settlementAmountSchema>) {
    assertRole(user, ['OPS', 'ADMIN']);
    const row = assertFound(await this.prisma.settlement.findUnique({ where: { id }, include: { company: true, lines: true } }));
    if (user.role === 'OPS') assertCompanyAccess(user, row.company);
    if (['VERIFYING', 'PENDING_INVOICE', 'INVOICE_REVIEW', 'PAYING', 'PAID', 'NO_SETTLEMENT'].includes(row.status)) {
      throw new BadRequestException('结算单已进入提款流程，不能直接改金额');
    }
    if (row.status !== 'PENDING_ENTRY' && !input.reason) throw new BadRequestException('修改已有金额时请填写原因');
    const amount = new Prisma.Decimal(input.amountCny);
    if (input.lines?.length) {
      const sum = input.lines.reduce((acc, line) => acc.plus(line.amountCny), new Prisma.Decimal(0));
      if (!sum.equals(amount)) throw new BadRequestException('分行金额合计需要等于应结金额');
    }
    const settings = await this.settings.all();
    const deviation = row.referenceCny && !row.referenceCny.isZero() ? amount.minus(row.referenceCny).div(row.referenceCny).mul(100) : null;
    await this.prisma.$transaction(async (tx) => {
      await tx.settlement.update({
        where: { id },
        data: {
          amountCny: amount,
          internalNote: input.internalNote,
          clientNote: input.clientNote ?? '',
          enteredById: user.id,
          enteredAt: new Date(),
          status: 'PENDING_REVIEW',
          deviationPct: deviation,
          reviewedById: null,
          reviewedAt: null,
        },
      });
      if (input.lines) {
        for (const line of input.lines) {
          await tx.settlementLine.updateMany({ where: { id: line.lineId, settlementId: id }, data: { lineAmountCny: new Prisma.Decimal(line.amountCny) } });
        }
      }
      await tx.settlementLog.create({
        data: {
          settlementId: id,
          action: row.amountCny == null ? '录入应结金额' : '修改应结金额',
          actorId: user.id,
          before: { amountCny: row.amountCny?.toFixed(2) ?? null },
          after: { amountCny: amount.toFixed(2) },
          reason: input.reason ?? input.internalNote,
        },
      });
      await this.rebalance(tx, row.companyId);
    });
    const warning = deviation && deviation.abs().greaterThan(settings.deviationPct) ? `与参考换算相差 ${deviation.toFixed(2)}%，超过 ${settings.deviationPct}% 提示线，仍可提交` : null;
    const settlement = await this.getSettlement(user, id);
    return { ...settlement, warning };
  }

  async reviewSettlement(user: AuthUser, id: string, input: z.infer<typeof settlementReviewSchema>) {
    assertRole(user, ['FINANCE', 'ADMIN'], '应结金额由财务或管理员复核');
    const row = assertFound(await this.prisma.settlement.findUnique({ where: { id } }));
    if (row.status !== 'PENDING_REVIEW') throw new BadRequestException('当前不是待复核');
    if (!row.enteredById || row.amountCny == null) throw new BadRequestException('还没有录入金额');
    if (row.enteredById === user.id) throw new ForbiddenException('录入人不能复核自己录入的金额');
    if (!input.pass && !input.reason) throw new BadRequestException('退回时请填写原因');
    await this.prisma.$transaction(async (tx) => {
      const status: SettlementStatus = !input.pass ? 'PENDING_ENTRY' : row.amountCny!.isZero() ? 'NO_SETTLEMENT' : 'PENDING_APPLY';
      await tx.settlement.update({ where: { id }, data: { status, reviewedById: user.id, reviewedAt: new Date() } });
      await tx.settlementLog.create({ data: { settlementId: id, action: input.pass ? '复核通过' : '复核退回', actorId: user.id, reason: input.reason ?? '', after: { status } } });
      await this.rebalance(tx, row.companyId);
    });
    return this.getSettlement(user, id);
  }

  async listWithdrawals(user: AuthUser, query: { page: number; pageSize: number }) {
    const where: Prisma.WithdrawalWhereInput = {};
    if (user.role === 'CLIENT') where.companyId = user.companyId!;
    else if (user.role === 'OPS') where.company = { ownerId: user.id };
    const [items, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where,
        include: { bankAccount: true, settlements: { select: { id: true, code: true, amountCny: true } }, company: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.withdrawal.count({ where }),
    ]);
    return { items: items.map((item) => this.presentWithdrawal(item, user)), total, page: query.page, pageSize: query.pageSize };
  }

  async createWithdrawal(user: AuthUser, input: z.infer<typeof withdrawalCreateSchema>) {
    if (user.role !== 'CLIENT' || !user.companyId) throw new ForbiddenException('只有客户可以提款');
    const company = assertFound(await this.prisma.company.findUnique({ where: { id: user.companyId } }));
    if (company.certStatus !== 'APPROVED') throw new BadRequestException(company.certStatus === 'CHANGE_PENDING' ? '主体变更审核期间暂停提款' : '企业认证通过后才能提款');
    const bank = assertFound(await this.prisma.bankAccount.findFirst({ where: { id: input.bankAccountId, companyId: company.id } }), '收款账户不存在');
    if (bank.accountName !== company.name) throw new BadRequestException('收款户名需要与认证主体一致');
    const min = new Prisma.Decimal((await this.settings.all()).minWithdrawAmount);
    const created = await this.prisma.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const hit = await tx.idempotencyKey.findUnique({ where: { id: `${user.id}:${input.idempotencyKey}` } });
        if (hit) return hit.body as { id: string };
      }
      const rows = await tx.settlement.findMany({ where: { id: { in: input.settlementIds }, companyId: company.id, status: 'PENDING_APPLY' } });
      if (rows.length !== input.settlementIds.length) throw new BadRequestException('只能申请状态为「待申请」的结算单');
      const sum = rows.reduce((acc, row) => acc.plus(row.amountCny ?? 0), new Prisma.Decimal(0));
      if (sum.lessThan(min)) throw new BadRequestException(`未满最低提款额 ${min.toFixed(2)} 元`);
      const withdrawal = await tx.withdrawal.create({
        data: { code: await nextCode(tx, 'TX'), companyId: company.id, bankAccountId: bank.id, amountCny: sum, status: 'VERIFYING' },
      });
      await tx.settlement.updateMany({ where: { id: { in: rows.map((row) => row.id) } }, data: { status: 'VERIFYING', withdrawalId: withdrawal.id } });
      const body = { id: withdrawal.id, code: withdrawal.code, amountCny: sum.toFixed(2) };
      if (input.idempotencyKey) {
        await tx.idempotencyKey.create({ data: { id: `${user.id}:${input.idempotencyKey}`, userId: user.id, body } });
      }
      return body;
    });
    await this.audit.write(user.id, 'withdrawal.create', 'Withdrawal', created.id);
    return created;
  }

  async verifyWithdrawal(user: AuthUser, id: string, pass: boolean, reason?: string) {
    assertRole(user, ['FINANCE', 'ADMIN']);
    const row = await this.mustWithdrawal(id, 'VERIFYING');
    if (!pass) {
      await this.release(row.id, 'PENDING_APPLY', user.id, reason || '财务退回');
      return this.prisma.withdrawal.findUnique({ where: { id } });
    }
    await this.syncStatus(id, 'PENDING_INVOICE');
    return this.prisma.withdrawal.findUnique({ where: { id }, include: { settlements: true } });
  }

  async uploadInvoice(user: AuthUser, id: string, input: z.infer<typeof invoiceSchema>) {
    if (user.role !== 'CLIENT') throw new ForbiddenException('请客户上传发票');
    const row = await this.mustWithdrawal(id, 'PENDING_INVOICE');
    if (row.companyId !== user.companyId) throw new ForbiddenException('不能操作别人的提款');
    await this.prisma.withdrawal.update({ where: { id }, data: { invoiceKey: input.invoiceKey, invoiceNo: input.invoiceNo, invoiceRejectReason: null, status: 'INVOICE_REVIEW' } });
    await this.prisma.settlement.updateMany({ where: { withdrawalId: id }, data: { status: 'INVOICE_REVIEW' } });
    return this.prisma.withdrawal.findUnique({ where: { id } });
  }

  async reviewInvoice(user: AuthUser, id: string, input: z.infer<typeof invoiceReviewSchema>) {
    assertRole(user, ['FINANCE', 'ADMIN']);
    await this.mustWithdrawal(id, 'INVOICE_REVIEW');
    if (!input.pass && !input.reason) throw new BadRequestException('驳回发票时请填写原因');
    if (!input.pass) {
      await this.prisma.withdrawal.update({ where: { id }, data: { status: 'PENDING_INVOICE', invoiceRejectReason: input.reason } });
      await this.prisma.settlement.updateMany({ where: { withdrawalId: id }, data: { status: 'PENDING_INVOICE' } });
      const row = assertFound(await this.prisma.withdrawal.findUnique({ where: { id } }));
      const code = await this.prisma.$transaction((tx) => nextCode(tx, 'GD', 5));
      await this.prisma.ticket.create({
        data: { code, companyId: row.companyId, type: 'SETTLEMENT_DISPUTE', status: 'PENDING_CLIENT', title: '发票需要重开', body: input.reason || '发票未通过', createdById: user.id },
      });
    } else {
      await this.syncStatus(id, 'PAYING');
    }
    await this.audit.write(user.id, input.pass ? 'invoice.pass' : 'invoice.reject', 'Withdrawal', id);
    return this.prisma.withdrawal.findUnique({ where: { id } });
  }

  async pay(user: AuthUser, id: string, input: z.infer<typeof paySchema>) {
    assertRole(user, ['FINANCE', 'ADMIN']);
    await this.mustWithdrawal(id, 'PAYING');
    const paidAt = new Date();
    await this.prisma.withdrawal.update({ where: { id }, data: { status: 'PAID', voucherKey: input.voucherKey, paidAt } });
    await this.prisma.settlement.updateMany({ where: { withdrawalId: id }, data: { status: 'PAID' } });
    await this.audit.write(user.id, 'withdrawal.paid', 'Withdrawal', id);
    return this.prisma.withdrawal.findUnique({ where: { id } });
  }

  async listRates() {
    return this.prisma.exchangeRate.findMany({ where: { voidedAt: null }, orderBy: { rateDate: 'desc' }, take: 200 });
  }

  async addRate(user: AuthUser, input: z.infer<typeof rateSchema>) {
    assertRole(user, ['FINANCE', 'ADMIN']);
    const created = await this.prisma.exchangeRate.create({
      data: { pair: input.pair, rateDate: day(input.rateDate), value: new Prisma.Decimal(input.value), source: input.source, createdById: user.id },
    });
    await this.audit.write(user.id, 'rate.create', 'ExchangeRate', created.id, { pair: input.pair, value: input.value });
    return created;
  }

  private async rateFor(currency: string, on: Date) {
    if (currency === 'CNY') return { value: new Prisma.Decimal(1), rateDate: on, source: '人民币' };
    return this.prisma.exchangeRate.findFirst({ where: { pair: `${currency}->CNY`, voidedAt: null, rateDate: { lte: on } }, orderBy: { rateDate: 'desc' } });
  }

  private async rebalance(tx: Prisma.TransactionClient, companyId: string) {
    const min = new Prisma.Decimal((await this.settings.all()).minWithdrawAmount);
    const open = await tx.settlement.findMany({ where: { companyId, status: { in: OPEN_FOR_WITHDRAW } } });
    if (!open.length) return;
    const sum = open.reduce((acc, row) => acc.plus(row.amountCny ?? 0), new Prisma.Decimal(0));
    const status: SettlementStatus = sum.greaterThanOrEqualTo(min) ? 'PENDING_APPLY' : 'BELOW_MINIMUM';
    await tx.settlement.updateMany({ where: { id: { in: open.map((row) => row.id) } }, data: { status } });
  }

  private async readCompany(user: AuthUser, companyId: string) {
    const company = assertFound(await this.prisma.company.findUnique({ where: { id: companyId } }), '客户不存在');
    if (user.role === 'CLIENT' || user.role === 'OPS') assertCompanyAccess(user, company);
    return company;
  }

  private presentSettlement<T extends { status: string; amountCny: Prisma.Decimal | null; logs?: unknown; internalNote?: string }>(row: T, user: AuthUser) {
    if (user.role !== 'CLIENT') return { ...row, statusLabel: SETTLEMENT_LABEL[row.status] || row.status };
    const hidden = ['PENDING_ENTRY', 'PENDING_REVIEW'].includes(row.status);
    return { ...row, logs: undefined, internalNote: undefined, amountCny: hidden ? null : row.amountCny, statusLabel: hidden ? '核算中' : SETTLEMENT_LABEL[row.status] || row.status };
  }

  private presentWithdrawal<T extends { bankAccount?: { accountNo: string } }>(row: T, user: AuthUser) {
    if (!row.bankAccount || user.role === 'CLIENT' || user.role === 'FINANCE' || user.role === 'ADMIN') return row;
    return { ...row, bankAccount: { ...row.bankAccount, accountNo: `****${row.bankAccount.accountNo.slice(-4)}` } };
  }

  private async mustWithdrawal(id: string, status: SettlementStatus) {
    const row = assertFound(await this.prisma.withdrawal.findUnique({ where: { id } }), '提款单不存在');
    if (row.status !== status) throw new BadRequestException('提款单状态已变化，请刷新');
    return row;
  }

  private async syncStatus(id: string, status: SettlementStatus) {
    await this.prisma.withdrawal.update({ where: { id }, data: { status } });
    await this.prisma.settlement.updateMany({ where: { withdrawalId: id }, data: { status } });
  }

  private async release(id: string, status: SettlementStatus, actorId: string, reason: string) {
    const row = assertFound(await this.prisma.withdrawal.findUnique({ where: { id }, include: { settlements: true } }));
    await this.prisma.$transaction(async (tx) => {
      await tx.settlement.updateMany({ where: { withdrawalId: id }, data: { status, withdrawalId: null } });
      await tx.withdrawal.update({ where: { id }, data: { status: 'NO_SETTLEMENT' } });
      for (const settlement of row.settlements) {
        await tx.settlementLog.create({ data: { settlementId: settlement.id, action: '提款退回', actorId, reason, after: { status } } });
      }
      await this.rebalance(tx, row.companyId);
    });
  }
}

export const listQuery = pageSchema.extend({ status: z.string().optional(), companyId: z.string().optional() });
