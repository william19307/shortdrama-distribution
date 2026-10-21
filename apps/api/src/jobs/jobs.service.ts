import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../core/audit.service';
import { assertRole, AuthUser, day, nextCode } from '../core/auth';
import { PrismaService } from '../core/prisma.service';

export const JOB_NAMES = ['daily-stats-warn', 'daily-stats-escalate', 'review-sla', 'settlement-generate'] as const;
export type JobName = (typeof JOB_NAMES)[number];

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(JobsService.name);
  private timer: NodeJS.Timeout | null = null;
  private lastSlot = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || process.env.JOBS_ENABLED === 'false') return;
    this.timer = setInterval(() => void this.tick(), 60_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(name: string, user?: AuthUser) {
    if (user) assertRole(user, ['ADMIN', 'OPS_MANAGER']);
    if (!(JOB_NAMES as readonly string[]).includes(name)) {
      throw new BadRequestException(`未知任务：${name}，可选 ${JOB_NAMES.join('、')}`);
    }
    switch (name as JobName) {
      case 'daily-stats-warn':
        return this.dailyStatsWarn();
      case 'daily-stats-escalate':
        return this.dailyStatsEscalate();
      case 'review-sla':
        return this.reviewSla();
      case 'settlement-generate':
        return this.settlementGenerate();
      default:
        throw new BadRequestException(`未知任务：${name}`);
    }
  }

  private async tick() {
    const hour = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
    const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const slot = `${dayKey} ${hour}`;
    if (slot === this.lastSlot) return;
    this.lastSlot = slot;
    const minute = hour.slice(3);
    if (minute !== '00') return;
    const clock = hour.slice(0, 2);
    if (clock === '01') await this.settlementGenerate();
    if (clock === '05') await this.dailyStatsWarn();
    if (clock === '06') await this.dailyStatsEscalate();
    if (clock === '00' || clock === '06' || clock === '12' || clock === '18') await this.reviewSla();
  }

  async dailyStatsWarn() {
    const yesterday = this.yesterdayIso();
    const pending = await this.prisma.dailyStat.count({
      where: { statDate: day(yesterday), status: { in: ['DRAFT', 'ANOMALY'] } },
    });
    const message = `[DS-09] 05:00 预警：${yesterday} 仍有 ${pending} 条日报未完成`;
    this.log.warn(message);
    await this.notify('daily-stats-warn', yesterday, message, { date: yesterday, pending });
    return { job: 'daily-stats-warn', date: yesterday, pending, message };
  }

  async dailyStatsEscalate() {
    const yesterday = this.yesterdayIso();
    const pending = await this.prisma.dailyStat.count({
      where: { statDate: day(yesterday), status: { in: ['DRAFT', 'ANOMALY'] } },
    });
    const managers = await this.prisma.user.findMany({
      where: { role: 'OPS_MANAGER', disabled: false },
      select: { id: true, email: true, name: true },
    });
    const message = `[DS-09] 06:00 超时升级：${yesterday} 未完成日报 ${pending} 条，通知运营主管 ${managers.length} 人`;
    this.log.error(message);
    await this.notify('daily-stats-escalate', yesterday, message, { date: yesterday, pending, managers });
    return { job: 'daily-stats-escalate', date: yesterday, pending, managers, message };
  }

  async reviewSla() {
    const now = Date.now();
    const open = await this.prisma.distributionPlan.findMany({
      where: { status: { in: ['PENDING_REVIEW', 'IN_REVIEW', 'SHARE_CONFIG', 'SHARE_REVIEW'] }, slaDueAt: { not: null } },
      select: { id: true, code: true, slaDueAt: true, submittedAt: true },
    });
    const buckets = { warn80: [] as string[], overdue: [] as string[], double: [] as string[] };
    for (const plan of open) {
      if (!plan.slaDueAt || !plan.submittedAt) continue;
      const span = Math.max(plan.slaDueAt.getTime() - plan.submittedAt.getTime(), 1);
      const ratio = (now - plan.submittedAt.getTime()) / span;
      if (ratio >= 2) buckets.double.push(plan.code);
      else if (now >= plan.slaDueAt.getTime()) buckets.overdue.push(plan.code);
      else if (ratio >= 0.8) buckets.warn80.push(plan.code);
    }
    const message = `[RV-12] SLA 巡检：80%预警 ${buckets.warn80.length}、超时 ${buckets.overdue.length}、2倍 ${buckets.double.length}`;
    this.log.log(message);
    const slot = new Date(Math.floor(now / (30 * 60 * 1000)) * 30 * 60 * 1000).toISOString();
    await this.notify('review-sla', slot, message, buckets);
    return { job: 'review-sla', ...buckets, message };
  }

  async settlementGenerate() {
    const policies = await this.prisma.settlementPolicy.findMany({ include: { company: { select: { id: true, name: true } } } });
    const created: string[] = [];
    const skipped: string[] = [];
    for (const policy of policies) {
      const period = this.previousPeriod(policy.cycleType, policy.customDays);
      if (!period) {
        skipped.push(policy.companyId);
        continue;
      }
      const existing = await this.prisma.settlement.findUnique({
        where: { companyId_periodStart_periodEnd: { companyId: policy.companyId, periodStart: period.start, periodEnd: period.end } },
      });
      if (existing) {
        skipped.push(existing.code);
        continue;
      }
      const admin = await this.prisma.user.findFirst({ where: { role: 'ADMIN', disabled: false }, select: { id: true } });
      const settlement = await this.prisma.$transaction(async (tx) => {
        const row = await tx.settlement.create({
          data: {
            code: await nextCode(tx, 'JS'),
            companyId: policy.companyId,
            periodStart: period.start,
            periodEnd: period.end,
            status: 'PENDING_ENTRY',
            referenceCny: new Prisma.Decimal(0),
          },
        });
        if (admin) {
          await tx.settlementLog.create({
            data: {
              settlementId: row.id,
              action: '定时任务自动生成结算单',
              actorId: admin.id,
              after: { periodStart: period.start.toISOString(), periodEnd: period.end.toISOString() },
            },
          });
        }
        return row;
      });
      created.push(settlement.code);
    }
    const message = `[ST-02] 自动生成结算单：新建 ${created.length}，跳过 ${skipped.length}`;
    this.log.log(message);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    await this.notify('settlement-generate', today, message, { created, skipped });
    return { job: 'settlement-generate', created, skipped, message };
  }

  private yesterdayIso() {
    const formatted = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() - 24 * 60 * 60 * 1000));
    return formatted;
  }

  private previousPeriod(cycleType: string, customDays: number | null) {
    const today = new Date();
    if (cycleType === 'MONTH') {
      const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
      const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
      return { start, end };
    }
    if (cycleType === 'QUARTER') {
      const q = Math.floor(today.getUTCMonth() / 3);
      const startMonth = ((q - 1 + 4) % 4) * 3;
      const year = q === 0 ? today.getUTCFullYear() - 1 : today.getUTCFullYear();
      const start = new Date(Date.UTC(year, startMonth, 1));
      const end = new Date(Date.UTC(year, startMonth + 3, 0));
      return { start, end };
    }
    if (cycleType === 'CUSTOM_DAYS' && customDays && customDays > 0) {
      const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - (customDays - 1));
      return { start, end };
    }
    return null;
  }

  /** 同一任务、同一槽位只记一次提醒，手动再跑仍返回结果。 */
  private async notify(job: string, slot: string, message: string, detail: unknown) {
    const action = `job.${job}`;
    const existing = await this.prisma.auditLog.findFirst({ where: { action, entityId: slot } });
    if (existing) return;
    try {
      await this.audit.write(null, action, 'Job', slot, { message, detail } as Prisma.InputJsonValue);
    } catch (err) {
      this.log.warn(`notify failed for ${job}: ${(err as Error).message}`);
    }
  }
}
