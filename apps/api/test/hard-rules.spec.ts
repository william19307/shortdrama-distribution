import { execFileSync } from 'child_process';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import request from 'supertest';
import { jwtSecret } from '../src/core/auth';
import { StorageService } from '../src/core/storage.service';
import { toPlain } from '../src/core/plain';
import { shareDto } from '../src/core/viewer-dto';
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

async function login(email: string) {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASS });
  expect(res.status).toBeLessThan(300);
  return res.body.accessToken as string;
}

describe('保底白名单与生产密钥', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env.NODE_ENV = env.NODE_ENV;
    process.env.JWT_SECRET = env.JWT_SECRET;
  });

  it('分成白名单不带保底和额外字段，运营仍看得到', () => {
    const share = { id: '1', platformId: 'p', clientRate: '50', overRate: null, reviewStatus: 'APPROVED', mode: 'MG', guaranteeAmount: '1000', guaranteeCurrency: 'USD', secretNote: '内部' };
    expect(shareDto(share)).toEqual({ id: '1', platformId: 'p', clientRate: '50', overRate: null, reviewStatus: 'APPROVED' });
    expect(JSON.stringify(toPlain(share, 'BD'))).not.toContain('guaranteeAmount');
    expect(JSON.stringify(toPlain(share, 'CLIENT'))).not.toContain('secretNote');
    expect(JSON.stringify(toPlain(share, 'OPS'))).toContain('guaranteeAmount');
  });

  it('生产环境缺少合格 JWT_SECRET 时直接报错，开发环境可用默认值', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    expect(() => jwtSecret()).toThrow(/JWT_SECRET/);
    process.env.JWT_SECRET = 'change-me-this-is-long-enough-secret';
    expect(() => jwtSecret()).toThrow(/JWT_SECRET/);
    process.env.JWT_SECRET = 'short';
    expect(() => jwtSecret()).toThrow(/JWT_SECRET/);
    process.env.JWT_SECRET = 'a'.repeat(32);
    expect(jwtSecret()).toHaveLength(32);
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    expect(jwtSecret()).toBe('dev-only-change-me');
  });
});

describe('提款并发、商务隔离、合同状态机、主管复核', () => {
  beforeAll(async () => {
    app = await buildApp();
    await app.init();
    await prisma.$executeRawUnsafe(`
      DO $$ DECLARE r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations') LOOP
          EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
        END LOOP;
      END $$;
    `);
    await prisma.user.create({ data: { email: 'admin-rules@studio.example', name: '规则管理员', role: 'ADMIN', passwordHash: hashSync(PASS, 4) } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('幂等键必填，重复键不重复锁单，并发第二次冲突', async () => {
    const admin = await login('admin-rules@studio.example');
    expect((await authed(admin).post('/api/admin/users').send({ email: 'fin-rules@studio.example', password: PASS, name: '规则财务', role: 'FINANCE' })).status).toBeLessThan(300);
    const company = await prisma.company.create({ data: { name: '并发影业', certStatus: 'APPROVED' } });
    await prisma.user.create({ data: { email: 'race@example.com', name: '并发客户', role: 'CLIENT', companyId: company.id, passwordHash: hashSync(PASS, 4) } });
    const bank = await prisma.bankAccount.create({ data: { companyId: company.id, accountName: '并发影业', bankName: '测试银行', accountNo: '62220001' } });
    const settlement = await prisma.settlement.create({
      data: { code: 'JS-RACE-1', companyId: company.id, periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'), status: 'PENDING_APPLY', amountCny: '20000.00' },
    });
    const client = await login('race@example.com');
    const missing = await authed(client).post('/api/withdrawals').send({ settlementIds: [settlement.id], bankAccountId: bank.id });
    expect(missing.status).toBe(400);
    expect(missing.body.message).toContain('幂等');

    const first = await authed(client).post('/api/withdrawals').send({ settlementIds: [settlement.id], bankAccountId: bank.id, idempotencyKey: 'same-key' });
    expect(first.status).toBeLessThan(300);
    const again = await authed(client).post('/api/withdrawals').send({ settlementIds: [settlement.id], bankAccountId: bank.id, idempotencyKey: 'same-key' });
    expect(again.status).toBeLessThan(300);
    expect(again.body.id).toBe(first.body.id);
    expect(await prisma.withdrawal.count({ where: { companyId: company.id } })).toBe(1);

    const second = await prisma.settlement.create({
      data: { code: 'JS-RACE-2', companyId: company.id, periodStart: new Date('2026-02-01'), periodEnd: new Date('2026-02-28'), status: 'PENDING_APPLY', amountCny: '18000.00' },
    });
    const [left, right] = await Promise.all([
      authed(client).post('/api/withdrawals').send({ settlementIds: [second.id], bankAccountId: bank.id, idempotencyKey: 'race-a' }),
      authed(client).post('/api/withdrawals').send({ settlementIds: [second.id], bankAccountId: bank.id, idempotencyKey: 'race-b' }),
    ]);
    const statuses = [left.status, right.status].sort((a, b) => a - b);
    expect(statuses[0]).toBeLessThan(300);
    expect([400, 409]).toContain(statuses[1]);
    expect(await prisma.withdrawal.count({ where: { settlements: { some: { id: second.id } } } })).toBe(1);
    const locked = await prisma.settlement.findUnique({ where: { id: second.id } });
    expect(locked?.status).toBe('VERIFYING');
    expect(locked?.withdrawalId).toBeTruthy();

    const third = await prisma.settlement.create({
      data: { code: 'JS-RACE-3', companyId: company.id, periodStart: new Date('2026-06-01'), periodEnd: new Date('2026-06-30'), status: 'PENDING_APPLY', amountCny: '15000.00' },
    });
    const grab = () => prisma.$transaction(async (tx) => {
      const rows = await tx.settlement.findMany({ where: { id: third.id, status: 'PENDING_APPLY', withdrawalId: null } });
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (rows.length !== 1) return 'missed';
      const updated = await tx.settlement.updateMany({ where: { id: third.id, status: 'PENDING_APPLY', withdrawalId: null }, data: { status: 'VERIFYING' } });
      return updated.count === 1 ? 'locked' : 'conflict';
    });
    const raced = (await Promise.all([grab(), grab()])).sort();
    expect(raced).toEqual(['conflict', 'locked']);
  });

  it('提款状态推进不一致时整笔回滚', async () => {
    const finance = await login('fin-rules@studio.example');
    const company = await prisma.company.findFirst({ where: { name: '并发影业' } });
    const bank = await prisma.bankAccount.findFirst({ where: { companyId: company!.id } });
    const withdrawal = await prisma.withdrawal.create({
      data: { code: 'TX-BAD', companyId: company!.id, bankAccountId: bank!.id, amountCny: '100.00', status: 'VERIFYING' },
    });
    const settlement = await prisma.settlement.create({
      data: { code: 'JS-BAD', companyId: company!.id, periodStart: new Date('2026-03-01'), periodEnd: new Date('2026-03-31'), status: 'PENDING_APPLY', amountCny: '100.00', withdrawalId: withdrawal.id },
    });
    const res = await authed(finance).post(`/api/withdrawals/${withdrawal.id}/verify`).send({ pass: true });
    expect(res.status).toBe(409);
    expect((await prisma.withdrawal.findUnique({ where: { id: withdrawal.id } }))?.status).toBe('VERIFYING');
    expect((await prisma.settlement.findUnique({ where: { id: settlement.id } }))?.status).toBe('PENDING_APPLY');
  });

  it('商务不能看结算和提款，主管可以复核别人录入的金额但不能复核自己', async () => {
    const admin = await login('admin-rules@studio.example');
    expect((await authed(admin).post('/api/admin/users').send({ email: 'bd-rules@studio.example', password: PASS, name: '规则商务', role: 'BD' })).status).toBeLessThan(300);
    expect((await authed(admin).post('/api/admin/users').send({ email: 'lead-rules@studio.example', password: PASS, name: '规则主管', role: 'OPS_MANAGER' })).status).toBeLessThan(300);
    expect((await authed(admin).post('/api/admin/users').send({ email: 'ops-rules@studio.example', password: PASS, name: '规则运营', role: 'OPS' })).status).toBeLessThan(300);
    const bd = await login('bd-rules@studio.example');
    expect((await authed(bd).get('/api/settlements?page=1&pageSize=10')).status).toBe(403);
    expect((await authed(bd).get('/api/withdrawals?page=1&pageSize=10')).status).toBe(403);

    const ops = await prisma.user.findUnique({ where: { email: 'ops-rules@studio.example' } });
    const leadUser = await prisma.user.findUnique({ where: { email: 'lead-rules@studio.example' } });
    const company = await prisma.company.findFirst({ where: { name: '并发影业' } });
    const row = await prisma.settlement.create({
      data: {
        code: 'JS-LEAD',
        companyId: company!.id,
        periodStart: new Date('2026-04-01'),
        periodEnd: new Date('2026-04-30'),
        status: 'PENDING_REVIEW',
        amountCny: '12000.00',
        enteredById: ops!.id,
        internalNote: '内部',
      },
    });
    const lead = await login('lead-rules@studio.example');
    const passed = await authed(lead).post(`/api/settlements/${row.id}/review`).send({ pass: true });
    expect(passed.status).toBeLessThan(300);
    expect(passed.body.status === 'PENDING_APPLY' || passed.body.status === 'BELOW_MINIMUM').toBe(true);

    const own = await prisma.settlement.create({
      data: { code: 'JS-OWN', companyId: company!.id, periodStart: new Date('2026-05-01'), periodEnd: new Date('2026-05-31'), status: 'PENDING_REVIEW', amountCny: '8000.00', enteredById: leadUser!.id },
    });
    const denied = await authed(lead).post(`/api/settlements/${own.id}/review`).send({ pass: true });
    expect(denied.status).toBe(403);
  });

  it('日报录入人不能复核自己的数据，主管可以复核别人录入的', async () => {
    const ops = await prisma.user.findUnique({ where: { email: 'ops-rules@studio.example' } });
    const leadUser = await prisma.user.findUnique({ where: { email: 'lead-rules@studio.example' } });
    const company = await prisma.company.findFirst({ where: { name: '并发影业' } });
    const platform = await prisma.platform.create({ data: { code: 'DLY', name: '日报平台', color: '#E8173A' } });
    const drama = await prisma.drama.create({ data: { code: 'D-DAILY', companyId: company!.id, title: '日报剧', nameNorm: '日报剧' } });
    const base = {
      companyId: company!.id,
      platformId: platform.id,
      dramaId: drama.id,
      statTimezone: 'UTC',
      titleLocal: '日报剧',
      language: '英语',
      episodesOnline: 1,
      views: 12,
      viewMetricDef: '播放',
      currency: 'USD',
      dealType: 'NO_MG' as const,
      dataSource: 'SCREENSHOT' as const,
      evidenceSha256: 'a'.repeat(64),
    };
    const own = await prisma.dailyStat.create({
      data: { ...base, recordId: 'R-OWN', statDate: new Date('2026-04-01'), enteredById: leadUser!.id },
    });
    const token = await login('lead-rules@studio.example');
    const selfReview = await authed(token).post(`/api/daily-stats/${own.id}/review`);
    expect(selfReview.status).toBe(403);
    expect((await prisma.dailyStat.findUnique({ where: { id: own.id } }))?.status).toBe('DRAFT');

    const other = await prisma.dailyStat.create({
      data: { ...base, recordId: 'R-OPS', statDate: new Date('2026-04-02'), enteredById: ops!.id },
    });
    const passed = await authed(token).post(`/api/daily-stats/${other.id}/review`);
    expect(passed.status).toBeLessThan(300);
    expect(passed.body.status).toBe('REVIEWED');
    expect(passed.body.reviewedById).toBe(leadUser!.id);
  });

  it('合同只能按申请、起草、待签、生效、到期推进', async () => {
    const company = await prisma.company.findFirst({ where: { name: '并发影业' } });
    const drama = await prisma.drama.create({ data: { code: 'D-CONTRACT', companyId: company!.id, title: '合同剧', nameNorm: '合同剧' } });
    const client = await login('race@example.com');
    const created = await authed(client).post('/api/contracts').send({ title: '发行合同', dramaIds: [drama.id] });
    expect(created.status).toBeLessThan(300);
    const admin = await login('admin-rules@studio.example');
    const jump = await authed(admin).patch(`/api/contracts/${created.body.id}`).send({ status: 'EFFECTIVE' });
    expect(jump.status).toBe(400);
    const draft = await authed(admin).patch(`/api/contracts/${created.body.id}`).send({ status: 'DRAFTING' });
    expect(draft.status).toBeLessThan(300);
    const sign = await authed(admin).patch(`/api/contracts/${created.body.id}`).send({ status: 'PENDING_SIGN' });
    expect(sign.status).toBeLessThan(300);
    const fileKey = `${company!.id}/contract/scan.pdf`;
    await app.get(StorageService).putObject(fileKey, Buffer.from('scan'), 'application/pdf');
    await prisma.uploadSession.create({
      data: { companyId: company!.id, key: fileKey, purpose: 'CONTRACT', fileName: 'scan.pdf', contentType: 'application/pdf', size: 4, status: 'COMPLETED', expiresAt: new Date(Date.now() + 3_600_000) },
    });
    const confirm = await authed(admin).patch(`/api/contracts/${created.body.id}`).send({ status: 'PENDING_CONFIRM', fileKey });
    expect(confirm.status).toBeLessThan(300);
    const live = await authed(admin).patch(`/api/contracts/${created.body.id}`).send({ status: 'EFFECTIVE' });
    expect(live.status).toBeLessThan(300);
  });
});

describe('演示种子', () => {
  const database = process.env.DATABASE_URL || 'postgresql://shortform:shortform@localhost:5432/shortform_test';

  function runSeed(flag: string) {
    return execFileSync('pnpm', ['exec', 'tsx', 'prisma/seed.ts'], {
      cwd: '/workspace/apps/api',
      env: { ...process.env, SEED_DEMO: flag, DATABASE_URL: database, NODE_ENV: 'test' },
      encoding: 'utf8',
    });
  }

  it('未设置 SEED_DEMO 时不写数据', async () => {
    const before = await prisma.user.count();
    const output = runSeed('');
    expect(output).toContain('跳过演示种子');
    expect(await prisma.user.count()).toBe(before);
  });

  it('再次灌种子不重置已有密码', async () => {
    const email = 'ops@studio.example';
    await prisma.user.deleteMany({ where: { email } });
    await prisma.user.create({ data: { email, name: '旧密码', role: 'OPS', passwordHash: hashSync('CustomPass99', 4) } });
    runSeed('true');
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.name).toBe('林晓');
    const { compareSync } = await import('bcryptjs');
    expect(compareSync('CustomPass99', user!.passwordHash)).toBe(true);
    expect(compareSync('Demo123456', user!.passwordHash)).toBe(false);
  });
});
