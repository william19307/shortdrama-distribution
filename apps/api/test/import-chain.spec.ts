import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { expectedStatDate } from '@shortform/shared';
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
    put: (url: string) => withAuth(request(server).put(url)),
    patch: (url: string) => withAuth(request(server).patch(url)),
  };
}

async function xlsx(rows: (string | number)[][], headers: string[]) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('日报');
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await book.xlsx.writeBuffer());
}

describe('报表导入整链与应结 Excel', () => {
  const stamp = `${Date.now()}`;
  const opsEmail = `chain-ops-${stamp}@example.com`;
  const managerEmail = `chain-mgr-${stamp}@example.com`;
  const adminEmail = `chain-admin-${stamp}@example.com`;
  const clientEmail = `chain-client-${stamp}@example.com`;
  let ops = '';
  let platformId = '';
  let platformCode = '';
  let dramaId = '';
  let dramaCode = '';
  let companyId = '';

  beforeAll(async () => {
    app = await buildApp();
    await app.init();
    const passwordHash = hashSync(PASS, 4);
    const opsUser = await prisma.user.create({ data: { email: opsEmail, name: '链路专员', role: 'OPS', passwordHash } });
    await prisma.user.create({ data: { email: managerEmail, name: '链路主管', role: 'OPS_MANAGER', passwordHash } });
    await prisma.user.create({ data: { email: adminEmail, name: '链路管理员', role: 'ADMIN', passwordHash } });
    const company = await prisma.company.create({ data: { name: `链路客户${stamp}`, ownerId: opsUser.id, certStatus: 'APPROVED' } });
    await prisma.user.create({ data: { email: clientEmail, name: '链路客户', role: 'CLIENT', passwordHash, companyId: company.id } });
    platformCode = `C${stamp}`.slice(0, 12);
    const platform = await prisma.platform.create({ data: { code: platformCode, name: `链路平台${stamp}`, syncLag: 'T1' } });
    await prisma.platform.create({ data: { code: `D${stamp}`.slice(0, 12), name: `链路前天${stamp}`, syncLag: 'T2' } });
    dramaCode = `DC${stamp}`;
    const drama = await prisma.drama.create({
      data: { code: dramaCode, companyId: company.id, title: 'abcdefghij', titleEn: 'abcdefghij', nameNorm: 'abcdefghij', language: '英语' },
    });
    ops = opsUser.id;
    platformId = platform.id;
    dramaId = drama.id;
    companyId = company.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('DS-01 按平台口径生成同步任务', async () => {
    const admin = await login(adminEmail);
    const ran = await authed(admin).post('/api/admin/jobs/sync-tasks/run');
    expect(ran.status).toBeLessThan(300);
    const opsToken = await login(opsEmail);
    const board = await authed(opsToken).get('/api/daily-sync');
    expect(board.status).toBeLessThan(300);
    const t1 = board.body.find((row: { platform: { id: string } }) => row.platform.id === platformId);
    expect(t1.statDate).toBe(expectedStatDate('T1'));
    expect(t1.status).toBe('PENDING');
    const t2 = board.body.find((row: { platform: { syncLag: string; name: string } }) => row.platform.name.includes('链路前天'));
    expect(t2.statDate).toBe(expectedStatDate('T2'));
  });

  it('DS-02~06 模板、别名、问题行修正并按平台日期发布', async () => {
    const token = await login(opsEmail);
    const headers = ['剧目编号', '剧名', '数据日期', '语言', '平台代码', '上线集数', '播放量', '净收入'];
    const file = await xlsx([
      [dramaCode, 'abcdefghij', '2026-09-01', '英语', platformCode, 8, 100, '12.50'],
      [dramaCode, 'abcdefghij', '2026-09-02', '英语', platformCode, 8, -3, '1.00'],
      ['', 'abcdefghix', '2026-09-03', '英语', platformCode, 8, 10, '1.239'],
    ], headers);
    const uploaded = await authed(token).post(`/api/daily-stats/import?platformId=${platformId}`).attach('file', file, 'report.xlsx');
    expect(uploaded.status).toBeLessThan(300);
    expect(uploaded.body.templateApplied).toBe(false);
    const id = uploaded.body.id as string;
    const saved = await authed(token).put(`/api/daily-stats/import/${id}/mapping`).send({
      mapping: uploaded.body.mapping,
      platformId,
      saveAsTemplate: true,
    });
    expect(saved.status).toBeLessThan(300);
    expect(saved.body.templateVersion).toBe(1);
    const badMoney = saved.body.rows.find((row: { rowNo: number }) => row.rowNo === 4);
    expect(badMoney.errorReason).toContain('两位小数');
    expect(badMoney.candidates.length).toBeGreaterThan(0);
    const negative = saved.body.rows.find((row: { rowNo: number }) => row.rowNo === 3);
    expect(negative.issues.some((issue: { field: string }) => issue.field === 'views')).toBe(true);

    const again = await authed(token).post(`/api/daily-stats/import?platformId=${platformId}`).attach('file', file, 'report-2.xlsx');
    expect(again.body.templateApplied).toBe(true);
    const changed = await xlsx([[dramaCode, 'abcdefghij', '2026-09-04', '英语', platformCode, 1, 1, '1.00']], [...headers, '额外列']);
    const shifted = await authed(token).post(`/api/daily-stats/import?platformId=${platformId}`).attach('file', changed, 'changed.xlsx');
    expect(shifted.body.headerChanged).toBe(true);

    const confirmed = await authed(token).post(`/api/daily-stats/import/${id}/rows/4/confirm`).send({ dramaId });
    expect(confirmed.status).toBeLessThan(300);
    const alias = await prisma.dramaAlias.findFirst({ where: { platformId, dramaId } });
    expect(alias).toBeTruthy();
    const stillMoney = confirmed.body.rows.find((row: { rowNo: number }) => row.rowNo === 4);
    expect(stillMoney.errorReason).toContain('两位小数');
    const fixed = await authed(token).patch(`/api/daily-stats/import/${id}/rows/4`).send({ values: { 净收入: '1.20' } });
    expect(fixed.body.rows.find((row: { rowNo: number }) => row.rowNo === 4).status).toBe('OK');
    const noReason = await authed(token).post(`/api/daily-stats/import/${id}/rows/3/ignore`).send({ reason: '' });
    expect(noReason.status).toBe(400);
    const ignored = await authed(token).post(`/api/daily-stats/import/${id}/rows/3/ignore`).send({ reason: '负数不要' });
    expect(ignored.body.rows.find((row: { rowNo: number }) => row.rowNo === 3).rowAction).toBe('IGNORED');

    const manager = await login(managerEmail);
    const published = await authed(manager).post(`/api/daily-stats/import/${id}/force-publish`).send({ reason: '问题行已处理' });
    expect(published.status).toBeLessThan(300);
    const client = await login(clientEmail);
    const stats = await authed(client).get('/api/daily-stats?page=1&pageSize=20');
    expect(stats.body.items.some((row: { drama: { id: string }; netRevenue: string }) => row.drama.id === dramaId && String(row.netRevenue).startsWith('12.5'))).toBe(true);
    const dash = await authed(client).get('/api/dashboard');
    expect(dash.body.asOf).toContain('数据更新到');
    const task = await prisma.syncTask.findUnique({ where: { platformId_statDate: { platformId, statDate: new Date('2026-09-01T00:00:00.000Z') } } });
    expect(task?.status).toBe('PUBLISHED');
    expect(companyId).toBeTruthy();
    expect(ops).toBeTruthy();
  });

  it('ST-04 应结金额 Excel 预览新增、修改、未变、错误，错误行不入库', async () => {
    const fresh = await prisma.settlement.create({
      data: { code: `JSF${stamp}`, companyId, periodStart: new Date('2026-08-01'), periodEnd: new Date('2026-08-31'), status: 'PENDING_ENTRY' },
    });
    const edited = await prisma.settlement.create({
      data: {
        code: `JSE${stamp}`,
        companyId,
        periodStart: new Date('2026-07-01'),
        periodEnd: new Date('2026-07-31'),
        status: 'PENDING_REVIEW',
        amountCny: '80.00',
        internalNote: '已有',
      },
    });
    const same = await prisma.settlement.create({
      data: {
        code: `JSS${stamp}`,
        companyId,
        periodStart: new Date('2026-06-01'),
        periodEnd: new Date('2026-06-30'),
        status: 'PENDING_REVIEW',
        amountCny: '50.00',
        internalNote: '未变',
      },
    });
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('结算单');
    sheet.addRow(['结算单号', '应结金额', '内部说明', '对客户说明', '修改原因']);
    sheet.addRow([fresh.code, '10.00', '导入新增', '', '']);
    sheet.addRow([edited.code, '90.00', '导入修改', '', '金额调整']);
    sheet.addRow([same.code, '50.00', '未变', '', '']);
    sheet.addRow([fresh.code.replace('JSF', 'NOPE'), '1.239', '坏行', '', '']);
    const token = await login(opsEmail);
    const preview = await authed(token).post('/api/settlements/amount-import').attach('file', Buffer.from(await book.xlsx.writeBuffer()), 'amounts.xlsx');
    expect(preview.status).toBeLessThan(300);
    expect(preview.body.summary).toMatchObject({ created: 1, modified: 1, unchanged: 1, error: 1 });
    const confirmed = await authed(token).post(`/api/settlements/amount-import/${preview.body.id}/confirm`);
    expect(confirmed.status).toBeLessThan(300);
    const freshRow = await prisma.settlement.findUnique({ where: { id: fresh.id } });
    expect(freshRow?.amountCny?.toFixed(2)).toBe('10.00');
    const editedRow = await prisma.settlement.findUnique({ where: { id: edited.id } });
    expect(editedRow?.amountCny?.toFixed(2)).toBe('90.00');
    const log = await prisma.settlementLog.findFirst({ where: { settlementId: edited.id, action: 'Excel 修改应结金额' } });
    expect(log?.after).toMatchObject({ batch: preview.body.code });
    expect(same.id).toBeTruthy();
  });
});
