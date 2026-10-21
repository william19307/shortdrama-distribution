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

async function login(email: string) {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASS });
  expect(res.status).toBeLessThan(300);
  return res.body.accessToken as string;
}

describe('批量审核、分成、申请、上架和全选', () => {
  const stamp = `${Date.now()}`;
  const passwordHash = hashSync(PASS, 4);
  let opsToken = '';
  let clientToken = '';
  let bdToken = '';
  let opsId = '';
  let companyId = '';
  let platformId = '';
  let platformName = '';

  beforeAll(async () => {
    app = await buildApp();
    await app.init();
    const ops = await prisma.user.create({ data: { email: `batch-ops-${stamp}@example.com`, name: '批量专员', role: 'OPS', passwordHash } });
    const bd = await prisma.user.create({ data: { email: `batch-bd-${stamp}@example.com`, name: '批量商务', role: 'BD', passwordHash } });
    const company = await prisma.company.create({ data: { name: `批量客户${stamp}`, ownerId: ops.id, bdId: bd.id, certStatus: 'APPROVED' } });
    await prisma.user.create({ data: { email: `batch-client-${stamp}@example.com`, name: '批量客户', role: 'CLIENT', passwordHash, companyId: company.id } });
    const platform = await prisma.platform.create({ data: { code: `BP${stamp}`.slice(0, 12), name: `批量平台${stamp}`, firstBatch: true, enabled: true } });
    opsId = ops.id;
    companyId = company.id;
    platformId = platform.id;
    platformName = platform.name;
    opsToken = await login(`batch-ops-${stamp}@example.com`);
    clientToken = await login(`batch-client-${stamp}@example.com`);
    bdToken = await login(`batch-bd-${stamp}@example.com`);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function dramaWith(title: string, episodes: { no: number; reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED' }[]) {
    return prisma.drama.create({
      data: {
        code: `BV${title}`.replace(/\s/g, '').slice(0, 24),
        companyId,
        title,
        nameNorm: title.toLowerCase(),
        language: '英语',
        episodes: { create: episodes.map((episode) => ({ ...episode, fileKey: `${title}-${episode.no}` })) },
      },
    });
  }

  it('RV-09 批量通过只放过抽检完成且没问题的剧', async () => {
    const plans = [];
    for (const [title, status] of [
      ['通过甲', 'APPROVED'],
      ['通过乙', 'APPROVED'],
      ['通过丙', 'APPROVED'],
      ['未完成', 'PENDING'],
      ['有问题', 'REJECTED'],
    ] as const) {
      const drama = await dramaWith(`${title}${stamp}`, [{ no: 1, reviewStatus: status }]);
      plans.push(await prisma.distributionPlan.create({
        data: { code: `BR${title}${stamp}`.slice(0, 24), dramaId: drama.id, companyId, round: 'FIRST', status: 'IN_REVIEW', assigneeId: opsId },
      }));
    }
    const res = await authed(opsToken).post('/api/reviews/batch-pass').send({ planIds: plans.map((plan) => plan.id) });
    expect(res.status).toBeLessThan(300);
    expect(res.body.passedCount).toBe(3);
    expect(res.body.skipped).toHaveLength(2);
    expect(res.body.skipped.map((item: { reason: string }) => item.reason).sort()).toEqual(['抽检未完成', '有问题集，已跳过']);
    const passed = await prisma.distributionPlan.count({ where: { id: { in: plans.slice(0, 3).map((plan) => plan.id) }, status: 'SHARE_CONFIG' } });
    expect(passed).toBe(3);
  });

  it('RS-03 分成模板预览分新配置、覆盖和跳过，提交后进入待复核', async () => {
    const template = await authed(opsToken).post('/api/share-templates').send({ name: `标准${stamp}`, mode: 'NO_MG', clientRate: '40' });
    expect(template.status).toBeLessThan(300);
    const ids: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      const drama = await prisma.drama.create({ data: { code: `BS${stamp}${i}`, companyId, title: `分成${i}`, nameNorm: `share${stamp}${i}`, language: '英语' } });
      const plan = await prisma.distributionPlan.create({ data: { code: `SP${stamp}${i}`, dramaId: drama.id, companyId, round: 'FIRST', status: 'SHARE_CONFIG', assigneeId: opsId } });
      await prisma.planPlatform.create({ data: { planId: plan.id, platformId, platformName } });
      if (i < 2) {
        await prisma.shareConfig.create({ data: { planId: plan.id, platformId, mode: 'NO_MG', clientRate: '10', reviewStatus: 'DRAFT' } });
      }
      ids.push(plan.id);
    }
    const skippedDrama = await prisma.drama.create({ data: { code: `SK${stamp}`, companyId, title: '跳过', nameNorm: `skip${stamp}`, language: '英语' } });
    const skipped = await prisma.distributionPlan.create({ data: { code: `SKP${stamp}`, dramaId: skippedDrama.id, companyId, round: 'FIRST', status: 'PENDING_REVIEW', assigneeId: opsId } });
    const preview = await authed(opsToken).post(`/api/share-templates/${template.body.id}/preview`).send({ planIds: [...ids, skipped.id] });
    expect(preview.status).toBeLessThan(300);
    expect(preview.body.summary).toMatchObject({ created: 8, overwrite: 2, skip: 1 });
    const applied = await authed(opsToken).post(`/api/share-templates/${template.body.id}/apply`).send({ planIds: [...ids, skipped.id] });
    expect(applied.body.appliedCount).toBe(10);
    const reviewing = await prisma.distributionPlan.count({ where: { id: { in: ids }, status: 'SHARE_REVIEW' } });
    expect(reviewing).toBe(10);
    const still = await prisma.distributionPlan.findUnique({ where: { id: skipped.id } });
    expect(still?.status).toBe('PENDING_REVIEW');
  });

  it('RP-03 超过 200 部被拒绝，问题剧不挡住其余剧', async () => {
    const tooMany = await authed(clientToken).post('/api/plans/batch').send({ dramaIds: Array.from({ length: 201 }, (_, i) => `missing-${i}`), round: 'FIRST' });
    expect(tooMany.status).toBe(400);
    expect(JSON.stringify(tooMany.body)).toContain('200');

    await prisma.drama.createMany({
      data: Array.from({ length: 200 }, (_, i) => ({ code: `BM${stamp}${i}`, companyId, title: `空剧${i}`, nameNorm: `empty${stamp}${i}`, language: '英语' })),
    });
    const empty = await prisma.drama.findMany({ where: { code: { startsWith: `BM${stamp}` } }, select: { id: true } });
    const accepted = await authed(clientToken).post('/api/plans/batch').send({ dramaIds: empty.map((row) => row.id), round: 'FIRST' });
    expect(accepted.status).toBeLessThan(300);
    expect(accepted.body.submittedCount).toBe(0);
    expect(accepted.body.needsActionCount).toBe(200);

    const good = await prisma.drama.create({
      data: {
        code: `BG${stamp}`,
        companyId,
        title: '可提交',
        nameNorm: `good${stamp}`,
        language: '英语',
        episodes: { create: { no: 1, fileKey: 'good-1', fileName: '1.mp4' } },
        assets: { create: { companyId, type: 'LICENSE', name: '授权', fileKey: 'lic-good', reviewStatus: 'APPROVED' } },
      },
    });
    const missingLicense = await prisma.drama.create({
      data: { code: `BL${stamp}`, companyId, title: '缺授权', nameNorm: `lic${stamp}`, language: '英语', episodes: { create: { no: 1, fileKey: 'lic-1' } } },
    });
    const blockingDrama = await prisma.drama.create({
      data: {
        code: `BB${stamp}`,
        companyId,
        title: '在审',
        nameNorm: `block${stamp}`,
        language: '英语',
        episodes: { create: { no: 1, fileKey: 'block-1' } },
        assets: { create: { companyId, type: 'LICENSE', name: '授权', fileKey: 'lic-block', reviewStatus: 'APPROVED' } },
      },
    });
    await prisma.distributionPlan.create({ data: { code: `BLK${stamp}`, dramaId: blockingDrama.id, companyId, round: 'FIRST', status: 'PENDING_REVIEW' } });
    const mixed = await authed(clientToken).post('/api/plans/batch').send({ dramaIds: [good.id, missingLicense.id, blockingDrama.id], round: 'FIRST' });
    expect(mixed.status).toBeLessThan(300);
    expect(mixed.body.submittedCount).toBe(1);
    expect(mixed.body.needsActionCount).toBe(2);
    expect(mixed.body.needsAction.every((item: { href: string; reason: string }) => item.href.startsWith('/dramas/') && item.reason)).toBe(true);
    const failed = await prisma.distributionPlan.count({ where: { dramaId: { in: [missingLicense.id, blockingDrama.id] }, status: 'PRECHECK_FAILED' } });
    expect(failed).toBe(0);
  }, 120000);

  it('RP-09 上架结果按行导入，错误行不影响已上架', async () => {
    const drama = await prisma.drama.create({ data: { code: `BLIST${stamp}`, companyId, title: '待上架', nameNorm: `list${stamp}`, language: '英语' } });
    const plan = await prisma.distributionPlan.create({ data: { code: `BPL${stamp}`, dramaId: drama.id, companyId, round: 'FIRST', status: 'APPROVED', assigneeId: opsId } });
    await prisma.planPlatform.create({ data: { planId: plan.id, platformId, platformName, listingStatus: 'PENDING_CONTACT' } });
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('上架结果');
    sheet.addRow(['剧ID', '平台', '平台剧ID', '上架时间', '链接']);
    sheet.addRow([drama.code, platformName, 'PID-1', '2026-10-21', 'https://example.com/live']);
    sheet.addRow([drama.code, '没有这个平台', 'PID-2', '2026-10-21', 'https://example.com/bad']);
    const file = Buffer.from(await book.xlsx.writeBuffer());
    const imported = await authed(bdToken).post('/api/listings/import').attach('file', file, 'listings.xlsx');
    expect(imported.status).toBeLessThan(300);
    expect(imported.body.applied).toBe(1);
    expect(imported.body.failed).toBe(1);
    expect(imported.body.rows.find((row: { ok: boolean }) => !row.ok).error).toContain('平台不存在');
    const seen = await authed(clientToken).get(`/api/plans/${plan.id}`);
    expect(seen.body.status).toBe('LIVE');
    expect(seen.body.platforms[0].listingStatus).toBe('LISTED');
    expect(seen.body.platforms[0].platformName).toBe(platformName);
  });

  it('VL-10 选中全部筛选结果并按选中行导出', async () => {
    await prisma.drama.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({ code: `BW${stamp}${i}`, companyId, title: `墙${stamp}${i}`, nameNorm: `wall${stamp}${i}`, language: '英语' })),
    });
    const page = await authed(clientToken).get('/api/dramas?page=1&pageSize=24');
    expect(page.body.pageSize).toBe(24);
    expect(page.body.total).toBeGreaterThan(24);
    const all = await authed(clientToken).post('/api/dramas/selection').send({ q: `墙${stamp}` });
    expect(all.status).toBeLessThan(300);
    expect(all.body.total).toBe(25);
    expect(all.body.ids).toHaveLength(25);
    const two = all.body.ids.slice(0, 2);
    const small = await authed(clientToken).post('/api/dramas/export').send({ ids: two, q: `墙${stamp}` });
    expect(small.text.replace(/^\uFEFF/, '').trim().split('\n')).toHaveLength(3);
    const full = await authed(clientToken).post('/api/dramas/export').send({ ids: all.body.ids, q: `墙${stamp}` });
    expect(full.text.replace(/^\uFEFF/, '').trim().split('\n')).toHaveLength(26);
    const tagged = await authed(clientToken).post('/api/dramas/batch').send({ ids: two, tag: '出海' });
    expect(tagged.body.updated).toBe(2);
    const drama = await prisma.drama.findUnique({ where: { id: two[0] } });
    expect(drama?.tags).toContain('出海');
  });
});
