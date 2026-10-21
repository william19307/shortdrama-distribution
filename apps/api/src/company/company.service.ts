import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { bankAccountSchema, certReviewSchema, certSchema, certStep1Schema, certStep2Schema, certStep3Schema, ownerPatchSchema, pageSchema } from '@shortform/shared';
import { assertCompanyAccess, assertFound, maskAccount } from '../core/access';
import { AuditService } from '../core/audit.service';
import { assertBusinessWrite, assertRole, AuthUser } from '../core/auth';
import { PrismaService } from '../core/prisma.service';

type CertInput = z.infer<typeof certSchema>;
type BankInput = z.infer<typeof bankAccountSchema>;
const CERT_LOCKED = ['PENDING', 'CHANGE_PENDING'];
const CERT_REVIEW_DAYS = 1;

@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async myCompany(user: AuthUser) {
    if (!user.companyId) throw new BadRequestException('当前账号没有绑定企业');
    const company = await this.prisma.company.findUnique({
      where: { id: user.companyId },
      include: { bankAccounts: { orderBy: { createdAt: 'desc' } }, policy: true },
    });
    return this.present(assertFound(company, '企业不存在'), user);
  }

  async submitCert(user: AuthUser, input: CertInput) {
    if (user.role !== 'CLIENT' || !user.companyId) throw new BadRequestException('请使用客户账号提交认证');
    const company = assertFound(await this.prisma.company.findUnique({ where: { id: user.companyId } }));
    if (company.certStatus === 'PENDING' || company.certStatus === 'CHANGE_PENDING') {
      throw new BadRequestException('认证正在审核，请等待结果');
    }
    if (company.certStatus === 'APPROVED') {
      await this.prisma.company.update({
        where: { id: company.id },
        data: { certStatus: 'CHANGE_PENDING', certDraft: input, certRejectReason: null, certWizard: Prisma.DbNull, certWizardStep: 0 },
      });
    } else {
      await this.prisma.company.update({
        where: { id: company.id },
        data: {
          name: input.name,
          creditCode: input.creditCode,
          legalPerson: input.legalPerson,
          contactName: input.contactName,
          contactPhone: input.contactPhone,
          licenseKey: input.licenseKey ?? company.licenseKey,
          certStatus: 'PENDING',
          certRejectReason: null,
          certDraft: Prisma.DbNull,
          certWizard: Prisma.DbNull,
          certWizardStep: 0,
        },
      });
    }
    await this.audit.write(user.id, 'cert.submit', 'Company', company.id);
    return this.myCompany(user);
  }

  async getCertWizard(user: AuthUser) {
    const company = await this.wizardCompany(user);
    const data = (company.certWizard ?? {}) as Record<string, Record<string, unknown>>;
    const step3 = data.step3 ? { ...data.step3, accountNo: data.step3.accountNo ? maskAccount(String(data.step3.accountNo)) : undefined } : undefined;
    return {
      certStatus: company.certStatus,
      certRejectReason: company.certRejectReason,
      currentStep: company.certWizardStep,
      editable: !CERT_LOCKED.includes(company.certStatus),
      steps: { step1: data.step1 ?? null, step2: data.step2 ?? null, step3: step3 ?? null },
      prefill: {
        name: company.name,
        creditCode: company.creditCode,
        legalPerson: company.legalPerson,
        contactName: company.contactName,
        contactPhone: company.contactPhone,
        licenseKey: company.licenseKey,
      },
    };
  }

  async saveCertStep(user: AuthUser, step: number, body: unknown) {
    const company = await this.wizardCompany(user);
    if (CERT_LOCKED.includes(company.certStatus)) throw new BadRequestException('认证正在审核，暂不能修改');
    const schema = step === 1 ? certStep1Schema : step === 2 ? certStep2Schema : step === 3 ? certStep3Schema : null;
    if (!schema) throw new BadRequestException('步骤只能是 1、2、3');
    const parsed = schema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join('；'));
    const value = parsed.data as Record<string, unknown>;
    if (step === 1) {
      const key = String(value.licenseKey);
      if (!key.startsWith(`${company.id}/`) && key !== company.licenseKey) throw new BadRequestException('营业执照文件不属于当前企业，请重新上传');
    }
    const data = { ...((company.certWizard ?? {}) as Record<string, unknown>), [`step${step}`]: value };
    await this.prisma.company.update({
      where: { id: company.id },
      data: { certWizard: data as Prisma.InputJsonValue, certWizardStep: Math.max(company.certWizardStep, step) },
    });
    return this.getCertWizard(user);
  }

  async submitCertWizard(user: AuthUser) {
    const company = await this.wizardCompany(user);
    if (CERT_LOCKED.includes(company.certStatus)) throw new BadRequestException('认证正在审核，请等待结果');
    const data = (company.certWizard ?? {}) as { step1?: Record<string, string>; step2?: Record<string, string>; step3?: Record<string, unknown> };
    if (!data.step1) throw new BadRequestException('请先完成第 1 步：上传营业执照');
    const merged = {
      name: data.step1.name ?? company.name,
      creditCode: data.step1.creditCode ?? company.creditCode ?? undefined,
      licenseKey: data.step1.licenseKey,
      legalPerson: data.step2?.legalPerson ?? company.legalPerson ?? undefined,
      contactName: data.step2?.contactName ?? company.contactName ?? undefined,
      contactPhone: data.step2?.contactPhone ?? company.contactPhone ?? undefined,
    };
    const parsed = certSchema.safeParse(merged);
    if (!parsed.success) throw new BadRequestException('资料不完整，请补充后再提交');
    const step3 = data.step3;
    let bankLater = true;
    if (step3 && !step3.skip) {
      const bank = bankAccountSchema.safeParse({
        accountName: step3.accountName ?? parsed.data.name,
        bankName: step3.bankName,
        branch: step3.branch,
        accountNo: step3.accountNo,
        isDefault: true,
      });
      if (!bank.success) throw new BadRequestException(`第 3 步对公账户不完整：${bank.error.issues.map((issue) => issue.message).join('；')}（也可选择「稍后填写」）`);
      const dup = await this.prisma.bankAccount.findFirst({ where: { companyId: company.id, accountNo: bank.data.accountNo } });
      if (!dup) await this.addBank(user, bank.data);
      bankLater = false;
    }
    await this.submitCert(user, parsed.data);
    await this.audit.write(user.id, 'cert.wizard_submit', 'Company', company.id, { bankLater });
    const updated = assertFound(await this.prisma.company.findUnique({ where: { id: company.id } }));
    return {
      certStatus: updated.certStatus,
      bankLater,
      expectedReviewDays: CERT_REVIEW_DAYS,
      tip: `预计 ${CERT_REVIEW_DAYS} 个工作日内完成审核${bankLater ? '；对公账户可在提款时再补充' : ''}`,
    };
  }

  private async wizardCompany(user: AuthUser) {
    if (user.role !== 'CLIENT' || !user.companyId) throw new BadRequestException('请使用客户账号进行企业认证');
    return assertFound(await this.prisma.company.findUnique({ where: { id: user.companyId } }), '企业不存在');
  }

  async list(user: AuthUser, query: { page: number; pageSize: number; q?: string; certStatus?: string }) {
    assertRole(user, ['OPS', 'OPS_MANAGER', 'BD', 'FINANCE', 'ADMIN']);
    const where: Prisma.CompanyWhereInput = {};
    if (user.role === 'OPS') where.ownerId = user.id;
    if (user.role === 'BD') where.bdId = user.id;
    if (query.q) where.OR = [{ name: { contains: query.q, mode: 'insensitive' } }, { creditCode: { contains: query.q, mode: 'insensitive' } }];
    if (query.certStatus) where.certStatus = query.certStatus as never;
    const [items, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        include: { owner: { select: { id: true, name: true } }, bd: { select: { id: true, name: true } }, _count: { select: { dramas: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.company.count({ where }),
    ]);
    return {
      items: items.map((item) => {
        const { certWizard: _wizard, ...rest } = item;
        return rest;
      }),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async detail(user: AuthUser, id: string) {
    const company = assertFound(
      await this.prisma.company.findUnique({
        where: { id },
        include: { bankAccounts: true, owner: { select: { id: true, name: true, email: true } }, bd: { select: { id: true, name: true, email: true } }, policy: true, _count: { select: { dramas: true } } },
      }),
    );
    if (user.role === 'CLIENT' || user.role === 'OPS' || user.role === 'BD') assertCompanyAccess(user, company);
    return this.present(company, user);
  }

  async reviewCert(user: AuthUser, id: string, input: z.infer<typeof certReviewSchema>) {
    assertBusinessWrite(user);
    assertRole(user, ['FINANCE'], '企业认证由财务审核');
    const company = assertFound(await this.prisma.company.findUnique({ where: { id } }));
    if (!input.pass && !input.reason) throw new BadRequestException('驳回时请填写原因');
    if (company.certStatus === 'CHANGE_PENDING') {
      const draft = (company.certDraft ?? {}) as CertInput;
      await this.prisma.company.update({
        where: { id },
        data: input.pass
          ? {
              name: draft.name ?? company.name,
              creditCode: draft.creditCode,
              legalPerson: draft.legalPerson,
              contactName: draft.contactName,
              contactPhone: draft.contactPhone,
              licenseKey: draft.licenseKey ?? company.licenseKey,
              certStatus: 'APPROVED',
              certDraft: Prisma.DbNull,
              certRejectReason: null,
            }
          : { certStatus: 'APPROVED', certDraft: Prisma.DbNull, certRejectReason: input.reason },
      });
    } else if (company.certStatus === 'PENDING') {
      await this.prisma.company.update({
        where: { id },
        data: input.pass ? { certStatus: 'APPROVED', certRejectReason: null } : { certStatus: 'REJECTED', certRejectReason: input.reason },
      });
    } else {
      throw new BadRequestException('当前没有待审核的认证');
    }
    await this.audit.write(user.id, input.pass ? 'cert.approve' : 'cert.reject', 'Company', id, { reason: input.reason });
    return this.detail(user, id);
  }

  async setOwner(user: AuthUser, id: string, input: z.infer<typeof ownerPatchSchema>) {
    assertBusinessWrite(user);
    assertRole(user, ['OPS_MANAGER'], '负责运营由运营主管指定');
    if (input.ownerId) {
      const owner = await this.prisma.user.findUnique({ where: { id: input.ownerId } });
      if (!owner || owner.role !== 'OPS') throw new BadRequestException('负责人必须是运营账号');
    }
    await this.prisma.company.update({ where: { id }, data: { ownerId: input.ownerId } });
    await this.audit.write(user.id, 'company.owner', 'Company', id, { ownerId: input.ownerId });
    return this.detail(user, id);
  }

  async setBd(user: AuthUser, id: string, bdId: string | null) {
    assertBusinessWrite(user);
    assertRole(user, ['OPS_MANAGER'], '负责商务由运营主管指定');
    if (bdId) {
      const bd = await this.prisma.user.findUnique({ where: { id: bdId } });
      if (!bd || bd.role !== 'BD' || bd.disabled) throw new BadRequestException('负责商务必须是在岗商务账号');
    }
    await this.prisma.company.update({ where: { id }, data: { bdId } });
    await this.audit.write(user.id, 'company.bd', 'Company', id, { bdId });
    return this.detail(user, id);
  }

  async listBanks(user: AuthUser) {
    const company = await this.ownClient(user);
    const rows = await this.prisma.bankAccount.findMany({ where: { companyId: company.id }, orderBy: { createdAt: 'desc' } });
    return rows.map((row) => this.presentBank(row, user));
  }

  async addBank(user: AuthUser, input: BankInput) {
    const company = await this.ownClient(user);
    this.assertAccountName(company, input.accountName);
    const created = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault !== false) {
        await tx.bankAccount.updateMany({ where: { companyId: company.id }, data: { isDefault: false } });
      }
      return tx.bankAccount.create({
        data: {
          companyId: company.id,
          accountName: input.accountName,
          bankName: input.bankName,
          branch: input.branch,
          accountNo: input.accountNo,
          isDefault: input.isDefault !== false,
        },
      });
    });
    await this.audit.write(user.id, 'bank.create', 'BankAccount', created.id);
    return this.presentBank(created, user);
  }

  async updateBank(user: AuthUser, id: string, input: Partial<BankInput>) {
    const company = await this.ownClient(user);
    const row = assertFound(await this.prisma.bankAccount.findFirst({ where: { id, companyId: company.id } }));
    if (input.accountName) this.assertAccountName(company, input.accountName);
    const updated = await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) await tx.bankAccount.updateMany({ where: { companyId: company.id }, data: { isDefault: false } });
      return tx.bankAccount.update({
        where: { id: row.id },
        data: {
          accountName: input.accountName,
          bankName: input.bankName,
          branch: input.branch,
          accountNo: input.accountNo,
          isDefault: input.isDefault,
        },
      });
    });
    return this.presentBank(updated, user);
  }

  async removeBank(user: AuthUser, id: string) {
    const company = await this.ownClient(user);
    const row = assertFound(await this.prisma.bankAccount.findFirst({ where: { id, companyId: company.id } }));
    const used = await this.prisma.withdrawal.count({ where: { bankAccountId: row.id } });
    if (used) throw new BadRequestException('这张卡已经用于提款，不能删除');
    await this.prisma.bankAccount.delete({ where: { id: row.id } });
    return { ok: true };
  }

  private async ownClient(user: AuthUser) {
    if (user.role !== 'CLIENT' || !user.companyId) throw new BadRequestException('请使用客户账号');
    return assertFound(await this.prisma.company.findUnique({ where: { id: user.companyId } }));
  }

  private assertAccountName(company: { name: string; certStatus: string }, accountName: string) {
    if ((company.certStatus === 'APPROVED' || company.certStatus === 'CHANGE_PENDING') && accountName !== company.name) {
      throw new BadRequestException('收款户名需要与已认证的企业名称一致');
    }
  }

  private presentBank(row: { accountNo: string }, user: AuthUser) {
    const full = user.role === 'FINANCE' || user.role === 'ADMIN';
    return { ...row, accountNo: full ? row.accountNo : maskAccount(row.accountNo) };
  }

  private present(company: { bankAccounts?: { accountNo: string }[]; certWizard?: unknown } & Record<string, unknown>, user: AuthUser) {
    const { certWizard: _wizard, ...rest } = company;
    return {
      ...rest,
      bankAccounts: company.bankAccounts?.map((row) => this.presentBank(row, user)),
    };
  }
}

export { pageSchema };
