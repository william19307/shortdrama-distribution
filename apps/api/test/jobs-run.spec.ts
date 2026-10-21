import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import request from 'supertest';
import { jobScheduleFromEnv } from '../src/jobs/jobs.service';
import { buildApp } from '../src/main';

const PASS = 'Demo123456';
const prisma = new PrismaClient();
let app: INestApplication;
let adminEmail = '';
let managerEmail = '';
let bdEmail = '';
let financeEmail = '';
let adminId = '';
let managerId = '';

async function login(email: string) {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASS });
  expect(res.status).toBeLessThan(300);
  return res.body.accessToken as string;
}

describe('定时任务时刻', () => {
  it('默认 05:00 预警、06:00 超时、01:00 出单，可用环境变量覆盖', () => {
    expect(jobScheduleFromEnv({})).toMatchObject({
      tz: 'Asia/Shanghai',
      ds01: '0 0 * * *',
      ds09Warn: '0 5 * * *',
      ds09Repeat: '*/30 * * * *',
      ds09Escalate: '0 6 * * *',
      rv12: '0 0,6,12,18 * * *',
      st02: '0 1 * * *',
      slaWarnRatio: 0.8,
      slaDoubleRatio: 2,
    });
    expect(jobScheduleFromEnv({
      CRON_TZ: 'UTC',
      CRON_DS09_WARN: '5 5 * * *',
      CRON_DS09_REPEAT: 'off',
      CRON_ST02: '0 2 * * *',
      SLA_WARN_RATIO: '0.5',
      SLA_DOUBLE_RATIO: '3',
    })).toMatchObject({
      tz: 'UTC',
      ds09Warn: '5 5 * * *',
      ds09Repeat: null,
      st02: '0 2 * * *',
      slaWarnRatio: 0.5,
      slaDoubleRatio: 3,
    });
  });
});

describe('手动触发定时任务', () => {
  beforeAll(async () => {
    app = await buildApp();
    await app.init();
    const stamp = Date.now();
    adminEmail = `jobs-admin-${stamp}@example.com`;
    managerEmail = `jobs-manager-${stamp}@example.com`;
    bdEmail = `jobs-bd-${stamp}@example.com`;
    financeEmail = `jobs-finance-${stamp}@example.com`;
    const adminUser = await prisma.user.create({ data: { email: adminEmail, name: '任务管理员', role: 'ADMIN', passwordHash: hashSync(PASS, 4) } });
    const managerUser = await prisma.user.create({ data: { email: managerEmail, name: '任务主管', role: 'OPS_MANAGER', passwordHash: hashSync(PASS, 4) } });
    adminId = adminUser.id;
    managerId = managerUser.id;
    await prisma.user.create({ data: { email: bdEmail, name: '任务商务', role: 'BD', passwordHash: hashSync(PASS, 4) } });
    await prisma.user.create({ data: { email: financeEmail, name: '任务财务', role: 'FINANCE', passwordHash: hashSync(PASS, 4) } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /admin/jobs/:name/run 可触发已知任务，未知任务 400，商务 403', async () => {
    const admin = await login(adminEmail);
    const before = await prisma.auditLog.count({ where: { action: 'job.daily-stats-warn' } });
    const ran = await request(app.getHttpServer()).post('/api/admin/jobs/daily-stats-warn/run').set('Authorization', `Bearer ${admin}`);
    expect(ran.status).toBeLessThan(300);
    expect(typeof ran.body.notified).toBe('number');
    expect(ran.body.job).toBe('daily-stats-warn');
    const again = await request(app.getHttpServer()).post('/api/admin/jobs/daily-stats-warn/run').set('Authorization', `Bearer ${admin}`);
    expect(again.status).toBeLessThan(300);
    expect(await prisma.auditLog.count({ where: { action: 'job.daily-stats-warn' } })).toBe(before);

    const stamp = Date.now();
    const company = await prisma.company.create({ data: { name: `任务客户${stamp}`, ownerId: managerId, certStatus: 'APPROVED' } });
    const platform = await prisma.platform.create({ data: { code: `JT${stamp}`.slice(0, 12), name: `任务平台${stamp}`, enabled: true } });
    const drama = await prisma.drama.create({ data: { code: `JD${stamp}`.slice(0, 16), companyId: company.id, title: '未完成日报', nameNorm: `job${stamp}`, language: '英语' } });
    const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() - 24 * 60 * 60 * 1000));
    await prisma.dailyStat.create({
      data: {
        recordId: `JR${stamp}`,
        companyId: company.id,
        platformId: platform.id,
        dramaId: drama.id,
        statDate: new Date(`${yesterday}T00:00:00.000Z`),
        statTimezone: 'Asia/Shanghai',
        titleLocal: '未完成日报',
        language: '英语',
        episodesOnline: 1,
        views: 1,
        viewMetricDef: '播放',
        currency: 'USD',
        dealType: 'NO_MG',
        dataSource: 'BD_NOTE',
        status: 'DRAFT',
        enteredById: adminId,
      },
    });
    const warned = await request(app.getHttpServer()).post('/api/admin/jobs/daily-stats-warn/run').set('Authorization', `Bearer ${admin}`);
    expect(warned.body.pending).toBeGreaterThan(0);
    expect(warned.body.notified).toBeGreaterThan(0);
    expect(await prisma.auditLog.count({ where: { action: 'job.daily-stats-warn' } })).toBe(before + 1);
    const dup = await request(app.getHttpServer()).post('/api/admin/jobs/daily-stats-warn/run').set('Authorization', `Bearer ${admin}`);
    expect(dup.body.notified).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: 'job.daily-stats-warn' } })).toBe(before + 1);
    const manager = await login(managerEmail);
    const notes = await request(app.getHttpServer()).get('/api/notifications?page=1&pageSize=20').set('Authorization', `Bearer ${manager}`);
    expect(notes.status).toBeLessThan(300);
    expect(notes.body.items.some((item: { type: string }) => item.type === 'DS09_WARN')).toBe(true);

    const saved = await request(app.getHttpServer()).put('/api/admin/settings').set('Authorization', `Bearer ${admin}`).send({
      minWithdrawAmount: '10000.00',
      deviationPct: '5',
      syncDeadline: '06:00',
      spotCheckRatio: '0.25',
      reviewSlaDays: '3',
      shareSlaDays: '1',
      slaWarnRatio: '0.8',
      slaDoubleRatio: '2',
    });
    expect(saved.status).toBeLessThan(300);
    expect(saved.body.spotCheckRatio).toBe('0.25');
    expect(saved.body.reviewSlaDays).toBe('3');
    const finance = await login(financeEmail);
    const hidden = await request(app.getHttpServer()).get('/api/admin/settings').set('Authorization', `Bearer ${finance}`);
    expect(hidden.status).toBe(403);
    const template = await request(app.getHttpServer()).get('/api/settlements/amount-template').set('Authorization', `Bearer ${finance}`);
    expect(template.status).toBeLessThan(300);
    expect(String(template.headers['content-type'])).toContain('spreadsheetml.sheet');

    const unknown = await request(app.getHttpServer()).post('/api/admin/jobs/not-a-job/run').set('Authorization', `Bearer ${admin}`);
    expect(unknown.status).toBe(400);

    const byManager = await request(app.getHttpServer()).post('/api/admin/jobs/review-sla/run').set('Authorization', `Bearer ${manager}`);
    expect(byManager.status).toBeLessThan(300);
    expect(byManager.body.job).toBe('review-sla');

    const bd = await login(bdEmail);
    const denied = await request(app.getHttpServer()).post('/api/admin/jobs/review-sla/run').set('Authorization', `Bearer ${bd}`);
    expect(denied.status).toBe(403);
  });
});
