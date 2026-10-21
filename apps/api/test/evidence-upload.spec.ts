import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { hashSync } from 'bcryptjs';
import request from 'supertest';
import { deflateRawSync } from 'zlib';
import { buildApp } from '../src/main';
import { S3StorageService } from '../src/core/storage.service';
import { zipStore } from '../src/core/zip';

const PASS = 'Demo123456';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
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

function binaryParser(res: request.Response, callback: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

async function login(email: string) {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASS });
  expect(res.status).toBeLessThan(300);
  return res.body.accessToken as string;
}

describe('浏览器文件地址', () => {
  const previous = {
    endpoint: process.env.S3_ENDPOINT,
    publicUrl: process.env.PUBLIC_OBJECT_URL,
    bucket: process.env.S3_BUCKET,
    key: process.env.S3_ACCESS_KEY,
    secret: process.env.S3_SECRET_KEY,
    path: process.env.S3_FORCE_PATH_STYLE,
  };

  afterAll(() => {
    process.env.S3_ENDPOINT = previous.endpoint;
    process.env.PUBLIC_OBJECT_URL = previous.publicUrl;
    process.env.S3_BUCKET = previous.bucket;
    process.env.S3_ACCESS_KEY = previous.key;
    process.env.S3_SECRET_KEY = previous.secret;
    process.env.S3_FORCE_PATH_STYLE = previous.path;
  });

  it('DM-05 预签名使用 PUBLIC_OBJECT_URL，不返回 minio:9000', async () => {
    process.env.S3_ENDPOINT = 'http://minio:9000';
    process.env.PUBLIC_OBJECT_URL = 'http://localhost:9000';
    process.env.S3_BUCKET = 'shortform';
    process.env.S3_ACCESS_KEY = 'minio';
    process.env.S3_SECRET_KEY = 'minio123456';
    process.env.S3_FORCE_PATH_STYLE = 'true';
    const storage = new S3StorageService();
    const read = await storage.presignGet('co/cover/a.png');
    const put = await storage.presignPut('co/cover/a.png', 'image/png');
    const part = await storage.presignPart('co/ep/a.mp4', 'upload-1', 1);
    for (const url of [read, put.url, part]) {
      expect(url.startsWith('http://localhost:9000/')).toBe(true);
      expect(url.includes('minio:9000')).toBe(false);
    }
  });
});

describe('水印工单号、截图打包和未完成分片', () => {
  const stamp = `${Date.now()}`;
  let ops = '';
  let client = '';
  let dramaId = '';
  let companyId = '';
  let platformId = '';

  beforeAll(async () => {
    app = await buildApp();
    await app.init();
    const passwordHash = hashSync(PASS, 4);
    const operator = await prisma.user.create({ data: { email: `ops-ev-${stamp}@example.com`, name: '水印运营', role: 'OPS', passwordHash } });
    const company = await prisma.company.create({ data: { name: `水印客户${stamp}`, certStatus: 'APPROVED', ownerId: operator.id } });
    companyId = company.id;
    await prisma.user.create({ data: { email: `client-ev-${stamp}@example.com`, name: '水印客户', role: 'CLIENT', passwordHash, companyId: company.id } });
    const platform = await prisma.platform.create({ data: { code: `EV${stamp}`.slice(0, 16), name: `平台${stamp}`, region: '北美', syncLag: 'T1' } });
    platformId = platform.id;
    const drama = await prisma.drama.create({ data: { code: `EVD${stamp}`.slice(0, 16), companyId: company.id, title: `水印剧${stamp}`, nameNorm: `wm${stamp}`, language: '英语' } });
    dramaId = drama.id;
    ops = await login(operator.email);
    client = await login(`client-ev-${stamp}@example.com`);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('DS-11 水印带工单号，DS-12 运营可以打包下载', async () => {
    const http = authed(ops);
    const init = await http.post('/api/storage/uploads').send({ filename: 'shot.png', contentType: 'image/png', size: PNG.length, purpose: 'WATERMARK_SOURCE', dramaId, companyId });
    expect(init.status).toBeLessThan(300);
    expect(String(init.body.url || '')).not.toContain('minio:9000');
    const put = await http.put(init.body.url).set('Content-Type', 'application/octet-stream').send(PNG);
    expect(put.status).toBeLessThan(300);
    const done = await http.post(`/api/storage/uploads/${init.body.id}/complete`).send({});
    expect(done.status).toBeLessThan(300);
    const shot = await http.post('/api/watermarks').send({ fileKey: done.body.key, dramaId, platformId, shotDate: '2026-10-02', kind: 'DATA', filename: 'shot.png' });
    expect(shot.status).toBeLessThan(300);
    expect(shot.body.ticketCode).toMatch(/^GD/);
    expect(String(shot.body.url)).not.toContain('minio:9000');
    const listed = await http.get('/api/watermarks');
    expect(listed.body.some((item: { ticketCode: string }) => item.ticketCode === shot.body.ticketCode)).toBe(true);
    const denied = await authed(client).post('/api/evidence/archive-zip').send({ fileKeys: [shot.body.watermarkedKey] });
    expect(denied.status).toBe(403);
    const zip = await http.post('/api/evidence/archive-zip').send({ fileKeys: [shot.body.watermarkedKey, done.body.key] }).buffer(true).parse(binaryParser);
    expect(zip.status).toBeLessThan(300);
    expect(String(zip.headers['content-type'])).toContain('application/zip');
    expect(zip.body.subarray(0, 2).toString()).toBe('PK');
    expect(zip.body.includes(Buffer.from(shot.body.ticketCode))).toBe(true);
  });

  it('DS-12 上传截图 zip 后逐张校验并自动归档', async () => {
    const http = authed(ops);
    const platform = await prisma.platform.findUnique({ where: { id: platformId } });
    const drama = await prisma.drama.findUnique({ where: { id: dramaId } });
    const matchedName = `${platform?.code}_${drama?.code}_20261003_DATA_1.png`;
    const stored = zipStore([
      { name: matchedName, data: PNG },
      { name: 'note.txt', data: Buffer.from('not an image') },
    ]);
    const denied = await authed(client).post('/api/evidence/upload-zip').attach('file', stored, 'shots.zip');
    expect(denied.status).toBe(403);
    const bad = await http.post('/api/evidence/upload-zip').attach('file', Buffer.from('hello'), 'bad.zip');
    expect(bad.status).toBe(400);
    const uploaded = await http.post('/api/evidence/upload-zip').attach('file', stored, 'shots.zip');
    expect(uploaded.status).toBeLessThan(300);
    expect(uploaded.body.succeeded).toBe(1);
    expect(uploaded.body.archived).toBe(1);
    expect(uploaded.body.failed).toBe(1);
    expect(uploaded.body.items[0].ok).toBe(true);
    expect(uploaded.body.items[0].status).toBe('ARCHIVED');
    expect(uploaded.body.items[0].ticketCode).toMatch(/^GD/);
    expect(uploaded.body.items[1].ok).toBe(false);
    expect(String(uploaded.body.items[1].error)).toMatch(/png|jpg/);
    const listed = await http.get('/api/watermarks');
    expect(listed.body.some((item: { ticketCode: string }) => item.ticketCode === uploaded.body.items[0].ticketCode)).toBe(true);
    const deflated = zipDeflate(`${platform?.code}_${drama?.code}_20261004_DATA_2.png`, PNG);
    const second = await http.post('/api/evidence/upload-zip').attach('file', deflated, 'deflate.zip');
    expect(second.status).toBeLessThan(300);
    expect(second.body.archived).toBe(1);
    expect(second.body.items[0].ticketCode).toMatch(/^GD/);
  });

  it('VL-04 未完成的大文件出现在上传队列，同一部只计一次', async () => {
    const http = authed(client);
    const size = 500 * 1024 * 1024;
    const first = await http.post('/api/storage/uploads').send({ filename: '第001集.mp4', contentType: 'video/mp4', size, purpose: 'EPISODE', dramaId, episodeNo: 1, multipart: true });
    const second = await http.post('/api/storage/uploads').send({ filename: '第002集.mp4', contentType: 'video/mp4', size, purpose: 'EPISODE', dramaId, episodeNo: 2, multipart: true });
    expect(first.status).toBeLessThan(300);
    expect(second.status).toBeLessThan(300);
    const list = await http.get('/api/storage/uploads');
    expect(list.status).toBeLessThan(300);
    expect(list.body.label).toBe('有 1 部未完成');
    expect(list.body.pendingDramas).toBe(1);
    expect(list.body.items.map((item: { fileName: string }) => item.fileName).sort()).toEqual(['第001集.mp4', '第002集.mp4']);
  });
});

function zipCrc(buf: Buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (~crc) >>> 0;
}

function zipDeflate(name: string, data: Buffer) {
  const compressed = deflateRawSync(data);
  const nameBuf = Buffer.from(name, 'utf8');
  const crc = zipCrc(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(46 + nameBuf.length, 12);
  end.writeUInt32LE(30 + nameBuf.length + compressed.length, 16);
  return Buffer.concat([local, nameBuf, compressed, central, nameBuf, end]);
}
