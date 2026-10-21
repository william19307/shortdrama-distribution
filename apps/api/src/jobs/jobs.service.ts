import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../core/audit.service';
import { assertRole, AuthUser, day, nextCode } from '../core/auth';
import { PrismaService } from '../core/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

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
    private readonly notifications: NotificationsService,
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
    if (minute !== '00' && minute !== '30') return;
    const clock = hour.slice(0, 2);
    if (clock === '01' && minute === '00') await this.settlementGenerate();
    await this.dailyStatsWarn();
    if (clock === '06' && minute === '00') await this.dailyStatsEscalate();
    if (minute === '00' && (clock === '00' || clock === '06' || clock === '12' || clock === '18')) await this.reviewSla();
  }

  async dailyStatsWarn() {
    const yesterday = this.yesterdayIso();
    const pendingRows = await this.prisma.dailyStat.findMany({
      where: { statDate: day(yesterday), status: { in: ['DRAFT', 'ANOMALY'] } },
      select: { company: { select: { ownerId: true } } },
    });
    const pending = pendingRows.length;
    const message = `[DS-09] ${yesterday} 仍有 ${pending} 条日报未完成`;
    const slot = this.halfHourSlot();
    const entityId = `${yesterday}:${slot}`;
    const already = await this.prisma.auditLog.findFirst({ where: { action: 'job.daily-stats-warn', entityId } });
    if (already) return { job: 'daily-stats-warn', date: yesterday, pending, notified: 0, message };
    let notified = 0;
    if (pending) {
      const owners = [...new Set(pendingRows.map((row) => row.company.ownerId).filter((id): id is string => Boolean(id)))];
      const managers = await this.prisma.user.findMany({ where: { role: 'OPS_MANAGER', disabled: false }, select: { id: true } });
      const targets = [...new Set([...owners, ...managers.map((row) => row.id)])];
      const pushed = await this.notifications.pushMany(targets, {
        type: 'DS09_WARN',
        title: message,
        body: '请完成录入和复核。未完成会每 30 分钟再提醒一次。',
        entityType: 'DailyStat',
        entityId,
      });
      notified = pushed.count;
      this.log.warn(message);
    }
    await this.audit.write(null, 'job.daily-stats-warn', 'Job', entityId, { message, pending, notified });
    return { job: 'daily-stats-warn', date: yesterday, pending, notified, message };
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
    const message = `[DS-09] 超时升级：${yesterday} 未完成日报 ${pending} 条，通知运营主管 ${managers.length} 人`;
    if (pending) {
      await this.notifications.pushMany(managers.map((row) => row.id), {
        type: 'DS09_ESCALATE',
        title: message,
        body: '日报已过同步时限，请运营主管跟进。',
        entityType: 'DailyStat',
        entityId: yesterday,
      });
    }
    this.log.error(message);
    await this.audit.write(null, 'job.daily-stats-escalate', 'Job', yesterday, { message, pending, managers: managers.map((row) => row.id) });
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
    const managers = await this.prisma.user.findMany({ where: { role: 'OPS_MANAGER', disabled: false }, select: { id: true } });
    const managerIds = managers.map((row) => row.id);
    const slot = this.halfHourSlot();
    const plans = await this.prisma.distributionPlan.findMany({
      where: { code: { in: [...buckets.warn80, ...buckets.overdue, ...buckets.double] } },
      select: { id: true, code: true, assigneeId: true },
    });
    const byCode = new Map(plans.map((plan) => [plan.code, plan]));
    for (const code of buckets.warn80) {
      const plan = byCode.get(code);
      if (!plan) continue;
      await this.notifications.pushMany(plan.assigneeId ? [plan.assigneeId] : managerIds, {
        type: 'RV12_WARN80',
        title: `[RV-12] SLA 已用 80%：${code}`,
        body: '审核即将超时，请尽快处理。',
        entityType: 'DistributionPlan',
        entityId: `${plan.id}:warn80:${slot}`,
      });
    }
    for (const code of buckets.overdue) {
      const plan = byCode.get(code);
      if (!plan) continue;
      await this.notifications.pushMany([...(plan.assigneeId ? [plan.assigneeId] : []), ...managerIds], {
        type: 'RV12_OVERDUE',
        title: `[RV-12] SLA 已超时：${code}`,
        body: '审核已超时，已通知运营主管。',
        entityType: 'DistributionPlan',
        entityId: `${plan.id}:overdue:${slot}`,
      });
    }
    for (const code of buckets.double) {
      const plan = byCode.get(code);
      if (!plan) continue;
      await this.notifications.pushMany(managerIds, {
        type: 'RV12_DOUBLE',
        title: `[RV-12] SLA 2倍超时：${code}`,
        body: '审核严重超时，请改派或介入。',
        entityType: 'DistributionPlan',
        entityId: `${plan.id}:double:${slot}`,
      });
    }
    this.log.log(message);
    await this.audit.write(null, 'job.review-sla', 'Job', slot, { message, ...buckets });
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
    const finance = await this.prisma.user.findMany({ where: { role: { in: ['FINANCE', 'OPS_MANAGER'] }, disabled: false }, select: { id: true } });
    await this.notifications.pushMany(finance.map((row) => row.id), {
      type: 'ST02_GENERATE',
      title: message,
      body: created.length ? `新建 ${created.join('、')}` : '本周期没有新的结算单。',
      entityType: 'Settlement',
      entityId: today,
    });
    await this.audit.write(null, 'job.settlement-generate', 'Job', today, { message, created, skipped });
    return { job: 'settlement-generate', created, skipped, message };
  }

  private halfHourSlot() {
    const now = new Date();
    const slot = new Date(Math.floor(now.getTime() / (30 * 60 * 1000)) * 30 * 60 * 1000);
    return slot.toISOString();
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

}
