import { execFile } from 'child_process';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PlanStatus, Prisma, UploadSession } from '@prisma/client';
import ExcelJS from 'exceljs';
import {
  PART_SIZE,
  SINGLE_PUT_MAX,
  clientPhaseFromPlans,
  dramaBatchSchema,
  dramaCreateSchema,
  dramaListSchema,
  dramaPatchSchema,
  dramaSelectionSchema,
  folderPreviewSchema,
  normalizeName,
  recognizeFolder,
  uploadInitSchema,
  type DramaListQuery,
} from '@shortform/shared';
import { z } from 'zod';
import { assertCompanyAccess, assertFound, safeFilename } from '../core/access';
import { AuditService } from '../core/audit.service';
import { assertBusinessWrite, assertRole, AuthUser, nextCode } from '../core/auth';
import { PrismaService } from '../core/prisma.service';
import { StorageService } from '../core/storage.service';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, query: DramaListQuery) {
    const where = this.whereFor(user, query);
    const [rows, total] = await Promise.all([
      this.prisma.drama.findMany({
        where,
        orderBy: { [query.sort]: query.order },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          plans: { select: { id: true, status: true, round: true, code: true } },
          company: { select: { id: true, name: true } },
          episodes: { select: { techStatus: true, fileKey: true } },
          _count: { select: { episodes: true } },
        },
      }),
      this.prisma.drama.count({ where }),
    ]);
    const items = await Promise.all(rows.map((row) => this.card(row)));
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async selection(user: AuthUser, input: z.infer<typeof dramaSelectionSchema>) {
    const where = this.whereFor(user, this.asListQuery(input));
    const total = await this.prisma.drama.count({ where });
    if (total > 5000) throw new BadRequestException('超过 5000 部，请缩小筛选后再全选');
    const rows = await this.prisma.drama.findMany({ where, select: { id: true }, orderBy: { updatedAt: 'desc' } });
    return { ids: rows.map((row) => row.id), total };
  }

  filterWhere(user: AuthUser, query: Partial<DramaListQuery>) {
    return this.whereFor(user, { page: 1, pageSize: 20, sort: 'updatedAt', order: 'desc', ...query });
  }

  async batchMeta(user: AuthUser, input: z.infer<typeof dramaBatchSchema>) {
    if (!input.tag && !input.group) throw new BadRequestException('请填写标签或分组');
    const where = this.whereFor(user, this.asListQuery({}));
    where.id = { in: input.ids };
    const dramas = await this.prisma.drama.findMany({ where, select: { id: true, tags: true, groups: true } });
    for (const drama of dramas) {
      await this.prisma.drama.update({
        where: { id: drama.id },
        data: {
          tags: input.tag && !drama.tags.includes(input.tag) ? [...drama.tags, input.tag] : undefined,
          groups: input.group && !drama.groups.includes(input.group) ? [...drama.groups, input.group] : undefined,
        },
      });
    }
    return { updated: dramas.length };
  }

  previewFolder(user: AuthUser, input: z.infer<typeof folderPreviewSchema>) {
    this.clientCompany(user);
    return { dramas: recognizeFolder(input.paths) };
  }

  async applyFolder(user: AuthUser, input: z.infer<typeof folderPreviewSchema>) {
    const companyId = this.clientCompany(user);
    const recognized = recognizeFolder(input.paths);
    if (!recognized.length) throw new BadRequestException('没有识别到剧名目录，请按「剧名/第001集.mp4」组织');
    const dramas = [];
    for (const group of recognized) {
      const nameNorm = normalizeName(group.title);
      const existing = await this.prisma.drama.findFirst({ where: { companyId, nameNorm } });
      const drama = existing ?? await this.prisma.$transaction(async (tx) => tx.drama.create({
        data: { code: await nextCode(tx, 'D'), companyId, title: group.title, nameNorm, language: '英语' },
      }));
      for (const episode of group.episodes) {
        await this.prisma.episode.upsert({
          where: { dramaId_no: { dramaId: drama.id, no: episode.no } },
          create: { dramaId: drama.id, no: episode.no, fileName: episode.fileName },
          update: { fileName: episode.fileName },
        });
      }
      dramas.push({ id: drama.id, title: drama.title, episodes: group.episodes.length, cover: group.cover || null, poster: group.poster || null, trailer: group.trailer || null, subtitles: group.subtitles, conflicts: group.conflicts });
    }
    return { dramas };
  }

  async metadataTemplate() {
    const book = new ExcelJS.Workbook();
    const dramas = book.addWorksheet('剧目');
    dramas.addRow(['剧名', '语言', '集数', '外文名', '题材', '简介', '标签']);
    dramas.addRow(['剧A', '英语', 60, 'Drama A', '都市', '', '热门']);
    dramas.getRow(1).font = { bold: true };
    const files = book.addWorksheet('分集文件');
    files.addRow(['剧名', '集号', '文件名']);
    files.addRow(['剧A', 1, '第001集.mp4']);
    files.getRow(1).font = { bold: true };
    const notes = book.addWorksheet('说明');
    notes.addRow(['说明']);
    notes.addRow(['剧目表必填：剧名、语言、集数。外文名、题材、简介、标签可以不填。']);
    notes.addRow(['分集文件表用来匹配已经上传的成片。同一行填集号或文件名，文件名优先。']);
    notes.addRow(['请先看导入预览。有误的行不会写入。']);
    notes.addRow(['文件夹请按「剧名/第001集.mp4」组织。']);
    notes.getColumn(1).width = 72;
    return Buffer.from(await book.xlsx.writeBuffer());
  }

  previewMetadata(user: AuthUser, file: Buffer) {
    return this.readMetadata(user, file, false);
  }

  async importMetadata(user: AuthUser, file: Buffer) {
    const result = await this.readMetadata(user, file, true);
    return { rows: result.rows, applied: result.applied, failed: result.failed };
  }

  private async readMetadata(user: AuthUser, file: Buffer, apply: boolean) {
    const companyId = this.clientCompany(user);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(file as unknown as ExcelJS.Buffer);
    const sheet = book.getWorksheet('剧目') || book.worksheets.find((item) => item.name !== '说明' && item.name !== '分集文件') || book.worksheets[0];
    if (!sheet) throw new BadRequestException('工作表为空');
    const header = sheet.getRow(1).values as ExcelJS.CellValue[];
    const col = (name: string) => header.findIndex((cell) => cellText(cell) === name);
    const titleCol = col('剧名');
    const langCol = col('语言');
    const countCol = col('集数');
    if (titleCol < 0 || langCol < 0 || countCol < 0) throw new BadRequestException('模板必须包含剧名、语言、集数');
    const rows: { rowNo: number; ok: boolean; error: string; title?: string; action?: string }[] = [];
    for (let rowNo = 2; rowNo <= sheet.rowCount; rowNo += 1) {
      const row = sheet.getRow(rowNo);
      const title = cellText(row.getCell(titleCol).value);
      const language = cellText(row.getCell(langCol).value);
      const countRaw = cellText(row.getCell(countCol).value);
      const fileName = col('文件名') > 0 ? cellText(row.getCell(col('文件名')).value) : '';
      const episodeRaw = col('集号') > 0 ? cellText(row.getCell(col('集号')).value) : '';
      if (!title && !language && !countRaw) continue;
      const missing = [!title ? '剧名' : '', !language ? '语言' : '', !countRaw ? '集数' : ''].filter(Boolean);
      if (missing.length || !/^\d+$/.test(countRaw)) {
        rows.push({ rowNo, ok: false, error: `第 ${rowNo} 行缺少必填列：${missing.length ? missing.join('、') : '集数'}` });
        continue;
      }
      const nameNorm = normalizeName(title);
      const existing = await this.prisma.drama.findFirst({ where: { companyId, nameNorm } });
      const drama = apply
        ? existing ?? await this.prisma.$transaction(async (tx) => tx.drama.create({
          data: { code: await nextCode(tx, 'D'), companyId, title, nameNorm, language, episodeCountExpected: Number(countRaw) },
        }))
        : existing;
      if (apply && drama) {
        await this.prisma.drama.update({
          where: { id: drama.id },
          data: {
            language,
            episodeCountExpected: Number(countRaw),
            titleEn: col('外文名') > 0 ? cellText(row.getCell(col('外文名')).value) || undefined : undefined,
            genre: col('题材') > 0 ? cellText(row.getCell(col('题材')).value) || undefined : undefined,
            synopsis: col('简介') > 0 ? cellText(row.getCell(col('简介')).value) || undefined : undefined,
          },
        });
      }
      if (fileName) {
        const episode = drama ? await this.prisma.episode.findFirst({ where: { fileName, drama: { companyId, id: drama.id } } }) : null;
        if (!episode) {
          rows.push({ rowNo, ok: false, error: `第 ${rowNo} 行未按文件名匹配到文件`, title });
          continue;
        }
      } else if (episodeRaw) {
        if (!/^\d+$/.test(episodeRaw)) {
          rows.push({ rowNo, ok: false, error: `第 ${rowNo} 行集号不正确`, title });
          continue;
        }
        const episode = drama ? await this.prisma.episode.findFirst({ where: { no: Number(episodeRaw), dramaId: drama.id } }) : null;
        if (!episode) {
          rows.push({ rowNo, ok: false, error: `第 ${rowNo} 行未按剧名和集号匹配到文件`, title });
          continue;
        }
      }
      rows.push({ rowNo, ok: true, error: '', title, action: existing ? '更新' : '新建' });
    }
    const episodeSheet = book.getWorksheet('分集文件');
    if (episodeSheet) {
      const episodeHeader = episodeSheet.getRow(1).values as ExcelJS.CellValue[];
      const episodeCol = (name: string) => episodeHeader.findIndex((cell) => cellText(cell) === name);
      const episodeTitleCol = episodeCol('剧名');
      const episodeFileCol = episodeCol('文件名');
      const episodeNoCol = episodeCol('集号');
      if (episodeTitleCol < 0 || (episodeFileCol < 0 && episodeNoCol < 0)) throw new BadRequestException('分集文件表需要剧名，以及文件名或集号');
      for (let rowNo = 2; rowNo <= episodeSheet.rowCount; rowNo += 1) {
        const row = episodeSheet.getRow(rowNo);
        const title = cellText(row.getCell(episodeTitleCol).value);
        const fileName = episodeFileCol > 0 ? cellText(row.getCell(episodeFileCol).value) : '';
        const episodeRaw = episodeNoCol > 0 ? cellText(row.getCell(episodeNoCol).value) : '';
        if (!title && !fileName && !episodeRaw) continue;
        const nameNorm = normalizeName(title);
        const drama = nameNorm ? await this.prisma.drama.findFirst({ where: { companyId, nameNorm } }) : null;
        if (fileName) {
          const episode = drama ? await this.prisma.episode.findFirst({ where: { fileName, dramaId: drama.id } }) : null;
          if (!episode) {
            rows.push({ rowNo, ok: false, error: `分集文件第 ${rowNo} 行未按文件名匹配到文件`, title });
            continue;
          }
        } else if (episodeRaw) {
          if (!/^\d+$/.test(episodeRaw) || !drama) {
            rows.push({ rowNo, ok: false, error: `分集文件第 ${rowNo} 行未按剧名和集号匹配到文件`, title });
            continue;
          }
          const episode = await this.prisma.episode.findFirst({ where: { no: Number(episodeRaw), dramaId: drama.id } });
          if (!episode) {
            rows.push({ rowNo, ok: false, error: `分集文件第 ${rowNo} 行未按剧名和集号匹配到文件`, title });
            continue;
          }
        } else {
          rows.push({ rowNo, ok: false, error: `分集文件第 ${rowNo} 行缺少文件名或集号`, title });
          continue;
        }
        rows.push({ rowNo, ok: true, error: '', title, action: '匹配分集' });
      }
    }
    if (!rows.length) throw new BadRequestException('没有读到剧目');
    const ready = rows.filter((row) => row.ok).length;
    return { preview: !apply, rows, applied: apply ? ready : 0, ready, failed: rows.filter((row) => !row.ok).length };
  }

  async exportCsv(user: AuthUser, query: DramaListQuery & { ids?: string[] }) {
    const where = this.whereFor(user, query);
    if (query.ids?.length) where.id = { in: query.ids };
    const total = await this.prisma.drama.count({ where });
    if (total > 5000) throw new BadRequestException('超过 5000 行，请缩小筛选后再导出');
    const rows = await this.prisma.drama.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 5000,
      include: { plans: { select: { status: true } } },
    });
    const header = ['剧目编号', '剧名', '外文名', '题材', '语言', '状态', '更新时间'];
    const lines = rows.map((row) => {
      const phase = clientPhaseFromPlans(row.plans.map((plan) => plan.status));
      return [row.code, row.title, row.titleEn, row.genre, row.language, phase, row.updatedAt.toISOString()];
    });
    const csv = [header, ...lines].map((cols) => cols.map(csvCell).join(',')).join('\n');
    await this.prisma.asyncTask.create({
      data: {
        type: 'EXPORT',
        name: '导出剧目列表',
        ownerId: user.id,
        status: 'SUCCESS',
        total: rows.length,
        succeeded: rows.length,
        finishedAt: new Date(),
      },
    });
    return csv;
  }

  async create(user: AuthUser, input: z.infer<typeof dramaCreateSchema>) {
    const companyId = this.clientCompany(user);
    const drama = await this.prisma.$transaction(async (tx) => {
      const code = await nextCode(tx, 'D');
      return tx.drama.create({
        data: {
          code,
          companyId,
          title: input.title,
          titleEn: input.titleEn ?? '',
          nameNorm: normalizeName(input.title),
          synopsis: input.synopsis ?? '',
          genre: input.genre ?? '',
          language: input.language,
          episodeCountExpected: input.episodeCountExpected,
          tags: input.tags ?? [],
          groups: input.groups ?? [],
        },
      });
    });
    await this.audit.write(user.id, 'drama.create', 'Drama', drama.id);
    return this.detail(user, drama.id);
  }

  async detail(user: AuthUser, id: string) {
    const drama = await this.load(user, id);
    const coverUrl = drama.coverKey ? await this.storage.presignGet(drama.coverKey).catch(() => null) : null;
    return {
      ...drama,
      coverUrl,
      phase: clientPhaseFromPlans(drama.plans.map((plan) => plan.status)),
      episodes: drama.episodes.map((episode) => ({
        ...episode,
        fileSize: episode.fileSize?.toString() ?? null,
      })),
    };
  }

  async update(user: AuthUser, id: string, input: z.infer<typeof dramaPatchSchema>) {
    const drama = await this.load(user, id);
    if (user.role !== 'CLIENT') throw new ForbiddenException('只有客户可以修改剧目资料');
    const updated = await this.prisma.drama.update({
      where: { id: drama.id },
      data: {
        title: input.title,
        titleEn: input.titleEn,
        nameNorm: input.title ? normalizeName(input.title) : undefined,
        synopsis: input.synopsis,
        genre: input.genre,
        language: input.language,
        episodeCountExpected: input.episodeCountExpected,
        tags: input.tags,
        groups: input.groups,
      },
    });
    return this.detail(user, updated.id);
  }

  async initUpload(user: AuthUser, input: z.infer<typeof uploadInitSchema>) {
    assertBusinessWrite(user);
    const companyId = await this.companyForUpload(user, input);
    if (input.purpose === 'EPISODE' && (!input.dramaId || !input.episodeNo)) {
      throw new BadRequestException('上传剧集时需要指定剧目和集号');
    }
    await this.prisma.uploadSession.updateMany({
      where: { expiresAt: { lt: new Date() }, status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });
    const fingerprint = input.fingerprint || `${input.filename}:${input.size}`;
    const existing = await this.prisma.uploadSession.findFirst({
      where: { companyId, fingerprint, purpose: input.purpose, status: 'PENDING', expiresAt: { gt: new Date() }, dramaId: input.dramaId ?? null, episodeNo: input.episodeNo ?? null },
    });
    const session =
      existing ??
      (await this.prisma.uploadSession.create({
        data: {
          companyId,
          key: `${companyId}/${input.purpose.toLowerCase()}/${Date.now()}-${safeFilename(input.filename)}`,
          purpose: input.purpose,
          fileName: input.filename,
          contentType: input.contentType,
          size: BigInt(input.size),
          fingerprint,
          dramaId: input.dramaId,
          episodeNo: input.episodeNo,
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
          partSize: PART_SIZE,
        },
      }));
    return this.presentSession(session, input.contentType);
  }

  async signPart(user: AuthUser, id: string, partNumber: number) {
    const session = await this.ownSession(user, id);
    if (!session.uploadId) throw new BadRequestException('这个文件使用整文件直传，不需要分片');
    if (this.storage.driver() !== 's3') throw new BadRequestException('当前存储不支持分片');
    const url = await this.storage.presignPart(session.key, session.uploadId, partNumber);
    return { url, partNumber };
  }

  async ackPart(user: AuthUser, id: string, partNumber: number, etag: string) {
    const session = await this.ownSession(user, id);
    const parts = Array.isArray(session.parts) ? [...(session.parts as { partNumber: number; etag: string }[])] : [];
    const next = parts.filter((part) => part.partNumber !== partNumber);
    next.push({ partNumber, etag });
    await this.prisma.uploadSession.update({ where: { id }, data: { parts: next } });
    return { ok: true, parts: next.length };
  }

  async putContent(user: AuthUser, id: string, body: Buffer) {
    if (!this.viaApi()) throw new NotFoundException();
    const session = await this.ownSession(user, id);
    if (body.length === 0) throw new BadRequestException('文件是空的');
    await this.storage.putObject(session.key, body, session.contentType);
    return { ok: true, size: body.length };
  }

  async putPart(user: AuthUser, id: string, partNumber: number, body: Buffer) {
    if (!this.viaApi()) throw new NotFoundException();
    const session = await this.ownSession(user, id);
    if (!session.uploadId) throw new BadRequestException('这个文件使用整文件直传，不需要分片');
    if (body.length === 0) throw new BadRequestException('分片是空的');
    const etag = await this.storage.uploadPart(session.key, session.uploadId, partNumber, body);
    await this.ackPart(user, id, partNumber, etag);
    return { ok: true, partNumber, etag };
  }

  async complete(user: AuthUser, id: string, parts?: { partNumber: number; etag: string }[]) {
    const session = await this.ownSession(user, id);
    if (session.status === 'COMPLETED') return { id: session.id, key: session.key, status: session.status };
    if (session.expiresAt.getTime() < Date.now()) throw new BadRequestException('上传会话已超过 7 天，请重新上传');
    if (session.uploadId) {
      const acked = parts?.length ? parts : ((session.parts as { partNumber: number; etag: string }[]) ?? []);
      if (!acked.length) throw new BadRequestException('还没有传完的分片');
      await this.storage.completeMultipart(session.key, session.uploadId, acked);
    } else {
      const head = await this.storage.head(session.key);
      if (!head) throw new BadRequestException('文件还没有传到存储，请先上传再确认');
    }
    await this.applyUpload(user, session);
    await this.prisma.uploadSession.update({ where: { id }, data: { status: 'COMPLETED' } });
    await this.audit.write(user.id, 'upload.complete', 'UploadSession', id, { key: session.key, purpose: session.purpose });
    return { id, key: session.key, status: 'COMPLETED', techStatus: session.purpose === 'EPISODE' ? 'CHECKING' : undefined };
  }

  async signRead(user: AuthUser, key: string) {
    await this.assertKeyAccess(user, key);
    return { url: await this.storage.presignGet(key) };
  }

  private async applyUpload(user: AuthUser, session: UploadSession) {
    if (session.purpose === 'COVER' && session.dramaId) {
      await this.load(user, session.dramaId);
      await this.prisma.drama.update({ where: { id: session.dramaId }, data: { coverKey: session.key } });
      return;
    }
    if ((session.purpose === 'LICENSE' || session.purpose === 'COPYRIGHT') && session.dramaId) {
      const drama = await this.load(user, session.dramaId);
      await this.prisma.asset.create({
        data: {
          companyId: drama.companyId,
          dramaId: drama.id,
          type: session.purpose,
          name: session.fileName,
          fileKey: session.key,
        },
      });
      return;
    }
    if (session.purpose === 'EPISODE' && session.dramaId && session.episodeNo) {
      await this.load(user, session.dramaId);
      const fingerprint = session.fingerprint || `${session.fileName}:${session.size}`;
      const existing = await this.prisma.episode.findUnique({ where: { dramaId_no: { dramaId: session.dramaId, no: session.episodeNo } } });
      let reviewStatus = existing?.reviewStatus ?? 'PENDING';
      if (existing?.reviewStatus === 'REJECTED') reviewStatus = 'REPLACED';
      else if (existing?.reviewStatus === 'APPROVED' && existing.fingerprint && existing.fingerprint !== fingerprint) reviewStatus = 'PENDING';
      else if (existing?.reviewStatus === 'UNSAMPLED') reviewStatus = 'UNSAMPLED';
      const saved = await this.prisma.episode.upsert({
        where: { dramaId_no: { dramaId: session.dramaId, no: session.episodeNo } },
        create: {
          dramaId: session.dramaId,
          no: session.episodeNo,
          fileKey: session.key,
          fileName: session.fileName,
          fileSize: session.size,
          contentType: session.contentType,
          fingerprint,
          reviewStatus: 'PENDING',
          techStatus: 'CHECKING',
          techNote: '',
        },
        update: {
          fileKey: session.key,
          fileName: session.fileName,
          fileSize: session.size,
          contentType: session.contentType,
          fingerprint,
          reviewStatus,
          rejectReason: reviewStatus === 'REPLACED' ? existing?.rejectReason : null,
          techStatus: 'CHECKING',
          techNote: '',
          durationSec: null,
          width: null,
          height: null,
        },
      });
      this.scheduleProbe(saved.id);
    }
  }

  private scheduleProbe(episodeId: string) {
    setImmediate(() => {
      void this.probeEpisode(episodeId);
    });
  }

  private async probeEpisode(episodeId: string) {
    const episode = await this.prisma.episode.findUnique({ where: { id: episodeId } });
    if (!episode?.fileKey) return;
    try {
      const bytes = await this.storage.getObject(episode.fileKey);
      const result = await probeBuffer(bytes);
      await this.prisma.episode.update({
        where: { id: episodeId },
        data: { techStatus: result.ok ? 'READY' : 'FAILED', techNote: result.note, durationSec: result.durationSec, width: result.width, height: result.height },
      });
    } catch (error) {
      await this.prisma.episode.update({
        where: { id: episodeId },
        data: { techStatus: 'FAILED', techNote: error instanceof Error ? error.message : '文件损坏或无法读取' },
      }).catch(() => undefined);
    }
  }

  private viaApi() {
    return this.storage.driver() === 'memory' || process.env.UPLOAD_VIA_API === 'true';
  }

  private async presentSession(session: UploadSession, contentType: string) {
    const size = Number(session.size);
    const multipart = this.storage.driver() === 's3' && size > SINGLE_PUT_MAX;
    const viaApi = this.viaApi();
    if (!multipart) {
      const signed = viaApi ? { url: `/api/storage/uploads/${session.id}/content`, headers: {} } : await this.storage.presignPut(session.key, contentType);
      return { id: session.id, key: session.key, mode: 'single' as const, viaApi, url: signed.url, headers: signed.headers, size };
    }
    const uploadId = session.uploadId ?? (await this.storage.createMultipart(session.key, contentType));
    if (!session.uploadId) await this.prisma.uploadSession.update({ where: { id: session.id }, data: { uploadId } });
    const partCount = Math.ceil(size / PART_SIZE);
    return {
      id: session.id,
      key: session.key,
      mode: 'multipart' as const,
      viaApi,
      uploadId,
      partSize: PART_SIZE,
      partCount,
      completedParts: session.parts ?? [],
      size,
    };
  }

  async reviewAsset(user: AuthUser, id: string, input: { pass: boolean; reason?: string }) {
    assertBusinessWrite(user);
    assertRole(user, ['OPS', 'OPS_MANAGER'], '授权材料由运营审核');
    const asset = assertFound(
      await this.prisma.asset.findUnique({ where: { id }, include: { company: true } }),
      '授权材料不存在',
    );
    if (!['LICENSE', 'COPYRIGHT'].includes(asset.type)) throw new BadRequestException('只能审核授权书或版权证明');
    if (user.role === 'OPS') assertCompanyAccess(user, asset.company);
    if (!input.pass && !input.reason) throw new BadRequestException('驳回时请填写原因');
    return this.prisma.asset.update({
      where: { id },
      data: {
        reviewStatus: input.pass ? 'APPROVED' : 'REJECTED',
        reviewedById: user.id,
        reviewedAt: new Date(),
        rejectReason: input.pass ? null : input.reason,
      },
    });
  }

  private async ownSession(user: AuthUser, id: string) {
    const session = assertFound(await this.prisma.uploadSession.findUnique({ where: { id } }), '上传会话不存在');
    if (user.role === 'CLIENT' && session.companyId !== user.companyId) throw new ForbiddenException('不能使用别人的上传会话');
    if (user.role === 'OPS' || user.role === 'BD') {
      const company = assertFound(await this.prisma.company.findUnique({ where: { id: session.companyId } }), '客户不存在');
      assertCompanyAccess(user, company);
    }
    return session;
  }

  private async companyForUpload(user: AuthUser, input: { dramaId?: string; companyId?: string; purpose: string }) {
    if (input.dramaId) {
      const drama = await this.load(user, input.dramaId);
      return drama.companyId;
    }
    if (user.role === 'CLIENT' && user.companyId) return user.companyId;
    if (input.companyId) {
      if (user.role === 'FINANCE' && !['VOUCHER', 'INVOICE', 'CONTRACT'].includes(input.purpose)) {
        throw new ForbiddenException('财务不上传剧目文件');
      }
      const company = assertFound(await this.prisma.company.findUnique({ where: { id: input.companyId } }), '客户不存在');
      if (user.role === 'OPS' || user.role === 'BD') assertCompanyAccess(user, company);
      return company.id;
    }
    throw new BadRequestException('请先选择剧目或客户');
  }

  private clientCompany(user: AuthUser) {
    if (user.role !== 'CLIENT' || !user.companyId) throw new ForbiddenException('只有客户可以新建剧目');
    return user.companyId;
  }

  private asListQuery(input: z.infer<typeof dramaSelectionSchema>): DramaListQuery {
    return { page: 1, pageSize: 20, sort: 'updatedAt', order: 'desc', q: input.q, phase: input.phase, genre: input.genre, language: input.language, companyId: input.companyId };
  }

  private whereFor(user: AuthUser, query: DramaListQuery): Prisma.DramaWhereInput {
    if (user.role === 'FINANCE') throw new ForbiddenException('财务账号不查看视频库');
    const where: Prisma.DramaWhereInput = {};
    if (user.role === 'CLIENT') where.companyId = user.companyId!;
    else if (user.role === 'OPS') where.company = { ownerId: user.id };
    else if (user.role === 'BD') where.company = { bdId: user.id };
    if (query.companyId && user.role !== 'CLIENT') where.companyId = query.companyId;
    if (query.genre) where.genre = query.genre;
    if (query.language) where.language = query.language;
    if (query.q) {
      const norm = normalizeName(query.q);
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { titleEn: { contains: query.q, mode: 'insensitive' } },
        { code: { contains: query.q, mode: 'insensitive' } },
        ...(norm ? [{ nameNorm: { contains: norm } }] : []),
      ];
    }
    const phaseMap = {
      action: ['NEEDS_REVISION', 'PRECHECK_FAILED'],
      review: ['PENDING_ASSIGN', 'PENDING_REVIEW', 'IN_REVIEW', 'SHARE_CONFIG', 'SHARE_REVIEW'],
      ready: ['APPROVED', 'DISTRIBUTING'],
      live: ['LIVE'],
      offline: ['OFFLINE'],
      withdrawn: ['WITHDRAWN'],
    } as const;
    if (query.phase === 'idle') {
      where.plans = { none: {} };
    } else {
      const some: Prisma.DistributionPlanWhereInput = {};
      if (query.phase) some.status = { in: [...phaseMap[query.phase]] as PlanStatus[] };
      if (query.round) some.round = query.round;
      if (query.platformId) some.platforms = { some: { platformId: query.platformId } };
      if (Object.keys(some).length) where.plans = { some };
    }
    return where;
  }

  private async load(user: AuthUser, id: string) {
    const drama = assertFound(
      await this.prisma.drama.findUnique({
        where: { id },
        include: {
          episodes: { orderBy: { no: 'asc' } },
          assets: { orderBy: { createdAt: 'desc' } },
          plans: { include: { platforms: true, shares: true }, orderBy: { createdAt: 'desc' } },
          company: { select: { id: true, ownerId: true, bdId: true, name: true } },
        },
      }),
      '剧目不存在',
    );
    if (user.role === 'FINANCE') throw new ForbiddenException('财务账号不查看视频库');
    if (user.role === 'CLIENT' || user.role === 'OPS' || user.role === 'BD') assertCompanyAccess(user, drama.company);
    return drama;
  }

  private async card(row: { coverKey: string | null; plans: { status: string }[]; episodes?: { techStatus: string; fileKey: string | null }[] } & Record<string, unknown>) {
    return {
      ...row,
      phase: clientPhaseFromPlans(row.plans.map((plan) => plan.status)),
      techLabel: techLabel(row.episodes || []),
      coverUrl: row.coverKey ? await this.storage.presignGet(row.coverKey).catch(() => null) : null,
    };
  }

  private async assertKeyAccess(user: AuthUser, key: string) {
    const companyId = key.split('/')[0];
    if (!companyId) throw new ForbiddenException('文件路径不正确');
    const company = assertFound(await this.prisma.company.findUnique({ where: { id: companyId } }), '文件不存在');
    if (user.role === 'CLIENT' || user.role === 'OPS' || user.role === 'BD') assertCompanyAccess(user, company);
    if (user.role === 'FINANCE') throw new ForbiddenException('没有权限查看这个文件');
  }
}

function techLabel(episodes: { techStatus: string; fileKey: string | null }[]) {
  const files = episodes.filter((episode) => episode.fileKey);
  if (!files.length) return null;
  if (files.some((episode) => episode.techStatus === 'CHECKING')) return '校验中';
  if (files.some((episode) => episode.techStatus === 'FAILED')) return '有问题';
  if (files.every((episode) => episode.techStatus === 'READY')) return '可发行';
  return null;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'object' && 'text' in value && value.text) return String(value.text).trim();
  if (typeof value === 'object' && 'result' in value) return cellText(value.result as ExcelJS.CellValue);
  return String(value).trim();
}

const execFileAsync = promisify(execFile);

async function probeBuffer(bytes: Buffer) {
  const dir = await mkdtemp(join(tmpdir(), 'probe-'));
  const file = join(dir, 'clip.mp4');
  try {
    await writeFile(file, bytes);
    const { stdout } = await execFileAsync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], { timeout: 20000 });
    const parsed = JSON.parse(stdout) as { streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number }[]; format?: { duration?: string; format_name?: string } };
    const video = parsed.streams?.find((stream) => stream.codec_type === 'video');
    const duration = Number(parsed.format?.duration || 0);
    const width = video?.width || 0;
    const height = video?.height || 0;
    const format = parsed.format?.format_name || '';
    const codec = video?.codec_name || '';
    if (!video || !/mp4|mov|m4v/.test(format)) return { ok: false, note: '文件损坏或格式无法识别', durationSec: null, width: width || null, height: height || null };
    if (!['h264', 'hevc', 'av1'].includes(codec)) return { ok: false, note: `编码 ${codec || '未知'} 不在支持范围`, durationSec: Math.round(duration) || null, width, height };
    if (Math.min(width, height) < 720) return { ok: false, note: `分辨率 ${width}x${height} 不足，短边至少 720`, durationSec: Math.round(duration) || null, width, height };
    if (!Number.isFinite(duration) || duration < 1) return { ok: false, note: '时长无法识别或短于 1 秒', durationSec: null, width, height };
    return { ok: true, note: '', durationSec: Math.round(duration), width, height };
  } catch {
    return { ok: false, note: '文件损坏或格式无法识别', durationSec: null, width: null, height: null };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export { dramaListSchema };
