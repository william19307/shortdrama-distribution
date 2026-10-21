import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { dramaCreateSchema, dramaListSchema, dramaPatchSchema, partAckSchema, partSignSchema, uploadCompleteSchema, uploadInitSchema } from '@shortform/shared';
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
