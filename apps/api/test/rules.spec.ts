import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import request from 'supertest';
import { shanghaiToday } from '@shortform/shared';
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
    patch: (url: string) => withAuth(request(server).patch(url)),
  };
}

async function login(email: string) {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASS });
  expect(res.status).toBeLessThan(300);
  return { token: res.body.accessToken as string, user: res.body.user as { id: string } };
}

describe('分派、全审、结算周期与首批名单', () => {
  const stamp = `${Date.now()}`;
  const opsAEmail = `rule-a-${stamp}@example.com`;
  const opsBEmail = `rule-b-${stamp}@example.com`;
  const opsCEmail = `rule-c-${stamp}@example.com`;
  const managerEmail = `rule-mgr-${stamp}@example.com`;
  const adminEmail = `rule-admin-${stamp}@example.com`;
  const ownedEmail = `rule-owned-${stamp}@example.com`;
  const freeEmail = `rule-free-${stamp}@example.com`;
  let opsA = '';
  let opsB = '';
  let manager = '';
  let admin = '';
  let ownedToken = '';
  let freeToken = '';
  let ownedCompany = '';
  let freeCompany = '';
  let fillerDrama = '';
  let mutedOps: string[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await app.init();
    const passwordHash = hashSync(PASS, 4);
    const a = await prisma.user.create({ data: { email: opsAEmail, name: '专员甲', role: 'OPS', passwordHash } });
    const b = await prisma.user.create({ data: { email: opsBEmail, name: '专员乙', role: 'OPS', passwordHash } });
    const c = await prisma.user.create({ data: { email: opsCEmail, name: '专员丙', role: 'OPS', passwordHash } });
    await prisma.user.create({ data: { email: managerEmail, name: '规则主管', role: 'OPS_MANAGER', passwordHash } });
    await prisma.user.create({ data: { email: adminEmail, name: '规则管理员', role: 'ADMIN', passwordHash } });
    const owned = await prisma.company.create({ data: { name: `有主客户${stamp}`, ownerId: a.id, certStatus: 'APPROVED' } });
    const free = await prisma.company.create({ data: { name: `无主客户${stamp}`, certStatus: 'APPROVED' } });
    await prisma.user.create({ data: { email: ownedEmail, name: '有主客户', role: 'CLIENT', passwordHash, companyId: owned.id } });
    await prisma.user.create({ data: { email: freeEmail, name: '无主客户', role: 'CLIENT', passwordHash, companyId: free.id } });
    const filler = await prisma.drama.create({ data: { code: `RF${stamp}`, companyId: owned.id, title: '占位', nameNorm: `filler${stamp}`, language: '英语' } });
    await prisma.distributionPlan.createMany({
      data: [0, 1].map((i) => ({
        code: `RC${stamp}${i}`,
        dramaId: filler.id,
        companyId: free.id,
        round: 'SECOND' as const,
        status: 'IN_REVIEW' as const,
        assigneeId: c.id,
      })),
    });
    const others = await prisma.user.findMany({ where: { role: 'OPS', disabled: false, id: { notIn: [a.id, b.id, c.id] } }, select: { id: true } });
    mutedOps = others.map((row) => row.id);
    if (mutedOps.length) await prisma.user.updateMany({ where: { id: { in: mutedOps } }, data: { disabled: true } });
    await prisma.platform.create({ data: { code: `RFB${stamp}`.slice(0, 12), name: `规则首发${stamp}`, firstBatch: true, enabled: true } });
    opsA = a.id;
    opsB = b.id;
    ownedCompany = owned.id;
    freeCompany = free.id;
    fillerDrama = filler.id;
    const sessions = await Promise.all([login(opsAEmail), login(opsBEmail), login(managerEmail), login(adminEmail), login(ownedEmail), login(freeEmail)]);
    manager = sessions[2].token;
    admin = sessions[3].token;
    ownedToken = sessions[4].token;
    freeToken = sessions[5].token;
  });

  afterAll(async () => {
    if (mutedOps.length) await prisma.user.updateMany({ where: { id: { in: mutedOps } }, data: { disabled: false } });
    await app.close();
    await prisma.$disconnect();
  });

  async function makeDrama(companyId: string, title: string, episodes: number) {
    return prisma.drama.create({
      data: {
        code: `RD${title}${stamp}`.replace(/\s/g, '').slice(0, 24),
        companyId,
        title,
        nameNorm: title.toLowerCase(),
        language: '英语',
        episodes: { create: Array.from({ length: episodes }, (_, i) => ({ no: i + 1, fileKey: `${title}-${i + 1}`, fileName: `ep${i + 1}.mp4` })) },
        assets: { create: { companyId, type: 'LICENSE', name: '授权书', fileKey: `lic-${title}`, reviewStatus: 'APPROVED' } },
      },
    });
  }

  it('RV-01 按在审量自动分派，满员则待分派', async () => {
    const first = await makeDrama(ownedCompany, `首剧${stamp}`, 10);
    const ownedPlan = await authed(ownedToken).post('/api/plans').send({ dramaId: first.id, round: 'FIRST' });
    expect(ownedPlan.status).toBeLessThan(300);
    expect(ownedPlan.body.assigneeId).toBe(opsA);
    expect(ownedPlan.body.status).toBe('PENDING_REVIEW');
    expect(ownedPlan.body.slaDueAt).toBeTruthy();

    const loose = await makeDrama(freeCompany, `无主剧${stamp}`, 2);
    const freePlan = await authed(freeToken).post('/api/plans').send({ dramaId: loose.id, round: 'FIRST' });
    expect(freePlan.status).toBeLessThan(300);
    expect(freePlan.body.assigneeId).toBe(opsB);
    expect(freePlan.body.status).toBe('PENDING_REVIEW');
    const queue = await authed((await login(opsBEmail)).token).get('/api/plans?page=1&pageSize=50');
    expect(queue.body.items.some((item: { id: string }) => item.id === freePlan.body.id)).toBe(true);
    const hidden = await authed((await login(opsAEmail)).token).get(`/api/plans/${freePlan.body.id}`);
    expect(hidden.status).toBe(403);

    const open = await prisma.distributionPlan.count({ where: { assigneeId: opsA, status: { in: ['PENDING_REVIEW', 'IN_REVIEW'] } } });
    await prisma.distributionPlan.createMany({
      data: Array.from({ length: 30 - open }, (_, i) => ({
        code: `CAP${stamp}${i}`,
        dramaId: fillerDrama,
        companyId: ownedCompany,
        round: 'SECOND' as const,
        status: 'PENDING_REVIEW' as const,
        assigneeId: opsA,
      })),
    });
    const second = await makeDrama(ownedCompany, `次剧${stamp}`, 10);
    const held = await authed(ownedToken).post('/api/plans').send({ dramaId: second.id, round: 'FIRST' });
    expect(held.status).toBeLessThan(300);
    expect(held.body.status).toBe('PENDING_ASSIGN');
    expect(held.body.assigneeId).toBeNull();
    expect(held.body.slaDueAt).toBeNull();
    const assigned = await authed(manager).post(`/api/reviews/${held.body.id}/assign`).send({ assigneeId: opsB });
    expect(assigned.status).toBeLessThan(300);
    expect(assigned.body.assigneeId).toBe(opsB);
    expect(assigned.body.slaDueAt).toBeTruthy();
  });

  it('RV-04 新客户前 3 部剧全审，预检失败不算', async () => {
    const freshCompany = await prisma.company.create({ data: { name: `全新${stamp}`, ownerId: opsA, certStatus: 'APPROVED' } });
    const passwordHash = hashSync(PASS, 4);
    const email = `rule-fresh-${stamp}@example.com`;
    await prisma.user.create({ data: { email, name: '全新客户', role: 'CLIENT', passwordHash, companyId: freshCompany.id } });
    const failedDrama = await prisma.drama.create({ data: { code: `FAIL${stamp}`, companyId: freshCompany.id, title: '失败占位', nameNorm: `fail${stamp}`, language: '英语' } });
    await prisma.distributionPlan.create({ data: { code: `PF${stamp}`, dramaId: failedDrama.id, companyId: freshCompany.id, round: 'FIRST', status: 'PRECHECK_FAILED' } });
    const session = await login(email);
    for (const title of ['全审甲', '全审乙', '全审丙']) {
      const drama = await makeDrama(freshCompany.id, `${title}${stamp}`, 10);
      const plan = await authed(session.token).post('/api/plans').send({ dramaId: drama.id, round: 'FIRST' });
      expect(plan.status).toBeLessThan(300);
      const episodes = await prisma.episode.findMany({ where: { dramaId: drama.id } });
      expect(episodes.every((episode) => episode.reviewStatus === 'PENDING')).toBe(true);
    }
    const fourth = await makeDrama(freshCompany.id, `抽检${stamp}`, 10);
    const sampled = await authed(session.token).post('/api/plans').send({ dramaId: fourth.id, round: 'FIRST' });
    expect(sampled.status).toBeLessThan(300);
    const unsampled = await prisma.episode.count({ where: { dramaId: fourth.id, reviewStatus: 'UNSAMPLED' } });
    expect(unsampled).toBeGreaterThan(0);
  });

  it('ST-01 结算周期按版本保存，不改已有结算单', async () => {
    const first = await authed(manager).put(`/api/companies/${ownedCompany}/settlement-policy`).send({ cycleType: 'MONTH', anchorDate: '2026-01-01', note: '自然月' });
    expect(first.status).toBeLessThan(300);
    const settlement = await prisma.settlement.create({
      data: { code: `SV${stamp}`, companyId: ownedCompany, periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'), amountCny: '88.50', status: 'PENDING_REVIEW' },
    });
    const second = await authed(manager).put(`/api/companies/${ownedCompany}/settlement-policy`).send({ cycleType: 'QUARTER', anchorDate: '2026-04-01', note: '季度' });
    expect(second.status).toBeLessThan(300);
    expect(second.body.cycleType).toBe('QUARTER');
    const plan = await prisma.distributionPlan.findFirst({ where: { companyId: ownedCompany, status: 'PENDING_REVIEW' } });
    const project = await authed(manager).put(`/api/plans/${plan!.id}/settlement-policy`).send({ cycleType: 'CUSTOM_DAYS', customDays: 15, anchorDate: '2026-02-01', note: '项目覆盖' });
    expect(project.status).toBeLessThan(300);
    const loaded = await authed(manager).get(`/api/companies/${ownedCompany}/settlement-policy`);
    expect(loaded.body.companyPolicy.cycleType).toBe('QUARTER');
    expect(loaded.body.projects.some((item: { cycleType: string; planId: string }) => item.planId === plan!.id && item.cycleType === 'CUSTOM_DAYS')).toBe(true);
    const companyVersions = (loaded.body.versions as { version: number; companyId: string | null; planId: string | null }[]).filter((item) => item.companyId === ownedCompany);
    expect(companyVersions.map((item) => item.version).sort()).toEqual([1, 2]);
    const kept = await prisma.settlement.findUnique({ where: { id: settlement.id } });
    expect(kept?.amountCny?.toFixed(2)).toBe('88.50');
    expect(kept?.policyVersionId).toBeNull();
    const version = await prisma.settlementPolicyVersion.findFirst({ where: { companyId: ownedCompany }, orderBy: { version: 'desc' } });
    expect(version?.effectiveFrom).toBeTruthy();
  });

  it('ST-03 三位小数和缺备注被拒绝，0 可以提交', async () => {
    const row = await prisma.settlement.create({
      data: { code: `SM${stamp}`, companyId: ownedCompany, periodStart: new Date('2026-02-01'), periodEnd: new Date('2026-02-28'), status: 'PENDING_ENTRY' },
    });
    const ops = await login(opsAEmail);
    const bad = await authed(ops.token).post(`/api/settlements/${row.id}/amount`).send({ amountCny: '1.239', internalNote: '三位小数' });
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.body)).toContain('两位小数');
    const bare = await authed(ops.token).post(`/api/settlements/${row.id}/amount`).send({ amountCny: '1.20' });
    expect(bare.status).toBe(400);
    const zero = await authed(ops.token).post(`/api/settlements/${row.id}/amount`).send({ amountCny: '0', internalNote: '零金额' });
    expect(zero.status).toBeLessThan(300);
    expect(zero.body.status).toBe('PENDING_REVIEW');
  });

  it('CF-01 首批增删需主管确认，口径次日生效', async () => {
    for (const name of ['ReelShort', 'DramaBox', 'ShortMax', 'FlexTV', 'GoodShort']) {
      const hit = await prisma.platform.findUnique({ where: { name } });
      if (!hit) await prisma.platform.create({ data: { code: `I${name}`.slice(0, 12), name, firstBatch: true, enabled: true } });
      else expect(hit.firstBatch).toBe(true);
    }
    const listed = await authed(admin).get('/api/platforms');
    const names = (listed.body as { name: string; firstBatch: boolean }[]).filter((item) => item.firstBatch).map((item) => item.name);
    for (const name of ['ReelShort', 'DramaBox', 'ShortMax', 'FlexTV', 'GoodShort']) expect(names).toContain(name);

    const extra = await prisma.platform.create({ data: { code: `NX${stamp}`.slice(0, 12), name: `非首批${stamp}`, firstBatch: false, enabled: true, syncLag: 'T1' } });
    const ops = await login(opsAEmail);
    const stopped = await authed(ops.token).patch(`/api/platforms/${extra.id}`).send({ enabled: false });
    expect(stopped.status).toBeLessThan(300);
    expect(stopped.body.enabled).toBe(false);
    expect(stopped.body.pendingConfirmation).toBeUndefined();

    const asked = await authed(ops.token).patch(`/api/platforms/${extra.id}`).send({ firstBatch: true });
    expect(asked.status).toBeLessThan(300);
    expect(asked.body.pendingConfirmation).toBe(true);
    expect(asked.body.firstBatch).toBe(false);
    const adminTry = await authed(admin).patch(`/api/platforms/${extra.id}`).send({ firstBatch: true });
    expect(adminTry.status).toBe(403);
    const confirmed = await authed(manager).post(`/api/platforms/roster-requests/${asked.body.request.id}/confirm`);
    expect(confirmed.status).toBeLessThan(300);
    expect(confirmed.body.firstBatch).toBe(true);
    expect(confirmed.body.enabled).toBe(false);
    const selectable = await prisma.platform.count({ where: { id: extra.id, firstBatch: true, enabled: true } });
    expect(selectable).toBe(0);

    const lag = await authed(ops.token).patch(`/api/platforms/${extra.id}`).send({ syncLag: 'T2' });
    expect(lag.body.syncLag).toBe('T1');
    expect(lag.body.syncLagPending).toBe('T2');
    await prisma.platform.update({ where: { id: extra.id }, data: { syncLagEffectiveOn: new Date(`${shanghaiToday()}T00:00:00.000Z`) } });
    const ran = await authed(admin).post('/api/admin/jobs/sync-tasks/run');
    expect(ran.status).toBeLessThan(300);
    const applied = await prisma.platform.findUnique({ where: { id: extra.id } });
    expect(applied?.syncLag).toBe('T2');
    expect(applied?.syncLagPending).toBeNull();
    const audits = await prisma.auditLog.count({
      where: { OR: [{ entityId: extra.id }, { entityId: asked.body.request.id }], action: { in: ['platform.update', 'platform.roster.request', 'platform.roster.confirm', 'platform.sync-lag.apply'] } },
    });
    expect(audits).toBeGreaterThan(0);

    const own = await prisma.platformRosterRequest.create({ data: { platformId: extra.id, firstBatch: false, requestedById: (await prisma.user.findUniqueOrThrow({ where: { email: managerEmail } })).id } });
    const self = await authed(manager).post(`/api/platforms/roster-requests/${own.id}/confirm`);
    expect(self.status).toBe(403);
    const rejected = await authed(manager).post(`/api/platforms/roster-requests/${asked.body.request.id}/reject`).send({ note: '保持现状' });
    expect(rejected.status).toBe(400);
  });

  it('RV-12 同一工单同一档位只提醒一次', async () => {
    const drama = await prisma.drama.create({ data: { code: `SLA${stamp}`.slice(0, 24), companyId: ownedCompany, title: '超时剧', nameNorm: `sla${stamp}`, language: '英语' } });
    const due = new Date(Date.now() - 24 * 3600 * 1000);
    const plan = await prisma.distributionPlan.create({
      data: { code: `SL${stamp}`.slice(0, 24), dramaId: drama.id, companyId: ownedCompany, round: 'FIRST', status: 'IN_REVIEW', assigneeId: opsA, submittedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000), slaDueAt: due },
    });
    const first = await authed(manager).post('/api/admin/jobs/review-sla/run');
    expect(first.status).toBeLessThan(300);
    const once = await prisma.notification.count({ where: { entityId: { contains: plan.id } } });
    expect(once).toBeGreaterThan(0);
    const second = await authed(manager).post('/api/admin/jobs/review-sla/run');
    expect(second.body.deduped).toBeGreaterThan(0);
    const twice = await prisma.notification.count({ where: { entityId: { contains: plan.id } } });
    expect(twice).toBe(once);
  });
});
