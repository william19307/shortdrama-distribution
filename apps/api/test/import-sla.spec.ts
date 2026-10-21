import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { buildApp } from '../src/main';

const PASS = 'Demo123456';
const prisma = new PrismaClient();
let app: INestApplication;

async function login(email: string) {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASS });
  expect(res.status).toBeLessThan(300);
  return res.body.accessToken as string;
}

function authed(token: string) {
  const server = app.getHttpServer();
  const withAuth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);
  return {
    get: (url: string) => withAuth(request(server).get(url)),
    post: (url: string) => withAuth(request(server).post(url)),
  };
}

describe('报表导入与审核 SLA', () => {
  const stamp = Date.now();
  const opsEmail = `import-ops-${stamp}@example.com`;
  const otherEmail = `import-ops2-${stamp}@example.com`;
  const managerEmail = `import-manager-${stamp}@example.com`;
  const adminEmail = `import-admin-${stamp}@example.com`;
  let opsId = '';
  let otherId = '';
  let dramaCode = '';
  let platformCode = '';
  let planId = '';

  beforeAll(async () => {
    app = await buildApp();
    await app.init();
    const passwordHash = hashSync(PASS, 4);
    const ops = await prisma.user.create({ data: { email: opsEmail, name: '导入专员甲', role: 'OPS', passwordHash } });
    const other = await prisma.user.create({ data: { email: otherEmail, name: '导入专员乙', role: 'OPS', passwordHash } });
    await prisma.user.create({ data: { email: managerEmail, name: '导入主管', role: 'OPS_MANAGER', passwordHash } });
    await prisma.user.create({ data: { email: adminEmail, name: '导入管理员', role: 'ADMIN', passwordHash } });
    opsId = ops.id;
    otherId = other.id;
    const company = await prisma.company.create({ data: { name: `导入客户${stamp}`, ownerId: ops.id } });
    platformCode = `P${stamp}`;
    const platform = await prisma.platform.create({ data: { code: platformCode, name: `导入平台${stamp}` } });
    dramaCode = `D${stamp}`;
    const drama = await prisma.drama.create({
      data: { code: dramaCode, companyId: company.id, title: `导入剧${stamp}`, nameNorm: `导入剧${stamp}`, language: '英语' },
    });
    const plan = await prisma.distributionPlan.create({
      data: {
        code: `PL${stamp}`,
        dramaId: drama.id,
        companyId: company.id,
        round: 'FIRST',
        status: 'IN_REVIEW',
        assigneeId: ops.id,
        submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        slaDueAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    });
    planId = plan.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('Excel 标出超两位小数的问题行，专员提交主管，主管强制发布，管理员不能导入', async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('日报');
    sheet.addRow(['剧目编号', '剧名', '数据日期', '语言', '平台代码', '上线集数', '播放量', '净收入']);
    sheet.addRow([dramaCode, '导入剧', '2026-10-01', '英语', platformCode, 8, 100, 12.5]);
    sheet.addRow([dramaCode, '导入剧', '2026-10-02', '英语', platformCode, 8, 80, 12.345]);
    sheet.addRow(['NO-SUCH', '不存在', '2026-10-03', '英语', platformCode, 1, 1, 1]);
    const buffer = Buffer.from(await book.xlsx.writeBuffer());

    const ops = await login(opsEmail);
    const admin = await login(adminEmail);
    const denied = await authed(admin).post('/api/daily-stats/import').attach('file', buffer, 'report.xlsx');
    expect(denied.status).toBe(403);

    const uploaded = await authed(ops).post('/api/daily-stats/import').attach('file', buffer, 'report.xlsx');
    expect(uploaded.status).toBeLessThan(300);
    const id = uploaded.body.id as string;
    const checked = await authed(ops).post(`/api/daily-stats/import/${id}/validate`);
    expect(checked.status).toBeLessThan(300);
    expect(checked.body.summary.ok).toBe(1);
    expect(checked.body.summary.error).toBe(2);
    const moneyRow = checked.body.rows.find((row: { rowNo: number }) => row.rowNo === 3);
    expect(moneyRow.status).toBe('ERROR');
    expect(moneyRow.errorReason).toContain('两位小数');

    const marked = await authed(ops).post(`/api/daily-stats/import/${id}/rows/2/mark`).send({ reason: '抽查标为问题行' });
    expect(marked.status).toBeLessThan(300);
    expect(marked.body.rows.find((row: { rowNo: number }) => row.rowNo === 2).status).toBe('ERROR');
    const unmarked = await authed(ops).post(`/api/daily-stats/import/${id}/validate`);
    expect(unmarked.body.summary.ok).toBe(1);

    const blocked = await authed(ops).post(`/api/daily-stats/import/${id}/publish`);
    expect(blocked.status).toBe(400);
    const submitted = await authed(ops).post(`/api/daily-stats/import/${id}/submit-manager`).send({ note: '请主管看问题行' });
    expect(submitted.status).toBeLessThan(300);
    expect(submitted.body.status).toBe('SUBMITTED_MANAGER');
    const managers = await prisma.user.findMany({ where: { role: 'OPS_MANAGER', disabled: false }, select: { id: true } });
    const notes = await prisma.notification.count({
      where: { type: 'IMPORT_SUBMIT_MANAGER', entityId: id, userId: { in: managers.map((row) => row.id) } },
    });
    expect(notes).toBeGreaterThan(0);

    const opsForce = await authed(ops).post(`/api/daily-stats/import/${id}/force-publish`).send({ reason: '专员不能强制发布' });
    expect(opsForce.status).toBe(403);
    const manager = await login(managerEmail);
    const forced = await authed(manager).post(`/api/daily-stats/import/${id}/force-publish`).send({ reason: '演示强制发布' });
    expect(forced.status).toBeLessThan(300);
    expect(forced.body.status).toBe('FORCE_PUBLISHED');
    expect(forced.body.summary.published).toBe(1);
    expect(forced.body.summary.excluded).toBe(2);
    const saved = await prisma.dailyStat.findFirst({ where: { drama: { code: dramaCode }, netRevenue: { not: null } } });
    expect(saved?.netRevenue?.toFixed(2)).toBe('12.50');
  });

  it('主管能看 SLA 看板并分派给专员', async () => {
    const manager = await login(managerEmail);
    const board = await authed(manager).get('/api/reviews/sla-board');
    expect(board.status).toBeLessThan(300);
    const hit = board.body.items.find((item: { id: string }) => item.id === planId);
    expect(hit.tier === 'overdue' || hit.tier === 'double').toBe(true);

    const other = await login(otherEmail);
    const hidden = await authed(other).get('/api/reviews/sla-board');
    expect(hidden.body.items.find((item: { id: string }) => item.id === planId)).toBeUndefined();

    const assigned = await authed(manager).post(`/api/reviews/${planId}/assign`).send({ assigneeId: otherId });
    expect(assigned.status).toBeLessThan(300);
    expect(assigned.body.assigneeId).toBe(otherId);
    const visible = await authed(other).get('/api/reviews/sla-board');
    expect(visible.body.items.find((item: { id: string }) => item.id === planId)?.assigneeId).toBe(otherId);
    expect(opsId).not.toBe(otherId);
  });
});
