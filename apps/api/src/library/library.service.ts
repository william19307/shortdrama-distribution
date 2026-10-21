import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { SELECTION_LIMITS, selectionExecuteSchema, selectionFilterSchema } from '@shortform/shared';
import { z } from 'zod';
import { CatalogService } from '../catalog/catalog.service';
import { AuthUser } from '../core/auth';
import { PrismaService } from '../core/prisma.service';
import { recordFinishedTask } from '../core/task-log';
import { DistributionService } from '../distribution/distribution.service';

type Filter = z.infer<typeof selectionFilterSchema>;
type ExecuteInput = z.infer<typeof selectionExecuteSchema>;

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly distribution: DistributionService,
  ) {}

  previewMetadata(user: AuthUser, file: Buffer) {
    return this.catalog.previewMetadata(user, file);
  }

  confirmMetadata(user: AuthUser, file: Buffer) {
    return this.catalog.importMetadata(user, file);
  }

  async selectionPreview(user: AuthUser, input: { filter: Filter; action: keyof typeof SELECTION_LIMITS }) {
    const where = this.catalog.filterWhere(user, input.filter);
    const limit = SELECTION_LIMITS[input.action];
    const total = await this.prisma.drama.count({ where });
    const rows = await this.prisma.drama.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: Math.min(Math.max(total, 0), limit),
      select: { id: true, code: true, title: true },
    });
    return {
      action: input.action,
      total,
      limit,
      overLimit: total > limit,
      message: total > limit ? `命中 ${total} 部，超过单次上限 ${limit} 部，请缩小筛选范围` : `将对筛选结果共 ${total} 部执行操作`,
      sample: rows.slice(0, 10),
      ids: total > limit ? [] : rows.map((row) => row.id),
      filter: input.filter,
    };
  }

  async selectionExecute(user: AuthUser, input: ExecuteInput) {
    const ids = await this.resolveIds(user, input.filter, input.expectedCount, SELECTION_LIMITS[input.action]);
    if (input.action === 'PLAN') {
      if (!input.params.round) throw new BadRequestException('请选择首发或二轮');
      return this.distribution.createPlans(user, {
        dramaIds: ids,
        round: input.params.round,
        platformIds: input.params.platformIds,
        customPlatforms: input.params.customPlatforms,
      });
    }
    const add = input.params.add ?? [];
    const remove = input.params.remove ?? [];
    if (!add.length && !remove.length) throw new BadRequestException(input.action === 'TAG' ? '请填写要添加或移除的标签' : '请填写要加入或移出的分组');
    let updated = 0;
    if (add.length) {
      const tagged = await this.catalog.batchMeta(user, { ids, tag: input.action === 'TAG' ? add[0] : undefined, group: input.action === 'GROUP' ? add[0] : undefined });
      updated = tagged.updated;
    }
    if (remove.length) {
      const field = input.action === 'TAG' ? 'tags' : 'groups';
      const dramas = await this.prisma.drama.findMany({ where: { id: { in: ids } }, select: { id: true, tags: true, groups: true, companyId: true } });
      for (const drama of dramas) {
        const before = drama[field];
        const next = before.filter((value) => !remove.includes(value));
        if (next.length !== before.length) {
          await this.prisma.drama.update({ where: { id: drama.id }, data: { [field]: next } });
          updated += 1;
        }
      }
    }
    const task = await recordFinishedTask(this.prisma, user.id, {
      type: 'DRAMA_LABELS',
      name: `${input.action === 'TAG' ? '批量打标签' : '批量加入分组'}（筛选结果 ${ids.length} 部）`,
      succeeded: updated,
      failed: 0,
      skipped: ids.length - updated,
    });
    return { updated, ids, task: { id: task.id, name: task.name } };
  }

  async selectionExport(user: AuthUser, input: { filter: Filter; expectedCount: number }) {
    const ids = await this.resolveIds(user, input.filter, input.expectedCount, SELECTION_LIMITS.EXPORT);
    const csv = await this.catalog.exportCsv(user, { page: 1, pageSize: 20, sort: 'updatedAt', order: 'desc', ...input.filter, ids });
    return { csv, count: ids.length };
  }

  private async resolveIds(user: AuthUser, filter: Filter, expectedCount: number, limit: number) {
    const where = this.catalog.filterWhere(user, filter);
    const total = await this.prisma.drama.count({ where });
    if (total > limit) throw new BadRequestException(`命中 ${total} 部，超过单次上限 ${limit} 部，请缩小筛选范围`);
    if (total !== expectedCount) throw new ConflictException(`筛选结果已变化：确认时为 ${expectedCount} 部，现在为 ${total} 部，请重新确认`);
    const rows = await this.prisma.drama.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      select: { id: true },
      take: limit,
    });
    return rows.map((row) => row.id);
  }
}
