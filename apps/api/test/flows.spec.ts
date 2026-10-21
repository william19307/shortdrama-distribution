import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import request from 'supertest';
import { buildApp } from '../src/main';

const PASS = 'Demo123456';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

let app: INestApplication;
const prisma = new PrismaClient();

async function login(email: string, password = PASS) {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password });
  expect(res.status).toBeLessThan(300);
  return { token: res.body.accessToken as string, user: res.body.user };
}

function authed(token: string) {
  const server = app.getHttpServer();
  const withAuth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);
  return {
    get: (url: string) => withAuth(request(server).get(url)),
    post: (url: string) => withAuth(request(server).post(url)),
    put: (url: string) => withAuth(request(server).put(url)),
    patch: (url: string) => withAuth(request(server).patch(url)),
  };
}

async function upload(token: string, filename: string, body: Buffer, purpose: string, extra: Record<string, unknown> = {}) {
  const init = await authed(token).post('/api/storage/uploads').send({
    filename,
    contentType: filename.endsWith('.png') ? 'image/png' : 'application/octet-stream',
    size: body.length,
    purpose,
    ...extra,
  });
  expect(init.status).toBeLessThan(300);
  const put = await authed(token).put(init.body.url).set('Content-Type', 'application/octet-stream').send(body);
  expect(put.status).toBeLessThan(300);
  const done = await authed(token).post(`/api/storage/uploads/${init.body.id}/complete`).send({});
  expect(done.status).toBeLessThan(300);
  return done.body as { key: string };
}

describe('核心流程', () => {
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
    await prisma.user.create({
      data: { email: 'admin-test@studio.example', name: '测试管理员', role: 'ADMIN', passwordHash: hashSync(PASS, 4) },
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('登录、认证、首发不可删、驳回重提、保底不可见、结算复核与提款门槛、分页、水印、发票', async () => {
    const admin = await login('admin-test@studio.example');
    const opsRes = await authed(admin.token).post('/api/admin/users').send({ email: 'ops-test@studio.example', password: PASS, name: '测试运营', role: 'OPS' });
    expect(opsRes.status).toBeLessThan(300);
    const finRes = await authed(admin.token).post('/api/admin/users').send({ email: 'fin-test@studio.example', password: PASS, name: '测试财务', role: 'FINANCE' });
    expect(finRes.status).toBeLessThan(300);
    const mgrRes = await authed(admin.token).post('/api/admin/users').send({ email: 'mgr-test@studio.example', password: PASS, name: '测试主管', role: 'OPS_MANAGER' });
    expect(mgrRes.status).toBeLessThan(300);
    const ops = await login('ops-test@studio.example');
    const finance = await login('fin-test@studio.example');
    const manager = await login('mgr-test@studio.example');

    for (const name of ['ReelShort', 'DramaBox', 'ShortMax', 'FlexTV', 'GoodShort']) {
      const created = await authed(admin.token).post('/api/platforms').send({ name, syncLag: name === 'ShortMax' ? 'T2' : 'T1' });
      expect(created.status).toBeLessThan(300);
      const patched = await authed(manager.token).patch(`/api/platforms/${created.body.id}`).send({ firstBatch: true, enabled: true });
      expect(patched.status).toBeLessThan(300);
      const opsFirst = await authed(ops.token).patch(`/api/platforms/${created.body.id}`).send({ enabled: false });
      expect(opsFirst.status).toBe(403);
    }
    const listed = await authed(manager.token).get('/api/platforms');
    const confirmed = await authed(manager.token).patch(`/api/platforms/${listed.body[0].id}`).send({ firstBatch: true });
    expect(confirmed.status).toBeLessThan(300);

    const registered = await request(app.getHttpServer()).post('/api/auth/register').send({
      email: 'client-test@studio.example',
      password: PASS,
      name: '测试客户',
      companyName: '测试影业',
    });
    expect(registered.status).toBeLessThan(300);
    const clientToken = registered.body.accessToken as string;
    const companyId = registered.body.user.companyId as string;
    const mgrCompanies = await authed(manager.token).get('/api/companies?page=1&pageSize=20');
    expect(mgrCompanies.status).toBeLessThan(300);
    expect(mgrCompanies.body.total).toBeGreaterThan(0);
    await authed(manager.token).patch(`/api/companies/${companyId}/owner`).send({ ownerId: ops.user.id });
    const adminOwner = await authed(admin.token).patch(`/api/companies/${companyId}/owner`).send({ ownerId: ops.user.id });
    expect(adminOwner.status).toBe(403);

    const cert = await authed(clientToken).put('/api/company/certification').send({
      name: '测试影业有限公司',
      creditCode: '91310000TESTCODE01',
      legalPerson: '测法人',
      contactName: '测联系人',
      contactPhone: '13800001111',
    });
    expect(cert.status).toBeLessThan(300);
    expect(cert.body.certStatus).toBe('PENDING');
    const approved = await authed(finance.token).post(`/api/companies/${companyId}/certification/review`).send({ pass: true });
    expect(approved.status).toBeLessThan(300);

    const bank = await authed(clientToken).post('/api/bank-accounts').send({
      accountName: '测试影业有限公司',
      bankName: '招商银行',
      accountNo: '6222000011112222',
      isDefault: true,
    });
    expect(bank.status).toBeLessThan(300);

    const drama = await authed(clientToken).post('/api/dramas').send({ title: '测试短剧', language: '英语', episodeCountExpected: 2 });
    expect(drama.status).toBeLessThan(300);
    const dramaId = drama.body.id as string;
    await upload(clientToken, 'ep1.mp4', Buffer.from('episode-one'), 'EPISODE', { dramaId, episodeNo: 1 });
    await upload(clientToken, 'license.pdf', Buffer.from('license'), 'LICENSE', { dramaId });
    const pendingPlan = await authed(clientToken).post('/api/plans').send({ dramaId, round: 'FIRST' });
    expect(pendingPlan.status).toBe(400);
    expect(pendingPlan.body.message).toContain('审核通过');
    const license = await prisma.asset.findFirst({ where: { dramaId, type: 'LICENSE' } });
    const approvedLicense = await authed(ops.token).post(`/api/assets/${license!.id}/review`).send({ pass: true });
    expect(approvedLicense.status).toBeLessThan(300);

    const platforms = await authed(clientToken).get('/api/platforms');
    const firstIds = (platforms.body as { id: string; firstBatch: boolean }[]).filter((item) => item.firstBatch).map((item) => item.id);
    const blocked = await authed(clientToken).post('/api/plans').send({ dramaId, round: 'FIRST', platformIds: firstIds.slice(0, 2) });
    expect(blocked.status).toBe(400);
    expect(blocked.body.message).toContain('首发平台为固定名单');

    const planRes = await authed(clientToken).post('/api/plans').send({ dramaId, round: 'FIRST', idempotencyKey: 'plan-1' });
    expect(planRes.status).toBeLessThan(300);
    expect(planRes.body.status).toBe('PENDING_REVIEW');
    expect(planRes.body.platforms).toHaveLength(5);
    const planId = planRes.body.id as string;

    const opened = await authed(ops.token).post(`/api/reviews/${planId}/open`);
    expect(opened.status).toBeLessThan(300);
    const opsAssign = await authed(ops.token).post(`/api/reviews/${planId}/assign`).send({ assigneeId: ops.user.id });
    expect(opsAssign.status).toBe(403);
    const assigned = await authed(manager.token).post(`/api/reviews/${planId}/assign`).send({ assigneeId: ops.user.id });
    expect(assigned.status).toBeLessThan(300);
    const opsExpand = await authed(ops.token).post(`/api/reviews/${planId}/expand`);
    expect(opsExpand.status).toBe(403);
    const expanded = await authed(manager.token).post(`/api/reviews/${planId}/expand`);
    expect(expanded.status).toBeLessThan(300);
    const episodeId = opened.body.episodes[0].id as string;
    const rejected = await authed(ops.token).post(`/api/reviews/${planId}/episodes/${episodeId}`).send({ decision: 'REJECTED', reason: '字幕需要修改' });
    expect(rejected.status).toBeLessThan(300);
    const needs = await authed(ops.token).post(`/api/reviews/${planId}/finish`);
    expect(needs.body.status).toBe('NEEDS_REVISION');

    await upload(clientToken, 'ep1b.mp4', Buffer.from('episode-replaced'), 'EPISODE', { dramaId, episodeNo: 1 });
    const again = await authed(clientToken).post(`/api/plans/${planId}/resubmit`);
    expect(again.status).toBeLessThan(300);
    expect(again.body.episodes[0].reviewStatus).toBe('PENDING');
    const passed = await authed(ops.token).post(`/api/reviews/${planId}/episodes/${episodeId}`).send({ decision: 'APPROVED' });
    expect(passed.status).toBeLessThan(300);
    const shareReady = await authed(ops.token).post(`/api/reviews/${planId}/finish`);
    expect(shareReady.body.status).toBe('SHARE_CONFIG');

    const items = shareReady.body.platforms.map((item: { platformId: string }) => ({
      platformId: item.platformId,
      mode: 'MG',
      clientRate: '40',
      guaranteeAmount: '1000',
      guaranteeCurrency: 'USD',
      guaranteePeriodDays: 90,
    }));
    const adminShares = await authed(admin.token).put(`/api/plans/${planId}/shares`).send({ items });
    expect(adminShares.status).toBe(403);
    const shares = await authed(ops.token).put(`/api/plans/${planId}/shares`).send({ items });
    expect(shares.status).toBeLessThan(300);
    const clientView = await authed(clientToken).get(`/api/plans/${planId}`);
    const dumped = JSON.stringify(clientView.body);
    expect(dumped).not.toContain('guaranteeAmount');
    expect(dumped).not.toContain('guaranteeCurrency');
    expect(clientView.body.shares[0].clientRate).toBeDefined();
    expect(clientView.body.shares[0].mode).toBeUndefined();

    const selfShare = await authed(admin.token).post(`/api/plans/${planId}/shares/review`).send({ pass: true });
    expect(selfShare.status).toBe(403);
    const financeShare = await authed(finance.token).post(`/api/plans/${planId}/shares/review`).send({ pass: true });
    expect(financeShare.status).toBe(403);
    const shareOk = await authed(manager.token).post(`/api/plans/${planId}/shares/review`).send({ pass: true });
    expect(shareOk.status).toBeLessThan(300);
    expect(shareOk.body.status).toBe('APPROVED');
    const tickets = await authed(clientToken).get('/api/tickets?page=1&pageSize=20');
    expect(JSON.stringify(tickets.body)).not.toContain('保底');
    expect(JSON.stringify(tickets.body)).not.toContain('guaranteeAmount');

    const shotFile = await upload(ops.token, 'ReelShort_测试短剧_20261001_数据_1.png', PNG, 'WATERMARK_SOURCE', { dramaId });
    const shot = await authed(ops.token).post('/api/watermarks').send({ fileKey: shotFile.key, dramaId, shotDate: '2026-10-01', kind: 'DATA', filename: 'ReelShort_测试短剧_20261001_数据_1.png' });
    expect(shot.status).toBeLessThan(300);
    expect(shot.body.sha256).toBeTruthy();
    expect(shot.body.url).toBeTruthy();

    const daily = await authed(ops.token).post('/api/daily-stats').send({
      statDate: '2026-10-01',
      statTimezone: 'America/Los_Angeles',
      platformId: firstIds[0],
      dramaId,
      titleLocal: 'Test Drama',
      language: '英语',
      episodesOnline: 1,
      views: 1200,
      viewMetricDef: '平台后台播放次数',
      netRevenue: '80.5',
      currency: 'USD',
      dealType: 'MG_SHARE',
      dataSource: 'SCREENSHOT',
      watermarkId: shot.body.id,
    });
    expect(daily.status).toBeLessThan(300);
    const opsForce = await authed(ops.token).post(`/api/daily-stats/${daily.body.id}/force-publish`).send({ reason: '专员不能代发' });
    expect(opsForce.status).toBe(403);
    const forced = await authed(manager.token).post(`/api/daily-stats/${daily.body.id}/force-publish`).send({ reason: '主管确认后发布' });
    expect(forced.status).toBeLessThan(300);
    expect(forced.body.status).toBe('REVIEWED');
    const opsReport = await authed(ops.token).post(`/api/daily-stats/${daily.body.id}/report`).send({ note: '播放对不上' });
    expect(opsReport.status).toBe(403);
    const reported = await authed(manager.token).post(`/api/daily-stats/${daily.body.id}/report`).send({ note: '播放对不上' });
    expect(reported.status).toBeLessThan(300);
    expect(reported.body.status).toBe('ANOMALY');
    const selfDaily = await authed(ops.token).post(`/api/daily-stats/${daily.body.id}/review`);
    expect(selfDaily.status).toBe(403);
    const reviewed = await authed(finance.token).post(`/api/daily-stats/${daily.body.id}/review`);
    expect(reviewed.status).toBeLessThan(300);
    const locked = await authed(finance.token).post(`/api/daily-stats/${daily.body.id}/lock`);
    expect(locked.body.status).toBe('LOCKED');
    const clientDaily = await authed(clientToken).get('/api/daily-stats?page=1&pageSize=10');
    expect(JSON.stringify(clientDaily.body)).not.toContain('mgAmount');

    const small = await authed(ops.token).post('/api/settlements/generate').send({ companyId, periodStart: '2026-10-01', periodEnd: '2026-10-31' });
    expect(small.status).toBeLessThan(300);
    const badMoney = await authed(ops.token).post(`/api/settlements/${small.body.id}/amount`).send({ amountCny: '100.123', internalNote: '三位小数' });
    expect(badMoney.status).toBe(400);
    expect(JSON.stringify(badMoney.body)).toContain('两位小数');
    const badNumber = await authed(ops.token).post(`/api/settlements/${small.body.id}/amount`).send({ amountCny: 100.129, internalNote: '数字三位小数' });
    expect(badNumber.status).toBe(400);
    expect(JSON.stringify(badNumber.body)).toContain('两位小数');
    const adminAmount = await authed(admin.token).post(`/api/settlements/${small.body.id}/amount`).send({ amountCny: '100.00', internalNote: '管理员不能录入' });
    expect(adminAmount.status).toBe(403);
    const entered = await authed(ops.token).post(`/api/settlements/${small.body.id}/amount`).send({ amountCny: '100.00', internalNote: '手工应结，内部可见' });
    expect(entered.status).toBeLessThan(300);
    const selfSettle = await authed(ops.token).post(`/api/settlements/${small.body.id}/review`).send({ pass: true });
    expect(selfSettle.status).toBe(403);
    const below = await authed(finance.token).post(`/api/settlements/${small.body.id}/review`).send({ pass: true });
    expect(below.body.status).toBe('BELOW_MINIMUM');

    const big = await authed(ops.token).post('/api/settlements/generate').send({ companyId, periodStart: '2026-11-01', periodEnd: '2026-11-30' });
    await authed(ops.token).post(`/api/settlements/${big.body.id}/amount`).send({ amountCny: '15000.00', internalNote: '第二期手工应结' });
    const ready = await authed(finance.token).post(`/api/settlements/${big.body.id}/review`).send({ pass: true });
    expect(ready.body.status).toBe('PENDING_APPLY');
    const clientSettle = await authed(clientToken).get(`/api/settlements/${small.body.id}`);
    expect(clientSettle.body.internalNote).toBeUndefined();
    expect(clientSettle.body.referenceCny).toBeUndefined();
    expect(clientSettle.body.deviationPct).toBeUndefined();
    expect(JSON.stringify(clientSettle.body)).not.toContain('手工应结');
    expect(JSON.stringify(clientSettle.body)).not.toContain('referenceCny');

    const tooSmall = await authed(clientToken).post('/api/withdrawals').send({ settlementIds: [small.body.id], bankAccountId: bank.body.id });
    expect(tooSmall.status).toBe(400);
    const withdraw = await authed(clientToken).post('/api/withdrawals').send({
      settlementIds: [small.body.id, big.body.id],
      bankAccountId: bank.body.id,
      idempotencyKey: 'wd-1',
    });
    expect(withdraw.status).toBeLessThan(300);

    await authed(finance.token).post(`/api/withdrawals/${withdraw.body.id}/verify`).send({ pass: true });
    const invoiceFile = await upload(clientToken, 'invoice.pdf', Buffer.from('invoice'), 'INVOICE');
    await authed(clientToken).post(`/api/withdrawals/${withdraw.body.id}/invoice`).send({ invoiceKey: invoiceFile.key, invoiceNo: 'INV-1' });
    const rejectedInvoice = await authed(finance.token).post(`/api/withdrawals/${withdraw.body.id}/invoice/review`).send({ pass: false, reason: '抬头不一致' });
    expect(rejectedInvoice.body.status).toBe('PENDING_INVOICE');
    await authed(clientToken).post(`/api/withdrawals/${withdraw.body.id}/invoice`).send({ invoiceKey: invoiceFile.key, invoiceNo: 'INV-2' });
    const paying = await authed(finance.token).post(`/api/withdrawals/${withdraw.body.id}/invoice/review`).send({ pass: true });
    expect(paying.body.status).toBe('PAYING');
    const voucher = await upload(finance.token, 'voucher.pdf', Buffer.from('voucher'), 'VOUCHER', { companyId });
    const paid = await authed(finance.token).post(`/api/withdrawals/${withdraw.body.id}/pay`).send({ voucherKey: voucher.key });
    expect(paid.body.status).toBe('PAID');

    for (let index = 0; index < 3; index += 1) {
      await authed(clientToken).post('/api/dramas').send({ title: `分页剧${index}`, language: '英语' });
    }
    const page = await authed(clientToken).get('/api/dramas?page=2&pageSize=2');
    expect(page.body.page).toBe(2);
    expect(page.body.pageSize).toBe(2);
    expect(page.body.total).toBeGreaterThanOrEqual(4);
    expect(page.body.items).toHaveLength(2);
  });
});
