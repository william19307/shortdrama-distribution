import { INestApplication } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
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
  };
}

async function login(email: string) {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASS });
  expect(res.status).toBeLessThan(300);
  return res.body.accessToken as string;
}

describe('预检失败不落库，客户结算单不带参考金额', () => {
  const stamp = `${Date.now()}`;
  const passwordHash = hashSync(PASS, 4);
  let clientToken = '';
  let financeToken = '';
  let companyId = '';
  let dramaId = '';
  let platformId = '';

  beforeAll(async () => {
    app = await buildApp();
    await app.init();
    const company = await prisma.company.create({ data: { name: `预检客户${stamp}`, certStatus: 'APPROVED' } });
    await prisma.user.create({ data: { email: `precheck-client-${stamp}@example.com`, name: '预检客户', role: 'CLIENT', passwordHash, companyId: company.id } });
    await prisma.user.create({ data: { email: `precheck-finance-${stamp}@example.com`, name: '预检财务', role: 'FINANCE', passwordHash } });
    const platform = await prisma.platform.create({ data: { code: `PC${stamp}`.slice(0, 12), name: `预检平台${stamp}`, firstBatch: true, enabled: true } });
    const drama = await prisma.drama.create({
      data: { code: `PD${stamp}`.slice(0, 24), companyId: company.id, title: `预检短剧${stamp}`, nameNorm: `precheck${stamp}`, language: '英语' },
    });
    await prisma.asset.create({ data: { companyId: company.id, dramaId: drama.id, type: 'LICENSE', name: '授权书', fileKey: `license/${stamp}`, reviewStatus: 'APPROVED' } });
    companyId = company.id;
    dramaId = drama.id;
    platformId = platform.id;
    clientToken = await login(`precheck-client-${stamp}@example.com`);
    financeToken = await login(`precheck-finance-${stamp}@example.com`);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('预检失败不生成计划，补齐成片后同一幂等键可以正式申请', async () => {
    const key = `precheck-${stamp}`;
    const failed = await authed(clientToken).post('/api/plans').send({ dramaId, round: 'FIRST', idempotencyKey: key });
    expect(failed.status).toBeLessThan(300);
    expect(failed.body.status).toBe('PRECHECK_FAILED');
    expect(failed.body.id).toBe('');
    expect(failed.body.precheckNote).toContain('还没有上传成片');
    expect(await prisma.distributionPlan.count({ where: { dramaId } })).toBe(0);

    await prisma.episode.create({ data: { dramaId, no: 1, fileKey: `ep/${stamp}`, reviewStatus: 'PENDING' } });
    const created = await authed(clientToken).post('/api/plans').send({ dramaId, round: 'FIRST', idempotencyKey: key });
    expect(created.status).toBeLessThan(300);
    expect(created.body.status).not.toBe('PRECHECK_FAILED');
    expect(created.body.id).toBeTruthy();
    expect(await prisma.distributionPlan.count({ where: { dramaId, status: 'PRECHECK_FAILED' } })).toBe(0);
    expect(await prisma.distributionPlan.count({ where: { dramaId } })).toBe(1);

    const replay = await authed(clientToken).post('/api/plans').send({ dramaId, round: 'FIRST', idempotencyKey: key });
    expect(replay.body.id).toBe(created.body.id);
    expect(await prisma.distributionPlan.count({ where: { dramaId } })).toBe(1);
  });

  it('客户端结算单不返回参考金额和偏差率，财务仍看得到', async () => {
    const drama = await prisma.drama.findUniqueOrThrow({ where: { id: dramaId } });
    const settlement = await prisma.settlement.create({
      data: {
        code: `ST${stamp}`.slice(0, 24),
        companyId,
        periodStart: new Date('2026-08-01'),
        periodEnd: new Date('2026-08-31'),
        status: 'PENDING_APPLY',
        amountCny: new Prisma.Decimal('1200.00'),
        referenceCny: new Prisma.Decimal('1180.50'),
        deviationPct: new Prisma.Decimal('1.65'),
        internalNote: '内部参考',
        lines: {
          create: {
            dramaId: drama.id,
            platformId,
            platformName: `预检平台${stamp}`,
            currency: 'USD',
            originalAmount: new Prisma.Decimal('100.0000'),
            referenceCny: new Prisma.Decimal('720.00'),
            clientRate: new Prisma.Decimal('50.00'),
            lineAmountCny: new Prisma.Decimal('360.00'),
          },
        },
      },
    });
    const client = await authed(clientToken).get(`/api/settlements/${settlement.id}`);
    expect(client.status).toBeLessThan(300);
    expect(client.body.referenceCny).toBeUndefined();
    expect(client.body.deviationPct).toBeUndefined();
    expect(JSON.stringify(client.body)).not.toContain('referenceCny');
    expect(JSON.stringify(client.body)).not.toContain('deviationPct');
    expect(JSON.stringify(client.body)).not.toContain('1180.50');
    expect(JSON.stringify(client.body)).not.toContain('内部参考');

    const finance = await authed(financeToken).get(`/api/settlements/${settlement.id}`);
    expect(finance.body.referenceCny).toBe('1180.5');
    expect(String(finance.body.deviationPct)).toContain('1.65');
    expect(JSON.stringify(finance.body.lines)).toContain('referenceCny');
  });
});
