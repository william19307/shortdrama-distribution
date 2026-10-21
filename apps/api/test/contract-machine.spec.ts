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
    post: (url: string) => withAuth(request(server).post(url)),
    patch: (url: string) => withAuth(request(server).patch(url)),
  };
}

async function login(email: string) {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASS });
  expect(res.status).toBeLessThan(300);
  return res.body.accessToken as string;
}

describe('合同状态机', () => {
  beforeAll(async () => {
    app = await buildApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('只能按申请中、起草中、待签署、已生效、已到期推进', async () => {
    const stamp = Date.now();
    const company = await prisma.company.create({ data: { name: `合同影业${stamp}`, certStatus: 'APPROVED' } });
    await prisma.user.create({
      data: { email: `contract-${stamp}@example.com`, name: '合同客户', role: 'CLIENT', companyId: company.id, passwordHash: hashSync(PASS, 4) },
    });
    await prisma.user.create({
      data: { email: `contract-admin-${stamp}@example.com`, name: '合同管理员', role: 'ADMIN', passwordHash: hashSync(PASS, 4) },
    });
    const drama = await prisma.drama.create({ data: { code: `HTD${stamp}`, companyId: company.id, title: '合同剧', nameNorm: `合同剧${stamp}` } });
    const client = await login(`contract-${stamp}@example.com`);
    const created = await authed(client).post('/api/contracts').send({ title: '发行合同', dramaIds: [drama.id] });
    expect(created.status).toBeLessThan(300);
    expect(created.body.status).toBe('APPLYING');

    const admin = await login(`contract-admin-${stamp}@example.com`);
    const jump = await authed(admin).patch(`/api/contracts/${created.body.id}`).send({ status: 'EFFECTIVE' });
    expect(jump.status).toBe(400);
    expect(jump.body.message).toContain('不能从');

    const draft = await authed(admin).patch(`/api/contracts/${created.body.id}`).send({ status: 'DRAFTING' });
    expect(draft.status).toBeLessThan(300);
    expect(draft.body.status).toBe('DRAFTING');
    const sign = await authed(admin).patch(`/api/contracts/${created.body.id}`).send({ status: 'PENDING_SIGN' });
    expect(sign.status).toBeLessThan(300);
    const live = await authed(admin).patch(`/api/contracts/${created.body.id}`).send({ status: 'EFFECTIVE' });
    expect(live.status).toBeLessThan(300);
    const expired = await authed(admin).patch(`/api/contracts/${created.body.id}`).send({ status: 'EXPIRED' });
    expect(expired.status).toBeLessThan(300);
    const back = await authed(admin).patch(`/api/contracts/${created.body.id}`).send({ status: 'EFFECTIVE' });
    expect(back.status).toBe(400);
  });
});
