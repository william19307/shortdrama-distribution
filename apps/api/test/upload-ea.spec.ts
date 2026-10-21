import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import ExcelJS from 'exceljs';
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
    patch: (url: string) => withAuth(request(server).patch(url)),
  };
}

function xlsx(req: request.Test) {
  return req.buffer(true).parse((res, callback) => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer | string) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    res.on('end', () => callback(null, Buffer.concat(chunks)));
  });
}

async function login(email: string) {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASS });
  expect(res.status).toBeLessThan(300);
  return res.body.accessToken as string;
}

describe('技术校验拦发行、元数据预览、筛选全选、认证草稿和批量驳回', () => {
  const stamp = `${Date.now()}`;
  const passwordHash = hashSync(PASS, 4);
  let clientToken = '';
  let opsToken = '';
  let adminToken = '';
  let companyId = '';
  let certCompanyId = '';
  let certToken = '';
  let failedDramaId = '';
  let readyDramaId = '';
  let reviewPlanId = '';
  let sharePlanId = '';

  beforeAll(async () => {
    app = await buildApp();
    await app.init();
    await prisma.rejectReason.upsert({
      where: { code: 'QUALITY' },
      update: { enabled: true },
      create: { code: 'QUALITY', category: '画质', title: '画质不达标', template: '画面模糊/分辨率不足/压缩痕迹明显，请提供不低于 720P 的成片。', sort: 10 },
    });
    await prisma.rejectReason.upsert({
      where: { code: 'OTHER' },
      update: { enabled: true },
      create: { code: 'OTHER', category: '其他', title: '其他', template: '请根据补充说明修改。', sort: 999 },
    });
    const ops = await prisma.user.create({ data: { email: `ea-ops-${stamp}@example.com`, name: '校验专员', role: 'OPS', passwordHash } });
    const admin = await prisma.user.create({ data: { email: `ea-admin-${stamp}@example.com`, name: '校验管理员', role: 'ADMIN', passwordHash } });
    const company = await prisma.company.create({ data: { name: `校验客户${stamp}`, ownerId: ops.id, certStatus: 'APPROVED' } });
    await prisma.user.create({ data: { email: `ea-client-${stamp}@example.com`, name: '校验客户', role: 'CLIENT', passwordHash, companyId: company.id } });
    const certCompany = await prisma.company.create({ data: { name: `草稿企业${stamp}`, certStatus: 'UNVERIFIED' } });
    await prisma.user.create({ data: { email: `ea-cert-${stamp}@example.com`, name: '草稿客户', role: 'CLIENT', passwordHash, companyId: certCompany.id } });
    await prisma.platform.create({ data: { code: `EA${stamp}`.slice(0, 12), name: `校验平台${stamp}`, firstBatch: true, enabled: true } });
    const failed = await prisma.drama.create({
      data: {
        code: `EF${stamp}`.slice(0, 24),
        companyId: company.id,
        title: `失败成片${stamp}`,
        nameNorm: `fail${stamp}`,
        language: '英语',
        episodes: { create: { no: 1, fileKey: `bad/${stamp}`, fileName: 'bad.mp4', techStatus: 'FAILED', techNote: '损坏' } },
        assets: { create: { companyId: company.id, type: 'LICENSE', name: '授权', fileKey: `lic-bad/${stamp}`, reviewStatus: 'APPROVED' } },
      },
    });
    const ready = await prisma.drama.create({
      data: {
        code: `ER${stamp}`.slice(0, 24),
        companyId: company.id,
        title: `可发行${stamp}`,
        nameNorm: `ready${stamp}`,
        language: '英语',
        episodes: { create: { no: 1, fileKey: `ok/${stamp}`, fileName: 'ok.mp4', techStatus: 'NONE' } },
        assets: { create: { companyId: company.id, type: 'LICENSE', name: '授权', fileKey: `lic-ok/${stamp}`, reviewStatus: 'APPROVED' } },
      },
    });
    const reviewPlan = await prisma.distributionPlan.create({
      data: { code: `RV${stamp}`.slice(0, 24), dramaId: ready.id, companyId: company.id, round: 'FIRST', status: 'IN_REVIEW', assigneeId: ops.id },
    });
    const sharePlan = await prisma.distributionPlan.create({
      data: { code: `SH${stamp}`.slice(0, 24), dramaId: failed.id, companyId: company.id, round: 'SECOND', status: 'SHARE_CONFIG', assigneeId: ops.id },
    });
    companyId = company.id;
    certCompanyId = certCompany.id;
    failedDramaId = failed.id;
    readyDramaId = ready.id;
    reviewPlanId = reviewPlan.id;
    sharePlanId = sharePlan.id;
    clientToken = await login(`ea-client-${stamp}@example.com`);
    opsToken = await login(`ea-ops-${stamp}@example.com`);
    adminToken = await login(`ea-admin-${stamp}@example.com`);
    certToken = await login(`ea-cert-${stamp}@example.com`);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('B5-01 元数据模板和结算模板返回 xlsx', async () => {
    const meta = await xlsx(authed(clientToken).get('/api/dramas/metadata-template'));
    expect(meta.status).toBeLessThan(300);
    expect(meta.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(meta.headers['content-disposition']).toContain('attachment');
    expect(meta.headers['content-disposition']).toContain('metadata-template.xlsx');
    const metaBytes = meta.body as Buffer;
    expect(metaBytes.subarray(0, 2).toString()).toBe('PK');
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(metaBytes as unknown as ExcelJS.Buffer);
    expect(book.worksheets.map((sheet) => sheet.name)).toEqual(['剧目', '分集文件', '说明']);
    const settlement = await xlsx(authed(opsToken).get('/api/settlements/amount-template'));
    expect(settlement.status).toBeLessThan(300);
    expect(settlement.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(settlement.headers['content-disposition']).toContain('attachment');
    expect(settlement.headers['content-disposition']).toContain('settlement-amounts.xlsx');
    const settlementBytes = settlement.body as Buffer;
    expect(settlementBytes.subarray(0, 2).toString()).toBe('PK');
    const settlementBook = new ExcelJS.Workbook();
    await settlementBook.xlsx.load(settlementBytes as unknown as ExcelJS.Buffer);
    expect(settlementBook.worksheets.map((sheet) => sheet.name)).toContain('结算单');
  });

  it('VL-06 校验失败拦发行，未校验的历史成片仍可申请', async () => {
    const blocked = await authed(clientToken).post('/api/plans').send({ dramaId: failedDramaId, round: 'FIRST' });
    expect(blocked.status).toBeLessThan(300);
    expect(blocked.body.status).toBe('PRECHECK_FAILED');
    expect(blocked.body.precheckNote).toContain('技术校验失败');
    expect(await prisma.distributionPlan.count({ where: { dramaId: failedDramaId, round: 'FIRST' } })).toBe(0);

    const checking = await prisma.drama.create({
      data: {
        code: `EC${stamp}`.slice(0, 24),
        companyId,
        title: `校验中${stamp}`,
        nameNorm: `checking${stamp}`,
        language: '英语',
        episodes: { create: { no: 1, fileKey: `chk/${stamp}`, techStatus: 'CHECKING' } },
        assets: { create: { companyId, type: 'LICENSE', name: '授权', fileKey: `lic-chk/${stamp}`, reviewStatus: 'APPROVED' } },
      },
    });
    const pending = await authed(clientToken).post('/api/plans').send({ dramaId: checking.id, round: 'FIRST' });
    expect(pending.body.status).toBe('PRECHECK_FAILED');
    expect(pending.body.precheckNote).toContain('技术校验中');
    expect(await prisma.distributionPlan.count({ where: { dramaId: checking.id } })).toBe(0);

    const platform = await prisma.platform.findFirst({ where: { name: `校验平台${stamp}` } });
    const created = await authed(clientToken).post('/api/plans').send({ dramaId: readyDramaId, round: 'SECOND', platformIds: [platform!.id] });
    expect(created.status).toBeLessThan(300);
    expect(created.body.id).toBeTruthy();
    expect(created.body.status).not.toBe('PRECHECK_FAILED');
  });

  it('VL-02 预览不落库，确认后才写入', async () => {
    const title = `导入预览${stamp}`;
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('元数据');
    sheet.addRow(['剧名', '语言', '集数']);
    sheet.addRow([title, '英语', 3]);
    sheet.addRow(['', '英语', 1]);
    const file = Buffer.from(await book.xlsx.writeBuffer());
    const preview = await authed(clientToken).post('/api/library/metadata-import').attach('file', file, 'meta.xlsx');
    expect(preview.status).toBeLessThan(300);
    expect(preview.body.preview).toBe(true);
    expect(preview.body.applied).toBe(0);
    expect(preview.body.ready).toBe(1);
    expect(preview.body.failed).toBe(1);
    expect(await prisma.drama.findFirst({ where: { title } })).toBeNull();
    const confirmed = await authed(clientToken).post('/api/library/metadata-import/confirm').attach('file', file, 'meta.xlsx');
    expect(confirmed.status).toBeLessThan(300);
    expect(confirmed.body.applied).toBe(1);
    const drama = await prisma.drama.findFirst({ where: { title } });
    expect(drama?.language).toBe('英语');
    expect(drama?.episodeCountExpected).toBe(3);
  });

  it('VL-10 按筛选全选，数量变化时拒绝执行', async () => {
    const preview = await authed(clientToken).post('/api/library/selection/preview').send({ filter: { q: `可发行${stamp}` }, action: 'TAG' });
    expect(preview.status).toBeLessThan(300);
    expect(preview.body.total).toBe(1);
    expect(preview.body.ids).toEqual([readyDramaId]);
    const stale = await authed(clientToken).post('/api/library/selection/execute').send({ filter: { q: `可发行${stamp}` }, action: 'TAG', expectedCount: 2, params: { add: ['热门'] } });
    expect(stale.status).toBe(409);
    const tagged = await authed(clientToken).post('/api/library/selection/execute').send({ filter: { q: `可发行${stamp}` }, action: 'TAG', expectedCount: 1, params: { add: ['热门'] } });
    expect(tagged.status).toBeLessThan(300);
    const drama = await prisma.drama.findUnique({ where: { id: readyDramaId } });
    expect(drama?.tags).toContain('热门');
  });

  it('EA-01 分步草稿可恢复，提交后进入审核', async () => {
    const step1 = await authed(certToken).put('/api/company/certification/draft/1').send({
      licenseKey: `${certCompanyId}/license/a.png`,
      name: `草稿企业${stamp}`,
      creditCode: '91310000MA1FL4XX1A',
    });
    expect(step1.status).toBeLessThan(300);
    expect(step1.body.currentStep).toBe(1);
    const step2 = await authed(certToken).put('/api/company/certification/draft/2').send({ legalPerson: '林可', contactName: '周宁', contactPhone: '13800000000' });
    expect(step2.status).toBeLessThan(300);
    const saved = await authed(certToken).get('/api/company/certification/draft');
    expect(saved.body.steps.step1.name).toBe(`草稿企业${stamp}`);
    expect(saved.body.steps.step2.contactName).toBe('周宁');
    const skipped = await authed(certToken).put('/api/company/certification/draft/3').send({ skip: true });
    expect(skipped.status).toBeLessThan(300);
    const submitted = await authed(certToken).post('/api/company/certification/draft/submit').send({});
    expect(submitted.status).toBeLessThan(300);
    expect(submitted.body.certStatus).toBe('PENDING');
    expect(submitted.body.bankLater).toBe(true);
    expect(submitted.body.tip).toContain('1 个工作日');
    const company = await prisma.company.findUnique({ where: { id: certCompanyId } });
    expect(company?.certStatus).toBe('PENDING');
    expect(company?.certWizard).toBeNull();
  });

  it('批量驳回使用原因字典，每部剧一张工单，并跳过不能驳回的申请', async () => {
    const reasons = await authed(opsToken).get('/api/reject-reasons');
    expect(reasons.status).toBeLessThan(300);
    expect(reasons.body.map((row: { code: string }) => row.code)).toEqual(expect.arrayContaining(['QUALITY', 'OTHER']));
    const missing = await authed(opsToken).post('/api/reviews/batch-reject').send({ items: [{ planId: reviewPlanId }], reasonCode: 'OTHER' });
    expect(missing.status).toBe(400);
    const admin = await authed(adminToken).post('/api/reviews/batch-reject').send({ items: [{ planId: reviewPlanId }], reasonCode: 'QUALITY' });
    expect(admin.status).toBe(403);
    const rejected = await authed(opsToken).post('/api/reviews/batch-reject').send({
      items: [{ planId: reviewPlanId, episodeNos: [1] }, { planId: sharePlanId }],
      reasonCode: 'QUALITY',
      note: '请换 720P',
    });
    expect(rejected.status).toBeLessThan(300);
    expect(rejected.body.rejectedCount).toBe(1);
    expect(rejected.body.skippedCount).toBe(1);
    const plan = await prisma.distributionPlan.findUnique({ where: { id: reviewPlanId } });
    expect(plan?.status).toBe('NEEDS_REVISION');
    expect(plan?.rejectSummary).toContain('画质不达标');
    expect(await prisma.ticket.count({ where: { planId: reviewPlanId } })).toBe(1);
    expect(await prisma.ticket.count({ where: { planId: sharePlanId } })).toBe(0);
    const client = await prisma.user.findFirst({ where: { companyId, role: 'CLIENT' } });
    const notes = await prisma.notification.count({ where: { userId: client!.id, type: 'REVIEW_REJECT_BATCH' } });
    expect(notes).toBe(1);
  });
});
