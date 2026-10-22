import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
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
  };
}

async function login(email: string) {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASS });
  expect(res.status).toBeLessThan(300);
  return res.body.accessToken as string;
}

async function upload(token: string, filename: string, body: Buffer, purpose: string, extra: Record<string, unknown> = {}) {
  const http = authed(token);
  const init = await http.post('/api/storage/uploads').send({ filename, contentType: 'video/mp4', size: body.length, purpose, ...extra });
  expect(init.status).toBeLessThan(300);
  const put = await http.put(init.body.url).set('Content-Type', 'application/octet-stream').send(body);
  expect(put.status).toBeLessThan(300);
  const done = await http.post(`/api/storage/uploads/${init.body.id}/complete`).send({});
  expect(done.status).toBeLessThan(300);
  return done.body as { techStatus?: string };
}

async function untilStatus(dramaId: string, status: string) {
  for (let i = 0; i < 40; i += 1) {
    const row = await prisma.episode.findFirst({ where: { dramaId, no: 1 } });
    if (row?.techStatus === status) return row;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const row = await prisma.episode.findFirst({ where: { dramaId, no: 1 } });
  throw new Error(`技术校验停在 ${row?.techStatus}：${row?.techNote}`);
}

describe('文件夹上传、元数据和技术校验', () => {
  const stamp = `${Date.now()}`;
  let token = '';
  let goodMp4 = Buffer.alloc(0);

  beforeAll(async () => {
    execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=black:s=1280x720:d=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-t', '2', '/tmp/upload-ok.mp4'], { stdio: 'ignore' });
    goodMp4 = readFileSync('/tmp/upload-ok.mp4');
    app = await buildApp();
    await app.init();
    const passwordHash = hashSync(PASS, 4);
    const company = await prisma.company.create({ data: { name: `上传客户${stamp}`, certStatus: 'APPROVED' } });
    await prisma.user.create({ data: { email: `upload-${stamp}@example.com`, name: '上传客户', role: 'CLIENT', passwordHash, companyId: company.id } });
    token = await login(`upload-${stamp}@example.com`);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('VL-01 识别剧目录、集号和封面海报预告字幕', async () => {
    const paths = [
      '剧A/第001集.mp4',
      '剧A/第002集.mp4',
      '剧B/EP01.mp4',
      '剧C/01.mp4',
      '剧A/cover.jpg',
      '剧B/poster.jpg',
      '剧C/trailer.mp4',
      '剧A/zh.srt',
    ];
    const preview = await authed(token).post('/api/library/folder-preview').send({ paths });
    expect(preview.status).toBeLessThan(300);
    const byTitle = Object.fromEntries(preview.body.dramas.map((drama: { title: string }) => [drama.title, drama]));
    expect(byTitle['剧A'].episodes.map((item: { no: number }) => item.no)).toEqual([1, 2]);
    expect(byTitle['剧B'].episodes[0].no).toBe(1);
    expect(byTitle['剧C'].episodes[0].no).toBe(1);
    expect(byTitle['剧A'].cover).toContain('cover.jpg');
    expect(byTitle['剧B'].poster).toContain('poster.jpg');
    expect(byTitle['剧C'].trailer).toContain('trailer.mp4');
    expect(byTitle['剧A'].subtitles[0]).toContain('.srt');
    const applied = await authed(token).post('/api/library/folder-apply').send({ paths });
    expect(applied.status).toBeLessThan(300);
    expect(applied.body.dramas).toHaveLength(3);
  });

  it('VL-02 缺必填列报错，其余行按文件名或剧名集号匹配', async () => {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('元数据');
    sheet.addRow(['剧名', '语言', '集数', '文件名', '集号']);
    sheet.addRow(['剧A', '', 2, '', '']);
    sheet.addRow(['剧B', '英语', 1, 'EP01.mp4', '']);
    sheet.addRow(['剧C', '日语', 1, '', 1]);
    const file = Buffer.from(await book.xlsx.writeBuffer());
    const imported = await authed(token).post('/api/dramas/metadata-import').attach('file', file, 'meta.xlsx');
    expect(imported.status).toBeLessThan(300);
    expect(imported.body.failed).toBe(1);
    expect(imported.body.applied).toBe(2);
    expect(imported.body.rows.find((row: { ok: boolean }) => !row.ok).error).toContain('第 2 行');
    expect(imported.body.rows.find((row: { ok: boolean }) => !row.ok).error).toContain('语言');
    const drama = await prisma.drama.findFirst({ where: { title: '剧C' } });
    expect(drama?.language).toBe('日语');
    expect(drama?.episodeCountExpected).toBe(1);
  });

  it('VL-06 损坏文件校验失败，替换后重新校验为可发行', async () => {
    const created = await authed(token).post('/api/dramas').send({ title: `校验${stamp}`, language: '英语' });
    expect(created.status).toBeLessThan(300);
    const dramaId = created.body.id as string;
    const broken = await upload(token, 'bad.mp4', Buffer.from('not-a-video'), 'EPISODE', { dramaId, episodeNo: 1 });
    expect(broken.techStatus).toBe('CHECKING');
    const failed = await untilStatus(dramaId, 'FAILED');
    expect(failed.techNote).toContain('损坏');
    const listed = await authed(token).get(`/api/dramas?q=${encodeURIComponent(`校验${stamp}`)}`);
    expect(listed.body.items[0].techLabel).toBe('有问题');
    const replaced = await upload(token, 'ok.mp4', goodMp4, 'EPISODE', { dramaId, episodeNo: 1 });
    expect(replaced.techStatus).toBe('CHECKING');
    const ready = await untilStatus(dramaId, 'READY');
    expect(ready.width).toBeGreaterThanOrEqual(720);
    expect(ready.durationSec).toBeGreaterThanOrEqual(1);
    const again = await authed(token).get(`/api/dramas?q=${encodeURIComponent(`校验${stamp}`)}`);
    expect(again.body.items[0].techLabel).toBe('可发行');
  });
});
