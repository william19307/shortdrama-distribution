import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { bankAccountSchema, certReviewSchema, certSchema, ownerPatchSchema, pageSchema } from '@shortform/shared';
import { assertCompanyAccess, assertFound, maskAccount } from '../core/access';
import { AuditService } from '../core/audit.service';
import { assertBusinessWrite, assertRole, AuthUser } from '../core/auth';
import { PrismaService } from '../core/prisma.service';

type CertInput = z.infer<typeof certSchema>;
type BankInput = z.infer<typeof bankAccountSchema>;

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
        data: { certStatus: 'CHANGE_PENDING', certDraft: input, certRejectReason: null },
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
        },
      });
    }
    await this.audit.write(user.id, 'cert.submit', 'Company', company.id);
    return this.myCompany(user);
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
    return { items, total, page: query.page, pageSize: query.pageSize };
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

  private present(company: { bankAccounts?: { accountNo: string }[] } & Record<string, unknown>, user: AuthUser) {
    return {
      ...company,
      bankAccounts: company.bankAccounts?.map((row) => this.presentBank(row, user)),
    };
  }
}

export { pageSchema };
