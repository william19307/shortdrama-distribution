import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { platformCreateSchema, platformPatchSchema, settingsSchema, userCreateSchema, userPatchSchema, pageSchema } from '@shortform/shared';
import { assertFound } from '../core/access';
import { AuditService } from '../core/audit.service';
import { assertBusinessWrite, assertRole, AuthUser, nextCode } from '../core/auth';
import { PrismaService } from '../core/prisma.service';
import { SettingsService } from '../core/settings.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  async workbench(user: AuthUser) {
    const companyScope = user.role === 'OPS' ? { company: { ownerId: user.id } } : user.role === 'CLIENT' ? { companyId: user.companyId! } : {};
    if (user.role === 'BD') {
      const scope = { company: { bdId: user.id } };
      const [reviews, shareConfig, pendingShots, overdue] = await Promise.all([
        this.prisma.distributionPlan.count({ where: { ...scope, status: { in: ['PENDING_REVIEW', 'IN_REVIEW', 'NEEDS_REVISION'] } } }),
        this.prisma.distributionPlan.count({ where: { ...scope, status: 'SHARE_CONFIG' } }),
        this.prisma.watermarkShot.count({ where: { ...scope, status: 'PENDING_MATCH' } }),
        this.prisma.distributionPlan.count({ where: { ...scope, slaDueAt: { lt: new Date() }, status: { in: ['PENDING_REVIEW', 'IN_REVIEW', 'SHARE_CONFIG', 'SHARE_REVIEW'] } } }),
      ]);
      const settings = await this.settings.all();
      return { reviews, shareConfig, shareReview: 0, entry: 0, toReview: 0, invoices: 0, paying: 0, pendingShots, overdue, settings: { deviationPct: settings.deviationPct, syncDeadline: settings.syncDeadline } };
    }
    const [reviews, shareConfig, shareReview, entry, toReview, invoices, paying, pendingShots, overdue] = await Promise.all([
      this.prisma.distributionPlan.count({ where: { ...companyScope, status: { in: ['PENDING_REVIEW', 'IN_REVIEW', 'NEEDS_REVISION'] } } }),
      this.prisma.distributionPlan.count({ where: { ...companyScope, status: 'SHARE_CONFIG' } }),
      this.prisma.distributionPlan.count({ where: { ...companyScope, status: 'SHARE_REVIEW' } }),
      this.prisma.settlement.count({ where: { ...companyScope, status: 'PENDING_ENTRY' } }),
      this.prisma.settlement.count({ where: { ...companyScope, status: 'PENDING_REVIEW' } }),
      this.prisma.withdrawal.count({ where: { ...(user.role === 'OPS' ? { company: { ownerId: user.id } } : user.role === 'CLIENT' ? { companyId: user.companyId! } : {}), status: 'INVOICE_REVIEW' } }),
      this.prisma.withdrawal.count({ where: { ...(user.role === 'CLIENT' ? { companyId: user.companyId! } : {}), status: 'PAYING' } }),
      this.prisma.watermarkShot.count({ where: { status: 'PENDING_MATCH' } }),
      this.prisma.distributionPlan.count({ where: { ...companyScope, slaDueAt: { lt: new Date() }, status: { in: ['PENDING_REVIEW', 'IN_REVIEW', 'SHARE_CONFIG', 'SHARE_REVIEW'] } } }),
    ]);
    return { reviews, shareConfig, shareReview, entry, toReview, invoices, paying, pendingShots, overdue, settings: await this.settings.all() };
  }

  async users(user: AuthUser, query: { page: number; pageSize: number }) {
    assertRole(user, ['ADMIN']);
    const where = { role: { not: 'CLIENT' as const } };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({ where, select: { id: true, email: true, name: true, role: true, disabled: true, createdAt: true }, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async createUser(user: AuthUser, input: z.infer<typeof userCreateSchema>) {
    assertRole(user, ['ADMIN']);
    const passwordHash = await hash(input.password, 10);
    const created = await this.prisma.user.create({
      data: { email: input.email.toLowerCase(), passwordHash, name: input.name, role: input.role },
      select: { id: true, email: true, name: true, role: true },
    });
    await this.audit.write(user.id, 'user.create', 'User', created.id, { role: input.role });
    return created;
  }

  async patchUser(user: AuthUser, id: string, input: z.infer<typeof userPatchSchema>) {
    assertRole(user, ['ADMIN']);
    if (id === user.id && input.disabled) throw new BadRequestException('不能停用自己');
    return this.prisma.user.update({ where: { id }, data: input, select: { id: true, email: true, name: true, role: true, disabled: true } });
  }

  getSettings(user: AuthUser) {
    assertRole(user, ['ADMIN']);
    return this.settings.all();
  }

  assignees(user: AuthUser) {
    assertRole(user, ['ADMIN', 'OPS_MANAGER']);
    return this.prisma.user.findMany({
      where: { role: { in: ['OPS', 'BD'] }, disabled: false },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });
  }

  putSettings(user: AuthUser, input: z.infer<typeof settingsSchema>) {
    assertRole(user, ['ADMIN']);
    return this.settings.put(input, user.id);
  }

  platforms() {
    return this.prisma.platform.findMany({ orderBy: [{ firstBatch: 'desc' }, { sort: 'asc' }, { name: 'asc' }] });
  }

  async createPlatform(user: AuthUser, input: z.infer<typeof platformCreateSchema>) {
    assertRole(user, ['OPS', 'OPS_MANAGER', 'BD', 'ADMIN']);
    return this.prisma.$transaction(async (tx) =>
      tx.platform.create({
        data: { code: await nextCode(tx, 'PF', 3), name: input.name, region: input.region ?? '', syncLag: input.syncLag, contact: input.contact ?? '', proposed: true, firstBatch: false, enabled: true },
      }),
    );
  }

  async patchPlatform(user: AuthUser, id: string, input: z.infer<typeof platformPatchSchema>) {
    assertRole(user, ['OPS', 'OPS_MANAGER', 'ADMIN', 'BD']);
    const platform = assertFound(await this.prisma.platform.findUnique({ where: { id } }));
    const rosterChange = (input.firstBatch != null && input.firstBatch !== platform.firstBatch) || (input.enabled != null && input.enabled !== platform.enabled);
    if (rosterChange) assertBusinessWrite(user);
    const firstBatchTouch = (input.firstBatch != null && input.firstBatch !== platform.firstBatch) || (input.enabled != null && input.enabled !== platform.enabled && platform.firstBatch);
    if (firstBatchTouch && user.role !== 'OPS_MANAGER') throw new ForbiddenException('首发名单和首发平台启停由运营主管确认');
    const enabled = input.enabled ?? platform.enabled;
    const firstBatch = input.firstBatch ?? platform.firstBatch;
    if (platform.firstBatch && platform.enabled && !(enabled && firstBatch)) {
      const others = await this.prisma.platform.count({ where: { firstBatch: true, enabled: true, NOT: { id } } });
      if (!others) throw new BadRequestException('至少保留一个启用的首发平台');
    }
    const updated = await this.prisma.platform.update({ where: { id }, data: input });
    await this.audit.write(user.id, 'platform.update', 'Platform', id, input as never);
    return updated;
  }

  async logs(user: AuthUser, query: { page: number; pageSize: number; entityType?: string }) {
    assertRole(user, ['ADMIN']);
    const where = query.entityType ? { entityType: query.entityType } : {};
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, include: { actor: { select: { name: true, email: true } } }, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async tasks(user: AuthUser, query: { page: number; pageSize: number }) {
    const where = user.role === 'ADMIN' ? {} : { ownerId: user.id };
    const [items, total] = await Promise.all([
      this.prisma.asyncTask.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.asyncTask.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }
}

export const logQuery = pageSchema.extend({ entityType: z.string().optional() });
