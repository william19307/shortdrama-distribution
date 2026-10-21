import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import request from 'supertest';
import { buildApp } from '../src/main';

const PASS = 'Demo123456';
const prisma = new PrismaClient();
let app: INestApplication;
let adminEmail = '';
let managerEmail = '';
let bdEmail = '';

async function login(email: string) {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASS });
  expect(res.status).toBeLessThan(300);
  return res.body.accessToken as string;
}

describe('手动触发定时任务', () => {
  beforeAll(async () => {
    app = await buildApp();
    await app.init();
    const stamp = Date.now();
    adminEmail = `jobs-admin-${stamp}@example.com`;
    managerEmail = `jobs-manager-${stamp}@example.com`;
    bdEmail = `jobs-bd-${stamp}@example.com`;
    await prisma.user.create({ data: { email: adminEmail, name: '任务管理员', role: 'ADMIN', passwordHash: hashSync(PASS, 4) } });
    await prisma.user.create({ data: { email: managerEmail, name: '任务主管', role: 'OPS_MANAGER', passwordHash: hashSync(PASS, 4) } });
    await prisma.user.create({ data: { email: bdEmail, name: '任务商务', role: 'BD', passwordHash: hashSync(PASS, 4) } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /admin/jobs/:name/run 可触发已知任务，未知任务 400，商务 403', async () => {
    const admin = await login(adminEmail);
    const ran = await request(app.getHttpServer()).post('/api/admin/jobs/daily-stats-warn/run').set('Authorization', `Bearer ${admin}`);
    expect(ran.status).toBeLessThan(300);
    expect(typeof ran.body.notified).toBe('number');
    expect(ran.body.job).toBe('daily-stats-warn');
    const again = await request(app.getHttpServer()).post('/api/admin/jobs/daily-stats-warn/run').set('Authorization', `Bearer ${admin}`);
    expect(again.status).toBeLessThan(300);
    expect(await prisma.auditLog.count({ where: { action: 'job.daily-stats-warn' } })).toBe(1);

    const unknown = await request(app.getHttpServer()).post('/api/admin/jobs/not-a-job/run').set('Authorization', `Bearer ${admin}`);
    expect(unknown.status).toBe(400);

    const manager = await login(managerEmail);
    const byManager = await request(app.getHttpServer()).post('/api/admin/jobs/review-sla/run').set('Authorization', `Bearer ${manager}`);
    expect(byManager.status).toBeLessThan(300);
    expect(byManager.body.job).toBe('review-sla');

    const bd = await login(bdEmail);
    const denied = await request(app.getHttpServer()).post('/api/admin/jobs/review-sla/run').set('Authorization', `Bearer ${bd}`);
    expect(denied.status).toBe(403);
  });
});
