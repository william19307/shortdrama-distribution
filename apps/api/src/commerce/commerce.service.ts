import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { ContractStatus, Prisma, SettlementStatus } from '@prisma/client';
import { CONTRACT_LABEL, SETTLEMENT_LABEL } from '@shortform/shared';
import { z } from 'zod';
import { assertCompanyAccess, assertFound } from '../core/access';
import { hidesCommercialTerms, settlementLineDto, stripCommercialKeys } from '../core/viewer-dto';
import { AuditService } from '../core/audit.service';
import { assertBusinessWrite, assertRole, AuthUser, day, nextCode } from '../core/auth';
import { PrismaService } from '../core/prisma.service';
import { SettingsService } from '../core/settings.service';
import { StorageService } from '../core/storage.service';
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
  settlementBatchSchema,
  settlementGenerateSchema,
  settlementReviewSchema,
  withdrawalCreateSchema,
} from '@shortform/shared';

const OPEN_FOR_WITHDRAW: SettlementStatus[] = ['PENDING_APPLY', 'BELOW_MINIMUM'];
const MONEY_READ = ['CLIENT', 'OPS', 'OPS_MANAGER', 'FINANCE', 'ADMIN'] as const;
const CONTRACT_NEXT: Record<string, string[]> = {
  APPLYING: ['DRAFTING'],
  DRAFTING: ['PENDING_SIGN'],
  PENDING_SIGN: ['PENDING_CONFIRM', 'DRAFTING'],
  PENDING_CONFIRM: ['EFFECTIVE', 'PENDING_SIGN'],
  EFFECTIVE: ['EXPIRED'],
  EXPIRED: [],
};
const CONTRACT_CONFIRM_ROLES = ['OPS', 'OPS_MANAGER'];

@Injectable()
export class CommerceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
  ) {}

  async listContracts(user: AuthUser, query: { page: number; pageSize: number; status?: string }) {
    const where: Prisma.ContractWhereInput = {};
    if (user.role === 'CLIENT') where.companyId = user.companyId!;
    else if (user.role === 'OPS') where.company = { ownerId: user.id };
    else if (user.role === 'BD') where.company = { bdId: user.id };
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
    const contract = assertFound(await this.prisma.contract.findUnique({ where: { id }, include: { company: true } }));
    if (user.role === 'FINANCE') throw new ForbiddenException('财务只查看合同，不能修改');
    if (user.role === 'CLIENT') {
      assertCompanyAccess(user, contract.company);
      if (input.status && input.status !== 'PENDING_CONFIRM') throw new ForbiddenException('客户只能上传签署扫描件，不能直接修改合同状态');
      if (contract.status !== 'PENDING_SIGN') throw new BadRequestException('只有待签署的合同可以上传扫描件');
      if (!input.fileKey) throw new BadRequestException('请上传签署扫描件');
      await this.assertContractScan(contract.companyId, input.fileKey);
      return this.writeContract(user, contract, 'PENDING_CONFIRM', input.fileKey, input.note);
    }
    assertBusinessWrite(user);
    assertRole(user, ['OPS', 'OPS_MANAGER', 'BD']);
    if (user.role === 'OPS' || user.role === 'BD') assertCompanyAccess(user, contract.company);
    let nextStatus = input.status ?? contract.status;
    const nextFileKey = input.fileKey !== undefined ? input.fileKey : contract.fileKey;
    if (input.fileKey) {
      if (!['PENDING_SIGN', 'PENDING_CONFIRM'].includes(contract.status)) throw new BadRequestException('请先进入待签署，再上传扫描件');
      await this.assertContractScan(contract.companyId, input.fileKey);
    }
    if (input.fileKey && contract.status === 'PENDING_SIGN' && (!input.status || input.status === 'PENDING_SIGN' || input.status === 'PENDING_CONFIRM')) {
      nextStatus = 'PENDING_CONFIRM';
    }
    if (nextStatus !== contract.status && !CONTRACT_NEXT[contract.status]?.includes(nextStatus)) {
      const from = CONTRACT_LABEL[contract.status] || contract.status;
      const to = CONTRACT_LABEL[nextStatus] || nextStatus;
      throw new BadRequestException(`合同不能从「${from}」直接改为「${to}」，请按 申请中→起草中→待签署→待确认→已生效 推进`);
    }
    if (nextStatus === 'PENDING_CONFIRM' && !nextFileKey) throw new BadRequestException('进入待确认前必须上传签署扫描件（fileKey）');
    if (nextStatus === 'EFFECTIVE') {
      if (contract.status !== 'PENDING_CONFIRM') throw new BadRequestException('合同须先进入「待确认」且上传扫描件后，才能确认生效');
      if (!nextFileKey) throw new BadRequestException('确认生效前必须已上传签署扫描件');
      await this.assertContractScan(contract.companyId, nextFileKey);
      if (!CONTRACT_CONFIRM_ROLES.includes(user.role)) throw new ForbiddenException('仅运营可确认合同生效');
    }
    return this.writeContract(user, contract, nextStatus, input.fileKey, input.note, nextFileKey);
  }

  async getPolicy(user: AuthUser, companyId: string) {
    await this.readCompany(user, companyId);
    const [companyPolicy, plans] = await Promise.all([
      this.prisma.settlementPolicy.findUnique({ where: { companyId } }),
      this.prisma.projectSettlementPolicy.findMany({ where: { plan: { companyId } }, include: { plan: { select: { id: true, code: true, round: true, drama: { select: { title: true } } } } } }),
    ]);
    const projects = hidesCommercialTerms(user.role) ? plans.map((item) => stripCommercialKeys(item as unknown as Record<string, unknown>)) : plans;
    return { companyPolicy, projects };
  }

  async putCompanyPolicy(user: AuthUser, companyId: string, input: z.infer<typeof policySchema>) {
    assertRole(user, ['OPS', 'OPS_MANAGER', 'FINANCE', 'ADMIN']);
    await this.readCompany(user, companyId);
    return this.prisma.settlementPolicy.upsert({
      where: { companyId },
      create: { companyId, cycleType: input.cycleType, customDays: input.customDays, anchorDate: day(input.anchorDate), note: input.note ?? '' },
      update: { cycleType: input.cycleType, customDays: input.customDays, anchorDate: day(input.anchorDate), note: input.note ?? '' },
    });
  }

  async putProjectPolicy(user: AuthUser, planId: string, input: z.infer<typeof policySchema>) {
    assertRole(user, ['OPS', 'OPS_MANAGER', 'FINANCE', 'ADMIN']);
    const plan = assertFound(await this.prisma.distributionPlan.findUnique({ where: { id: planId }, include: { company: true } }));
    if (user.role === 'OPS' || user.role === 'BD') assertCompanyAccess(user, plan.company);
    return this.prisma.projectSettlementPolicy.upsert({
      where: { planId },
      create: { planId, cycleType: input.cycleType, customDays: input.customDays, anchorDate: day(input.anchorDate), note: input.note ?? '', carryoverNote: input.carryoverNote ?? '' },
      update: { cycleType: input.cycleType, customDays: input.customDays, anchorDate: day(input.anchorDate), note: input.note ?? '', carryoverNote: input.carryoverNote ?? '' },
    });
  }

  async listSettlements(user: AuthUser, query: { page: number; pageSize: number; status?: string; companyId?: string }) {
    assertRole(user, [...MONEY_READ], '商务不查看结算单');
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
    assertRole(user, [...MONEY_READ], '商务不查看结算单');
    const row = assertFound(
      await this.prisma.settlement.findUnique({
        where: { id },
        include: { lines: { include: { drama: { select: { title: true, code: true } } } }, logs: { orderBy: { createdAt: 'asc' } }, company: true },
      }),
    );
    if (user.role === 'CLIENT' || user.role === 'OPS' || user.role === 'BD') assertCompanyAccess(user, row.company);
    return this.presentSettlement(row, user);
  }

  async generate(user: AuthUser, input: z.infer<typeof settlementGenerateSchema>) {
    assertBusinessWrite(user);
    assertRole(user, ['OPS', 'OPS_MANAGER', 'FINANCE']);
    const company = await this.readCompany(user, input.companyId);
    if (user.role === 'OPS' || user.role === 'BD') assertCompanyAccess(user, company);
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

  async generateBatch(user: AuthUser, input: z.infer<typeof settlementBatchSchema>) {
    assertBusinessWrite(user);
    assertRole(user, ['OPS', 'OPS_MANAGER', 'FINANCE']);
    const start = day(input.periodStart);
    const end = day(input.periodEnd);
    if (end < start) throw new BadRequestException('结算周期结束日不能早于开始日');
    let companyIds = input.companyIds ?? [];
    if (!companyIds.length) {
      const stats = await this.prisma.dailyStat.findMany({
        where: {
          statDate: { gte: start, lte: end },
          status: { in: ['REVIEWED', 'LOCKED'] },
          ...(user.role === 'OPS' ? { company: { ownerId: user.id } } : {}),
        },
        distinct: ['companyId'],
        select: { companyId: true },
      });
      companyIds = stats.map((item) => item.companyId);
    }
    if (!companyIds.length) return { created: [], existing: [], failed: [], items: [], notice: '这个周期没有已复核的数据' };
    const created = [];
    const existing = [];
    const failed: { companyId: string; name: string; message: string }[] = [];
    const items = [];
    for (const companyId of companyIds) {
      try {
        const before = await this.prisma.settlement.findUnique({ where: { companyId_periodStart_periodEnd: { companyId, periodStart: start, periodEnd: end } } });
        const row = await this.generate(user, { companyId, periodStart: input.periodStart, periodEnd: input.periodEnd });
        items.push(row);
        if (before) existing.push(row);
        else created.push(row);
      } catch (error) {
        const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
        failed.push({ companyId, name: company?.name || companyId, message: error instanceof Error ? error.message : '生成失败' });
      }
    }
    return { created, existing, failed, items };
  }

  async enterAmount(user: AuthUser, id: string, input: z.infer<typeof settlementAmountSchema>) {
    assertBusinessWrite(user);
    assertRole(user, ['OPS', 'OPS_MANAGER']);
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
    assertBusinessWrite(user);
    assertRole(user, ['FINANCE', 'OPS_MANAGER'], '应结金额由财务或运营主管复核');
    const row = assertFound(await this.prisma.settlement.findUnique({ where: { id } }));
    if (row.status !== 'PENDING_REVIEW') throw new BadRequestException('当前不是待复核');
    if (!row.enteredById || row.amountCny == null) throw new BadRequestException('还没有录入金额');
    if (row.enteredById === user.id) throw new ForbiddenException('录入人不能复核自己录入的金额');
    if (!input.pass && !input.reason) throw new BadRequestException('退回时请填写原因');
    await this.prisma.$transaction(async (tx) => {
      const status: SettlementStatus = !input.pass ? 'PENDING_ENTRY' : row.amountCny!.isZero() ? 'NO_SETTLEMENT' : 'PENDING_APPLY';
      const reviewed = await tx.settlement.updateMany({
        where: { id, status: 'PENDING_REVIEW', enteredById: row.enteredById, NOT: { enteredById: user.id } },
        data: { status, reviewedById: user.id, reviewedAt: new Date() },
      });
      if (reviewed.count !== 1) throw new ConflictException('结算单已被修改，请刷新后再复核');
      await tx.settlementLog.create({ data: { settlementId: id, action: input.pass ? '复核通过' : '复核退回', actorId: user.id, reason: input.reason ?? '', after: { status } } });
      await this.rebalance(tx, row.companyId);
    });
    return this.getSettlement(user, id);
  }

  async listWithdrawals(user: AuthUser, query: { page: number; pageSize: number }) {
    assertRole(user, [...MONEY_READ], '商务不查看提款单');
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
    if (!input.idempotencyKey) throw new BadRequestException('提款请求必须携带幂等键');
    const company = assertFound(await this.prisma.company.findUnique({ where: { id: user.companyId } }));
    if (company.certStatus !== 'APPROVED') throw new BadRequestException(company.certStatus === 'CHANGE_PENDING' ? '主体变更审核期间暂停提款' : '企业认证通过后才能提款');
    const bank = assertFound(await this.prisma.bankAccount.findFirst({ where: { id: input.bankAccountId, companyId: company.id } }), '收款账户不存在');
    if (bank.accountName !== company.name) throw new BadRequestException('收款户名需要与认证主体一致');
    const min = new Prisma.Decimal((await this.settings.all()).minWithdrawAmount);
    const created = await this.prisma.$transaction(async (tx) => {
      const hit = await tx.idempotencyKey.findUnique({ where: { id: `${user.id}:${input.idempotencyKey}` } });
      if (hit) return hit.body as { id: string };
      const rows = await tx.settlement.findMany({ where: { id: { in: input.settlementIds }, companyId: company.id, status: 'PENDING_APPLY', withdrawalId: null } });
      if (rows.length !== input.settlementIds.length) throw new BadRequestException('只能申请状态为「待申请」的结算单');
      const sum = rows.reduce((acc, row) => acc.plus(row.amountCny ?? 0), new Prisma.Decimal(0));
      if (sum.lessThan(min)) throw new BadRequestException(`未满最低提款额 ${min.toFixed(2)} 元`);
      const withdrawal = await tx.withdrawal.create({
        data: { code: await nextCode(tx, 'TX'), companyId: company.id, bankAccountId: bank.id, amountCny: sum, status: 'VERIFYING' },
      });
      const locked = await tx.settlement.updateMany({
        where: { id: { in: rows.map((row) => row.id) }, status: 'PENDING_APPLY', withdrawalId: null },
        data: { status: 'VERIFYING', withdrawalId: withdrawal.id },
      });
      if (locked.count !== rows.length) throw new ConflictException('结算单已被其他提款占用，请刷新');
      const body = { id: withdrawal.id, code: withdrawal.code, amountCny: sum.toFixed(2) };
      await tx.idempotencyKey.create({ data: { id: `${user.id}:${input.idempotencyKey}`, userId: user.id, body } });
      return body;
    });
    await this.audit.write(user.id, 'withdrawal.create', 'Withdrawal', created.id);
    return created;
  }

  async verifyWithdrawal(user: AuthUser, id: string, pass: boolean, reason?: string) {
    assertBusinessWrite(user);
    assertRole(user, ['FINANCE']);
    const row = await this.prisma.$transaction(async (tx) => {
      const current = assertFound(await tx.withdrawal.findUnique({ where: { id }, include: { settlements: true } }), '提款单不存在');
      if (current.status !== 'VERIFYING') throw new BadRequestException('提款单状态已变化，请刷新');
      if (!pass) {
        await this.releaseInTx(tx, current, user.id, reason || '财务退回');
        return tx.withdrawal.findUnique({ where: { id } });
      }
      await this.advanceInTx(tx, current, 'VERIFYING', 'PENDING_INVOICE');
      return tx.withdrawal.findUnique({ where: { id }, include: { settlements: true } });
    });
    return row;
  }

  async uploadInvoice(user: AuthUser, id: string, input: z.infer<typeof invoiceSchema>) {
    if (user.role !== 'CLIENT') throw new ForbiddenException('请客户上传发票');
    return this.prisma.$transaction(async (tx) => {
      const current = assertFound(await tx.withdrawal.findUnique({ where: { id }, include: { settlements: true } }), '提款单不存在');
      if (current.companyId !== user.companyId) throw new ForbiddenException('不能操作别人的提款');
      if (current.status !== 'PENDING_INVOICE') throw new BadRequestException('提款单状态已变化，请刷新');
      await this.advanceInTx(tx, current, 'PENDING_INVOICE', 'INVOICE_REVIEW', { invoiceKey: input.invoiceKey, invoiceNo: input.invoiceNo, invoiceRejectReason: null });
      return tx.withdrawal.findUnique({ where: { id } });
    });
  }

  async reviewInvoice(user: AuthUser, id: string, input: z.infer<typeof invoiceReviewSchema>) {
    assertBusinessWrite(user);
    assertRole(user, ['FINANCE']);
    if (!input.pass && !input.reason) throw new BadRequestException('驳回发票时请填写原因');
    const row = await this.prisma.$transaction(async (tx) => {
      const current = assertFound(await tx.withdrawal.findUnique({ where: { id }, include: { settlements: true } }), '提款单不存在');
      if (current.status !== 'INVOICE_REVIEW') throw new BadRequestException('提款单状态已变化，请刷新');
      if (!input.pass) {
        await this.advanceInTx(tx, current, 'INVOICE_REVIEW', 'PENDING_INVOICE', { invoiceRejectReason: input.reason });
        await tx.ticket.create({
          data: {
            code: await nextCode(tx, 'GD', 5),
            companyId: current.companyId,
            type: 'SETTLEMENT_DISPUTE',
            status: 'PENDING_CLIENT',
            title: '发票需要重开',
            body: input.reason || '发票未通过',
            createdById: user.id,
          },
        });
      } else {
        await this.advanceInTx(tx, current, 'INVOICE_REVIEW', 'PAYING');
      }
      return tx.withdrawal.findUnique({ where: { id } });
    });
    await this.audit.write(user.id, input.pass ? 'invoice.pass' : 'invoice.reject', 'Withdrawal', id);
    return row;
  }

  async pay(user: AuthUser, id: string, input: z.infer<typeof paySchema>) {
    assertBusinessWrite(user);
    assertRole(user, ['FINANCE']);
    const paidAt = new Date();
    const row = await this.prisma.$transaction(async (tx) => {
      const current = assertFound(await tx.withdrawal.findUnique({ where: { id }, include: { settlements: true } }), '提款单不存在');
      if (current.status !== 'PAYING') throw new BadRequestException('提款单状态已变化，请刷新');
      await this.advanceInTx(tx, current, 'PAYING', 'PAID', { voucherKey: input.voucherKey, paidAt });
      return tx.withdrawal.findUnique({ where: { id } });
    });
    await this.audit.write(user.id, 'withdrawal.paid', 'Withdrawal', id);
    return row;
  }

  async listRates(user: AuthUser) {
    assertRole(user, ['FINANCE', 'OPS_MANAGER', 'OPS', 'ADMIN']);
    return this.prisma.exchangeRate.findMany({ where: { voidedAt: null }, orderBy: { rateDate: 'desc' }, take: 200 });
  }

  async addRate(user: AuthUser, input: z.infer<typeof rateSchema>) {
    assertRole(user, ['FINANCE', 'ADMIN', 'OPS_MANAGER']);
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
    if (user.role === 'CLIENT' || user.role === 'OPS' || user.role === 'BD') assertCompanyAccess(user, company);
    return company;
  }

  private async assertContractScan(companyId: string, fileKey: string) {
    const head = await this.storage.head(fileKey);
    if (!head) throw new BadRequestException('扫描件在存储中不存在');
    const session = await this.prisma.uploadSession.findFirst({
      where: { key: fileKey, companyId, purpose: 'CONTRACT', status: 'COMPLETED' },
    });
    if (!session) throw new BadRequestException('扫描件不属于该客户');
  }

  private async writeContract(
    user: AuthUser,
    contract: { id: string; status: ContractStatus },
    nextStatus: ContractStatus,
    fileKey: string | undefined,
    note: string | undefined,
    nextFileKey?: string | null,
  ) {
    const updated = await this.prisma.contract.updateMany({
      where: { id: contract.id, status: contract.status },
      data: { status: nextStatus, fileKey, note },
    });
    if (updated.count !== 1) throw new ConflictException('合同状态已变化，请刷新');
    await this.audit.write(user.id, 'contract.patch', 'Contract', contract.id, { from: contract.status, to: nextStatus, fileKey: Boolean(nextFileKey ?? fileKey) });
    return this.prisma.contract.findUnique({ where: { id: contract.id }, include: { company: true, dramas: { include: { drama: true } } } });
  }

  private presentSettlement<T extends { status: string; amountCny: Prisma.Decimal | null; logs?: unknown; internalNote?: string; lines?: Record<string, unknown>[] }>(row: T, user: AuthUser) {
    const statusLabel = SETTLEMENT_LABEL[row.status] || row.status;
    if (!hidesCommercialTerms(user.role)) return { ...row, statusLabel };
    const hidden = ['PENDING_ENTRY', 'PENDING_REVIEW'].includes(row.status);
    const presented: Record<string, unknown> = {
      ...row,
      lines: row.lines?.map((line) => settlementLineDto(line)),
      logs: undefined,
      internalNote: undefined,
      amountCny: hidden ? null : row.amountCny,
      statusLabel: hidden ? '核算中' : statusLabel,
    };
    if (user.role === 'CLIENT') {
      delete presented.referenceCny;
      delete presented.deviationPct;
    }
    return presented;
  }

  private presentWithdrawal<T extends { bankAccount?: { accountNo: string } }>(row: T, user: AuthUser) {
    if (!row.bankAccount || user.role === 'CLIENT' || user.role === 'FINANCE' || user.role === 'ADMIN') return row;
    return { ...row, bankAccount: { ...row.bankAccount, accountNo: `****${row.bankAccount.accountNo.slice(-4)}` } };
  }

  private async advanceInTx(
    tx: Prisma.TransactionClient,
    row: { id: string; settlements: { id: string }[] },
    from: SettlementStatus,
    to: SettlementStatus,
    extra: Prisma.WithdrawalUpdateManyMutationInput = {},
  ) {
    const moved = await tx.withdrawal.updateMany({ where: { id: row.id, status: from }, data: { status: to, ...extra } });
    if (moved.count !== 1) throw new ConflictException('提款单状态已变化，请刷新');
    const lines = await tx.settlement.updateMany({ where: { withdrawalId: row.id, status: from }, data: { status: to } });
    if (lines.count !== row.settlements.length) throw new ConflictException('结算单状态与提款单不一致，请刷新');
  }

  private async releaseInTx(tx: Prisma.TransactionClient, row: { id: string; companyId: string; settlements: { id: string }[] }, actorId: string, reason: string) {
    const unlocked = await tx.settlement.updateMany({ where: { withdrawalId: row.id, status: 'VERIFYING' }, data: { status: 'PENDING_APPLY', withdrawalId: null } });
    if (unlocked.count !== row.settlements.length) throw new ConflictException('结算单状态与提款单不一致，请刷新');
    const closed = await tx.withdrawal.updateMany({ where: { id: row.id, status: 'VERIFYING' }, data: { status: 'NO_SETTLEMENT' } });
    if (closed.count !== 1) throw new ConflictException('提款单状态已变化，请刷新');
    for (const settlement of row.settlements) {
      await tx.settlementLog.create({ data: { settlementId: settlement.id, action: '提款退回', actorId, reason, after: { status: 'PENDING_APPLY' } } });
    }
    await this.rebalance(tx, row.companyId);
  }
}

export const listQuery = pageSchema.extend({ status: z.string().optional(), companyId: z.string().optional() });
