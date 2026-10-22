import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assertFound } from '../core/access';
import { AuthUser } from '../core/auth';
import { PrismaService } from '../core/prisma.service';

export interface NotificationPayload {
  type: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser, query: { page: number; pageSize: number; unreadOnly?: boolean }) {
    const where: Prisma.NotificationWhereInput = { userId: user.id };
    if (query.unreadOnly) where.readAt = null;
    const [items, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);
    return { items, total, unread, page: query.page, pageSize: query.pageSize };
  }

  async markRead(user: AuthUser, id: string) {
    const row = assertFound(await this.prisma.notification.findFirst({ where: { id, userId: user.id } }), '通知不存在');
    if (row.readAt) return row;
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllRead(user: AuthUser) {
    const result = await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true, updated: result.count };
  }

  /** 同一用户、同一类型、同一槽位只写一次，供定时任务重复触发时去重。 */
  async pushMany(userIds: string[], payload: NotificationPayload) {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (!unique.length) return { count: 0 };
    const existing = payload.entityId
      ? await this.prisma.notification.findMany({
          where: { userId: { in: unique }, type: payload.type, entityId: payload.entityId },
          select: { userId: true },
        })
      : [];
    const seen = new Set(existing.map((row) => row.userId));
    const fresh = unique.filter((id) => !seen.has(id));
    if (!fresh.length) return { count: 0 };
    await this.prisma.notification.createMany({
      data: fresh.map((userId) => ({
        userId,
        type: payload.type,
        title: payload.title,
        body: payload.body ?? '',
        entityType: payload.entityType,
        entityId: payload.entityId,
      })),
    });
    return { count: fresh.length };
  }
}
