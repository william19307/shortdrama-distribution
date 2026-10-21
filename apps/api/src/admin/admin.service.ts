import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { addDays, platformCreateSchema, platformPatchSchema, settingsSchema, shanghaiToday, userCreateSchema, userPatchSchema, pageSchema } from '@shortform/shared';
import { assertFound } from '../core/access';
import { AuditService } from '../core/audit.service';
import { assertBusinessWrite, assertRole, AuthUser, day, nextCode } from '../core/auth';
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
    return this.prisma.platform.findMany({
      orderBy: [{ firstBatch: 'desc' }, { sort: 'asc' }, { name: 'asc' }],
      include: { rosterRequests: { where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' }, take: 1 } },
    });
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
    const data: Prisma.PlatformUpdateInput = {};
    if (input.region != null) data.region = input.region;
    if (input.sort != null) data.sort = input.sort;
    if (input.syncMode != null) data.syncMode = input.syncMode;
    if (input.contact != null) data.contact = input.contact;
    if (input.color != null) data.color = input.color;
    if (input.syncLag) {
      if (input.syncLag === platform.syncLag) {
        data.syncLagPending = null;
        data.syncLagEffectiveOn = null;
      } else {
        data.syncLagPending = input.syncLag;
        data.syncLagEffectiveOn = day(addDays(shanghaiToday(), 1));
      }
    }
    const enabledChange = input.enabled != null && input.enabled !== platform.enabled;
    const firstBatchChange = input.firstBatch != null && input.firstBatch !== platform.firstBatch;
    const firstBatchTouch = firstBatchChange || (enabledChange && platform.firstBatch);
    if (firstBatchTouch && user.role !== 'OPS_MANAGER') {
      assertBusinessWrite(user);
      const existing = await this.prisma.platformRosterRequest.findFirst({ where: { platformId: id, status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
      const payload = {
        firstBatch: firstBatchChange ? input.firstBatch : existing?.firstBatch,
        enabled: enabledChange ? input.enabled : existing?.enabled,
        requestedById: user.id,
      };
      const request = existing
        ? await this.prisma.platformRosterRequest.update({ where: { id: existing.id }, data: payload })
        : await this.prisma.platformRosterRequest.create({ data: { platformId: id, ...payload } });
      await this.audit.write(user.id, 'platform.roster.request', 'PlatformRosterRequest', request.id, { platformId: id, firstBatch: payload.firstBatch, enabled: payload.enabled });
      const updated = Object.keys(data).length ? await this.prisma.platform.update({ where: { id }, data }) : platform;
      return { ...updated, pendingConfirmation: true, request };
    }
    if (firstBatchTouch || enabledChange) {
      assertBusinessWrite(user);
      const enabled = input.enabled ?? platform.enabled;
      const firstBatch = input.firstBatch ?? platform.firstBatch;
      if (platform.firstBatch && platform.enabled && !(enabled && firstBatch)) {
        const others = await this.prisma.platform.count({ where: { firstBatch: true, enabled: true, NOT: { id } } });
        if (!others) throw new BadRequestException('至少保留一个启用的首发平台');
      }
      if (input.enabled != null) data.enabled = input.enabled;
      if (input.firstBatch != null) data.firstBatch = input.firstBatch;
    }
    const updated = await this.prisma.platform.update({ where: { id }, data });
    await this.audit.write(user.id, 'platform.update', 'Platform', id, input as never);
    return updated;
  }

  async confirmRoster(user: AuthUser, requestId: string) {
    assertBusinessWrite(user);
    assertRole(user, ['OPS_MANAGER'], '首发名单由运营主管确认');
    const request = assertFound(
      await this.prisma.platformRosterRequest.findUnique({ where: { id: requestId }, include: { platform: true } }),
      '确认单不存在',
    );
    if (request.status !== 'PENDING') throw new BadRequestException('这条变更已经处理过');
    const enabled = request.enabled ?? request.platform.enabled;
    const firstBatch = request.firstBatch ?? request.platform.firstBatch;
    if (request.platform.firstBatch && request.platform.enabled && !(enabled && firstBatch)) {
      const others = await this.prisma.platform.count({ where: { firstBatch: true, enabled: true, NOT: { id: request.platformId } } });
      if (!others) throw new BadRequestException('至少保留一个启用的首发平台');
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.platform.update({ where: { id: request.platformId }, data: { enabled, firstBatch } }),
      this.prisma.platformRosterRequest.update({ where: { id: request.id }, data: { status: 'APPROVED', decidedById: user.id, decidedAt: new Date() } }),
    ]);
    await this.audit.write(user.id, 'platform.roster.confirm', 'Platform', request.platformId, { requestId, enabled, firstBatch });
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
