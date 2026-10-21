import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/** 批量操作记入现有任务中心，方便重试入口和结果报告沿用同一张表。 */
export async function recordFinishedTask(
  prisma: PrismaService,
  userId: string,
  input: { type: string; name: string; succeeded: number; failed: number; skipped: number; items?: unknown },
) {
  const total = input.succeeded + input.failed + input.skipped;
  const status = input.failed ? (input.succeeded ? 'PARTIAL' : 'FAILED') : 'SUCCESS';
  return prisma.asyncTask.create({
    data: {
      type: input.type,
      name: input.name,
      ownerId: userId,
      status,
      total,
      succeeded: input.succeeded,
      failed: input.failed,
      skipped: input.skipped,
      items: (input.items ?? []) as Prisma.InputJsonValue,
      finishedAt: new Date(),
    },
  });
}
