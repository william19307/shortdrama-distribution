import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Put, Query, Req, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { dramaBatchSchema, dramaCreateSchema, dramaListSchema, dramaPatchSchema, dramaSelectionSchema, folderPreviewSchema, partAckSchema, partSignSchema, uploadCompleteSchema, uploadInitSchema } from '@shortform/shared';
import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../core/auth';
import { ZodPipe } from '../core/zod.pipe';
import { CatalogService } from './catalog.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('dramas')
  list(@CurrentUser() user: AuthUser, @Query(new ZodPipe(dramaListSchema)) query: z.infer<typeof dramaListSchema>) {
    return this.catalog.list(user, query);
  }

  @Get('dramas/export')
  async export(@CurrentUser() user: AuthUser, @Query(new ZodPipe(dramaListSchema)) query: z.infer<typeof dramaListSchema>, @Res() res: Response) {
    const csv = await this.catalog.exportCsv(user, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="dramas.csv"');
    res.send(`\uFEFF${csv}`);
  }

  @Post('dramas/selection')
  selection(@CurrentUser() user: AuthUser, @Body(new ZodPipe(dramaSelectionSchema)) body: z.infer<typeof dramaSelectionSchema>) {
    return this.catalog.selection(user, body);
  }

  @Post('dramas/batch')
  batch(@CurrentUser() user: AuthUser, @Body(new ZodPipe(dramaBatchSchema)) body: z.infer<typeof dramaBatchSchema>) {
    return this.catalog.batchMeta(user, body);
  }

  @Post('dramas/export')
  async exportSelected(@CurrentUser() user: AuthUser, @Body(new ZodPipe(dramaSelectionSchema)) body: z.infer<typeof dramaSelectionSchema>, @Res() res: Response) {
    const csv = await this.catalog.exportCsv(user, { page: 1, pageSize: 20, sort: 'updatedAt', order: 'desc', ...body });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="dramas.csv"');
    res.send(`\uFEFF${csv}`);
  }

  @Get('dramas/metadata-template')
  async metadataTemplate() {
    const body = await this.catalog.metadataTemplate();
    return new StreamableFile(body, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', disposition: 'attachment; filename="metadata-template.xlsx"' });
  }

  @Post('dramas/metadata-import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  importMetadata(@CurrentUser() user: AuthUser, @UploadedFile() file?: { buffer: Buffer }) {
    if (!file?.buffer?.length) throw new BadRequestException('请上传 Excel');
    return this.catalog.importMetadata(user, file.buffer);
  }

  @Post('library/folder-preview')
  previewFolder(@CurrentUser() user: AuthUser, @Body(new ZodPipe(folderPreviewSchema)) body: z.infer<typeof folderPreviewSchema>) {
    return this.catalog.previewFolder(user, body);
  }

  @Post('library/folder-apply')
  applyFolder(@CurrentUser() user: AuthUser, @Body(new ZodPipe(folderPreviewSchema)) body: z.infer<typeof folderPreviewSchema>) {
    return this.catalog.applyFolder(user, body);
  }

  @Post('dramas')
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(dramaCreateSchema)) body: z.infer<typeof dramaCreateSchema>) {
    return this.catalog.create(user, body);
  }

  @Get('dramas/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.catalog.detail(user, id);
  }

  @Patch('dramas/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(dramaPatchSchema)) body: z.infer<typeof dramaPatchSchema>) {
    return this.catalog.update(user, id, body);
  }

  @Get('storage/uploads')
  openUploads(@CurrentUser() user: AuthUser) {
    return this.catalog.listOpenUploads(user);
  }

  @Post('storage/uploads')
  init(@CurrentUser() user: AuthUser, @Body(new ZodPipe(uploadInitSchema)) body: z.infer<typeof uploadInitSchema>) {
    return this.catalog.initUpload(user, body);
  }

  @Post('storage/uploads/:id/parts')
  signPart(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(partSignSchema)) body: z.infer<typeof partSignSchema>) {
    return this.catalog.signPart(user, id, body.partNumber);
  }

  @Post('storage/uploads/:id/parts/ack')
  ack(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(partAckSchema)) body: z.infer<typeof partAckSchema>) {
    return this.catalog.ackPart(user, id, body.partNumber, body.etag);
  }

  @Put('storage/uploads/:id/content')
  put(@CurrentUser() user: AuthUser, @Param('id') id: string, @Req() req: Request) {
    const body = req.body as Buffer;
    return this.catalog.putContent(user, id, Buffer.isBuffer(body) ? body : Buffer.alloc(0));
  }

  @Put('storage/uploads/:id/parts/:partNumber')
  putPart(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('partNumber') partNumber: string, @Req() req: Request) {
    const body = req.body as Buffer;
    return this.catalog.putPart(user, id, Number(partNumber), Buffer.isBuffer(body) ? body : Buffer.alloc(0));
  }

  @Post('storage/uploads/:id/complete')
  complete(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(uploadCompleteSchema)) body: z.infer<typeof uploadCompleteSchema>) {
    return this.catalog.complete(user, id, body.parts);
  }

  @Post('assets/:id/review')
  reviewAsset(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(z.object({ pass: z.boolean(), reason: z.string().max(500).optional() }))) body: { pass: boolean; reason?: string },
  ) {
    return this.catalog.reviewAsset(user, id, body);
  }

  @Get('storage/sign')
  sign(@CurrentUser() user: AuthUser, @Query('key') key: string) {
    return this.catalog.signRead(user, key || '');
  }
}
