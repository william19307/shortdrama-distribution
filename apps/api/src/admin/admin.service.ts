import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { addDays, platformCreateSchema, platformPatchSchema, settingsSchema, shanghaiToday, taskCreateSchema, userCreateSchema, userPatchSchema, pageSchema } from '@shortform/shared';
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
    const where = this.taskScope(user);
    const [items, total] = await Promise.all([
      this.prisma.asyncTask.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.asyncTask.count({ where }),
    ]);
    return { items: items.map((item) => this.presentTask(item)), total, page: query.page, pageSize: query.pageSize };
  }

  async createTask(user: AuthUser, input: z.infer<typeof taskCreateSchema>) {
    const items = input.items.map((item) => ({ key: item.key, status: 'PENDING', message: '', attempts: 0, failOnce: Boolean(item.failOnce) }));
    const task = await this.prisma.asyncTask.create({
      data: { type: 'BATCH', name: input.name, ownerId: user.id, status: input.defer ? 'RUNNING' : 'PENDING', total: items.length, items },
    });
    if (input.defer) return this.presentTask(task);
    return this.pump(task.id);
  }

  async stepTask(user: AuthUser, id: string) {
    const task = await this.ownTask(user, id);
    if (task.cancelRequested) throw new BadRequestException('任务已取消');
    const items = this.taskItems(task.items);
    const next = items.find((item) => item.status === 'PENDING');
    if (!next) return this.finishTask(task.id, items, false);
    this.settleItem(next);
    return this.finishTask(task.id, items, false);
  }

  async retryTask(user: AuthUser, id: string) {
    const task = await this.ownTask(user, id);
    const items = this.taskItems(task.items);
    const failed = items.filter((item) => item.status === 'FAILED');
    if (!failed.length) throw new BadRequestException('没有失败项可以重试');
    for (const item of failed) item.status = 'PENDING';
    await this.prisma.asyncTask.update({ where: { id }, data: { items, status: 'RUNNING', cancelRequested: false } });
    return this.pump(id, true);
  }

  async cancelTask(user: AuthUser, id: string) {
    const task = await this.ownTask(user, id);
    const items = this.taskItems(task.items);
    for (const item of items) {
      if (item.status === 'PENDING') {
        item.status = 'SKIPPED';
        item.message = '已取消';
      }
    }
    return this.finishTask(id, items, true);
  }

  report(user: AuthUser, id: string) {
    return this.ownTask(user, id).then((task) => {
      const lines = ['项目,状态,说明,次数', ...this.taskItems(task.items).map((item) => [item.key, item.status, item.message, item.attempts].join(','))];
      return lines.join('\n');
    });
  }

  private taskScope(user: AuthUser): Prisma.AsyncTaskWhereInput {
    if (user.role === 'ADMIN' || user.role === 'OPS_MANAGER') return {};
    return { ownerId: user.id };
  }

  private async ownTask(user: AuthUser, id: string) {
    const task = assertFound(await this.prisma.asyncTask.findUnique({ where: { id } }), '任务不存在');
    if (user.role !== 'ADMIN' && user.role !== 'OPS_MANAGER' && task.ownerId !== user.id) throw new ForbiddenException('只能查看自己的任务');
    return task;
  }

  private taskItems(value: Prisma.JsonValue | null): { key: string; status: string; message: string; attempts: number; failOnce: boolean }[] {
    return Array.isArray(value) ? value as { key: string; status: string; message: string; attempts: number; failOnce: boolean }[] : [];
  }

  private settleItem(item: { status: string; message: string; attempts: number; failOnce: boolean }) {
    item.attempts += 1;
    if (item.failOnce && item.attempts === 1) {
      item.status = 'FAILED';
      item.message = '处理失败';
      return;
    }
    item.status = 'SUCCESS';
    item.failOnce = false;
    item.message = '';
  }

  private async pump(id: string, failedOnly = false) {
    const task = assertFound(await this.prisma.asyncTask.findUnique({ where: { id } }), '任务不存在');
    const items = this.taskItems(task.items);
    let cancel = task.cancelRequested;
    for (const item of items) {
      if (failedOnly && item.status !== 'PENDING') continue;
      const fresh = await this.prisma.asyncTask.findUnique({ where: { id } });
      cancel = Boolean(fresh?.cancelRequested);
      if (cancel) {
        if (item.status === 'PENDING') {
          item.status = 'SKIPPED';
          item.message = '已取消';
        }
        continue;
      }
      if (item.status !== 'PENDING') continue;
      this.settleItem(item);
    }
    return this.finishTask(id, items, cancel);
  }

  private async finishTask(id: string, items: { status: string }[], cancel: boolean) {
    const succeeded = items.filter((item) => item.status === 'SUCCESS').length;
    const failed = items.filter((item) => item.status === 'FAILED').length;
    const skipped = items.filter((item) => item.status === 'SKIPPED').length;
    const pending = items.some((item) => item.status === 'PENDING');
    const status = cancel ? 'CANCELLED' : pending ? 'RUNNING' : failed ? 'PARTIAL' : 'SUCCESS';
    const task = await this.prisma.asyncTask.update({
      where: { id },
      data: { items, succeeded, failed, skipped, status, cancelRequested: cancel, finishedAt: pending ? null : new Date() },
    });
    return this.presentTask(task);
  }

  private presentTask<T extends { total: number; succeeded: number; failed: number; skipped: number; status: string }>(task: T) {
    const done = task.succeeded + task.failed + task.skipped;
    return { ...task, progress: task.total ? Math.round((done / task.total) * 100) : 0 };
  }
}

export const logQuery = pageSchema.extend({ entityType: z.string().optional() });
