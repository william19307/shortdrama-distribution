import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import request from 'supertest';
import { StorageService } from '../src/core/storage.service';
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
    patch: (url: string) => withAuth(request(server).patch(url)),
  };
}

async function putScan(companyId: string) {
  const key = `${companyId}/contract/${Date.now()}-${Math.random().toString(16).slice(2)}.pdf`;
  const storage = app.get(StorageService);
  await storage.putObject(key, Buffer.from('scan'), 'application/pdf');
  await prisma.uploadSession.create({
    data: {
      companyId,
      key,
      purpose: 'CONTRACT',
      fileName: 'scan.pdf',
      contentType: 'application/pdf',
      size: 4,
      status: 'COMPLETED',
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  return key;
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
    await prisma.user.create({
      data: { email: `contract-ops-${stamp}@example.com`, name: '合同运营', role: 'OPS', passwordHash: hashSync(PASS, 4) },
    });
    const drama = await prisma.drama.create({ data: { code: `HTD${stamp}`, companyId: company.id, title: '合同剧', nameNorm: `合同剧${stamp}` } });
    const client = await login(`contract-${stamp}@example.com`);
    const created = await authed(client).post('/api/contracts').send({ title: '发行合同', dramaIds: [drama.id] });
    expect(created.status).toBeLessThan(300);
    expect(created.body.status).toBe('APPLYING');

    const opsUser = await prisma.user.findUnique({ where: { email: `contract-ops-${stamp}@example.com` } });
    await prisma.company.update({ where: { id: company.id }, data: { ownerId: opsUser!.id } });
    const admin = await login(`contract-admin-${stamp}@example.com`);
    const ops = await login(`contract-ops-${stamp}@example.com`);
    const adminDraft = await authed(admin).patch(`/api/contracts/${created.body.id}`).send({ status: 'DRAFTING' });
    expect(adminDraft.status).toBe(403);
    const jump = await authed(ops).patch(`/api/contracts/${created.body.id}`).send({ status: 'EFFECTIVE' });
    expect(jump.status).toBe(400);
    expect(jump.body.message).toContain('不能从');

    const draft = await authed(ops).patch(`/api/contracts/${created.body.id}`).send({ status: 'DRAFTING' });
    expect(draft.status).toBeLessThan(300);
    expect(draft.body.status).toBe('DRAFTING');
    const sign = await authed(ops).patch(`/api/contracts/${created.body.id}`).send({ status: 'PENDING_SIGN' });
    expect(sign.status).toBeLessThan(300);
    const confirmBare = await authed(ops).patch(`/api/contracts/${created.body.id}`).send({ status: 'PENDING_CONFIRM' });
    expect(confirmBare.status).toBe(400);
    expect(confirmBare.body.message).toContain('扫描件');
    const confirm = await authed(ops).patch(`/api/contracts/${created.body.id}`).send({ status: 'PENDING_CONFIRM', fileKey: await putScan(company.id) });
    expect(confirm.status).toBeLessThan(300);
    expect(confirm.body.status).toBe('PENDING_CONFIRM');
    const live = await authed(ops).patch(`/api/contracts/${created.body.id}`).send({ status: 'EFFECTIVE' });
    expect(live.status).toBeLessThan(300);
    expect(live.body.status).toBe('EFFECTIVE');
    const expired = await authed(ops).patch(`/api/contracts/${created.body.id}`).send({ status: 'EXPIRED' });
    expect(expired.status).toBeLessThan(300);
    const back = await authed(ops).patch(`/api/contracts/${created.body.id}`).send({ status: 'EFFECTIVE' });
    expect(back.status).toBe(400);
  });

  it('客户上传扫描件后才能待确认，财务不能改，商务只能改负责客户', async () => {
    const stamp = Date.now();
    const company = await prisma.company.create({ data: { name: `签署影业${stamp}`, certStatus: 'APPROVED' } });
    const other = await prisma.company.create({ data: { name: `别人的公司${stamp}`, certStatus: 'APPROVED' } });
    await prisma.user.create({ data: { email: `sign-${stamp}@example.com`, name: '签署客户', role: 'CLIENT', companyId: company.id, passwordHash: hashSync(PASS, 4) } });
    await prisma.user.create({ data: { email: `sign-ops-${stamp}@example.com`, name: '签署运营', role: 'OPS', passwordHash: hashSync(PASS, 4) } });
    await prisma.user.create({ data: { email: `sign-bd-${stamp}@example.com`, name: '签署商务', role: 'BD', passwordHash: hashSync(PASS, 4) } });
    await prisma.user.create({ data: { email: `sign-fin-${stamp}@example.com`, name: '签署财务', role: 'FINANCE', passwordHash: hashSync(PASS, 4) } });
    await prisma.user.create({ data: { email: `sign-admin-${stamp}@example.com`, name: '签署管理', role: 'ADMIN', passwordHash: hashSync(PASS, 4) } });
    const ops = await prisma.user.findUnique({ where: { email: `sign-ops-${stamp}@example.com` } });
    const bd = await prisma.user.findUnique({ where: { email: `sign-bd-${stamp}@example.com` } });
    await prisma.company.update({ where: { id: company.id }, data: { ownerId: ops!.id, bdId: bd!.id } });
    const drama = await prisma.drama.create({ data: { code: `SIG${stamp}`, companyId: company.id, title: '签署剧', nameNorm: `签署剧${stamp}` } });
    const otherDrama = await prisma.drama.create({ data: { code: `SIGB${stamp}`, companyId: other.id, title: '别人的剧', nameNorm: `别人${stamp}` } });
    const client = await login(`sign-${stamp}@example.com`);
    const mine = await authed(client).post('/api/contracts').send({ title: '待签合同', dramaIds: [drama.id] });
    const otherClient = await prisma.user.create({ data: { email: `sign-other-${stamp}@example.com`, name: '其他客户', role: 'CLIENT', companyId: other.id, passwordHash: hashSync(PASS, 4) } });
    void otherClient;
    const otherToken = await login(`sign-other-${stamp}@example.com`);
    const foreign = await authed(otherToken).post('/api/contracts').send({ title: '别人的合同', dramaIds: [otherDrama.id] });
    const admin = await login(`sign-admin-${stamp}@example.com`);
    const opsToken = await login(`sign-ops-${stamp}@example.com`);
    const blocked = await authed(admin).patch(`/api/contracts/${mine.body.id}`).send({ status: 'DRAFTING' });
    expect(blocked.status).toBe(403);
    await authed(opsToken).patch(`/api/contracts/${mine.body.id}`).send({ status: 'DRAFTING' });
    await authed(opsToken).patch(`/api/contracts/${mine.body.id}`).send({ status: 'PENDING_SIGN' });

    const finance = await login(`sign-fin-${stamp}@example.com`);
    const finPatch = await authed(finance).patch(`/api/contracts/${mine.body.id}`).send({ note: '财务备注' });
    expect(finPatch.status).toBe(403);

    const bdToken = await login(`sign-bd-${stamp}@example.com`);
    const outside = await authed(bdToken).patch(`/api/contracts/${foreign.body.id}`).send({ status: 'DRAFTING' });
    expect(outside.status).toBe(403);
    const listed = await authed(bdToken).get('/api/contracts?page=1&pageSize=50');
    expect(listed.status).toBeLessThan(300);
    expect(listed.body.items.every((item: { companyId: string }) => item.companyId === company.id)).toBe(true);

    const jump = await authed(client).patch(`/api/contracts/${mine.body.id}`).send({ status: 'EFFECTIVE' });
    expect(jump.status).toBe(403);
    const missing = await authed(client).patch(`/api/contracts/${mine.body.id}`).send({ fileKey: `${company.id}/contract/missing.pdf` });
    expect(missing.status).toBe(400);
    expect(missing.body.message).toContain('不存在');
    const foreignKey = await putScan(other.id);
    const stolen = await authed(client).patch(`/api/contracts/${mine.body.id}`).send({ fileKey: foreignKey });
    expect(stolen.status).toBe(400);
    expect(stolen.body.message).toContain('不属于');

    const uploaded = await authed(client).patch(`/api/contracts/${mine.body.id}`).send({ fileKey: await putScan(company.id) });
    expect(uploaded.status).toBeLessThan(300);
    expect(uploaded.body.status).toBe('PENDING_CONFIRM');
    const clientLive = await authed(client).patch(`/api/contracts/${mine.body.id}`).send({ status: 'EFFECTIVE' });
    expect(clientLive.status).toBe(403);
    const bdLive = await authed(bdToken).patch(`/api/contracts/${mine.body.id}`).send({ status: 'EFFECTIVE' });
    expect(bdLive.status).toBe(403);

    const live = await authed(opsToken).patch(`/api/contracts/${mine.body.id}`).send({ status: 'EFFECTIVE' });
    expect(live.status).toBeLessThan(300);
    expect(live.body.status).toBe('EFFECTIVE');
  });
});
