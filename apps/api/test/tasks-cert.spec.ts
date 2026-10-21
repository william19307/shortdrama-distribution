import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import request from 'supertest';
import { buildApp } from '../src/main';

const PASS = 'Demo123456';
const prisma = new PrismaClient();
let app: INestApplication;

function authed(token: string) {
  const server = app.getHttpServer();
  const withAuth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);
  return {
    get: (url: string) => withAuth(request(server).get(url)),
    post: (url: string) => withAuth(request(server).post(url)),
    put: (url: string) => withAuth(request(server).put(url)),
  };
}

async function login(email: string) {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASS });
  expect(res.status).toBeLessThan(300);
  return res.body.accessToken as string;
}

describe('认证向导与任务中心', () => {
  const stamp = `${Date.now()}`;
  const passwordHash = hashSync(PASS, 4);
  let clientToken = '';
  let otherToken = '';
  let managerToken = '';

  beforeAll(async () => {
    app = await buildApp();
    await app.init();
    const company = await prisma.company.create({ data: { name: `未认证${stamp}`, certStatus: 'UNVERIFIED' } });
    const otherCompany = await prisma.company.create({ data: { name: `另一客户${stamp}`, certStatus: 'APPROVED' } });
    await prisma.user.create({ data: { email: `cert-client-${stamp}@example.com`, name: '认证客户', role: 'CLIENT', passwordHash, companyId: company.id } });
    await prisma.user.create({ data: { email: `cert-other-${stamp}@example.com`, name: '另一客户', role: 'CLIENT', passwordHash, companyId: otherCompany.id } });
    await prisma.user.create({ data: { email: `cert-manager-${stamp}@example.com`, name: '任务主管', role: 'OPS_MANAGER', passwordHash } });
    clientToken = await login(`cert-client-${stamp}@example.com`);
    otherToken = await login(`cert-other-${stamp}@example.com`);
    managerToken = await login(`cert-manager-${stamp}@example.com`);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('EA-01 提交执照、法人和联系人后进入审核中', async () => {
    const res = await authed(clientToken).put('/api/company/certification').send({
      name: '未认证影业有限公司',
      creditCode: '91310000EA01CODE01',
      legalPerson: '法人甲',
      contactName: '联系人甲',
      contactPhone: '13800002222',
      licenseKey: `license/${stamp}.png`,
    });
    expect(res.status).toBeLessThan(300);
    expect(res.body.certStatus).toBe('PENDING');
    expect(res.body.licenseKey).toBe(`license/${stamp}.png`);
  });

  it('CF-09 取消剩余保留已成功项，重试只处理失败项，客户只能看自己的任务', async () => {
    const running = await authed(clientToken).post('/api/tasks').send({
      name: '导出进行中',
      defer: true,
      items: [{ key: 'a' }, { key: 'b' }, { key: 'c' }],
    });
    expect(running.status).toBeLessThan(300);
    expect(running.body.status).toBe('RUNNING');
    expect(running.body.progress).toBe(0);
    expect(running.body.succeeded).toBe(0);

    const stepped = await authed(clientToken).post(`/api/tasks/${running.body.id}/step`);
    expect(stepped.body.succeeded).toBe(1);
    expect(stepped.body.status).toBe('RUNNING');

    const cancelled = await authed(clientToken).post(`/api/tasks/${running.body.id}/cancel`);
    expect(cancelled.body.status).toBe('CANCELLED');
    expect(cancelled.body.succeeded).toBe(1);
    expect(cancelled.body.skipped).toBe(2);
    const kept = (cancelled.body.items as { key: string; status: string }[]).find((item) => item.key === 'a');
    expect(kept?.status).toBe('SUCCESS');
    const skipped = (cancelled.body.items as { key: string; status: string; message: string }[]).filter((item) => item.status === 'SKIPPED');
    expect(skipped).toHaveLength(2);
    expect(skipped.every((item) => item.message === '已取消')).toBe(true);

    const partial = await authed(clientToken).post('/api/tasks').send({
      name: '部分成功',
      items: [{ key: 'ok' }, { key: 'bad', failOnce: true }],
    });
    expect(partial.body.status).toBe('PARTIAL');
    expect(partial.body.succeeded).toBe(1);
    expect(partial.body.failed).toBe(1);
    const okBefore = (partial.body.items as { key: string; attempts: number }[]).find((item) => item.key === 'ok');
    expect(okBefore?.attempts).toBe(1);

    const again = await authed(clientToken).post(`/api/tasks/${partial.body.id}/retry`);
    expect(again.body.status).toBe('SUCCESS');
    expect(again.body.failed).toBe(0);
    const items = again.body.items as { key: string; attempts: number; status: string }[];
    expect(items.find((item) => item.key === 'ok')).toMatchObject({ status: 'SUCCESS', attempts: 1 });
    expect(items.find((item) => item.key === 'bad')).toMatchObject({ status: 'SUCCESS', attempts: 2 });

    const report = await authed(clientToken).get(`/api/tasks/${partial.body.id}/report`);
    expect(report.status).toBeLessThan(300);
    expect(report.text).toContain('ok,SUCCESS');
    expect(report.text).toContain('bad,SUCCESS');

    const mine = await authed(otherToken).post('/api/tasks').send({
      name: '别人的任务',
      defer: true,
      items: [{ key: 'only-other' }],
    });
    const clientList = await authed(clientToken).get('/api/tasks?page=1&pageSize=50');
    const clientIds = (clientList.body.items as { id: string }[]).map((item) => item.id);
    expect(clientIds).toContain(running.body.id);
    expect(clientIds).not.toContain(mine.body.id);
    const denied = await authed(clientToken).get(`/api/tasks/${mine.body.id}/report`);
    expect(denied.status).toBe(403);
    expect(JSON.stringify(denied.body)).toContain('只能查看自己的任务');

    const managerList = await authed(managerToken).get('/api/tasks?page=1&pageSize=50');
    const managerIds = (managerList.body.items as { id: string }[]).map((item) => item.id);
    expect(managerIds).toContain(running.body.id);
    expect(managerIds).toContain(mine.body.id);
  });
});
