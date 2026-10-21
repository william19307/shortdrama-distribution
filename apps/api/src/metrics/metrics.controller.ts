import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { dailyListSchema, dailyStatSchema, evidenceArchiveSchema, forcePublishSchema, importConfirmSchema, importIgnoreSchema, importMappingSchema, importMarkSchema, importPatchRowSchema, pageSchema, submitManagerSchema, ticketMessageSchema, watermarkAssignSchema, watermarkCreateSchema } from '@shortform/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../core/auth';
import { ZodPipe } from '../core/zod.pipe';
import { ImportService } from './import.service';
import { MetricsService } from './metrics.service';

const ticketQuery = pageSchema.extend({ type: z.string().optional(), status: z.string().optional() });

@Controller()
@UseGuards(JwtAuthGuard)
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    private readonly imports: ImportService,
  ) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.metrics.dashboard(user);
  }

  @Get('sync-expectations')
  expectations() {
    return this.metrics.expectations();
  }

  @Get('daily-stats')
  listDaily(@CurrentUser() user: AuthUser, @Query(new ZodPipe(dailyListSchema)) query: z.infer<typeof dailyListSchema>) {
    return this.metrics.listDaily(user, query);
  }

  @Post('daily-stats')
  saveDaily(@CurrentUser() user: AuthUser, @Body(new ZodPipe(dailyStatSchema)) body: z.infer<typeof dailyStatSchema>) {
    return this.metrics.saveDaily(user, body);
  }

  @Get('daily-sync')
  syncTasks(@CurrentUser() user: AuthUser) {
    return this.imports.listSync(user);
  }

  @Post('daily-stats/import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  importUpload(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File, @Query('platformId') platformId?: string) {
    return this.imports.upload(user, file, platformId);
  }

  @Get('daily-stats/import/:id')
  importGet(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.imports.getBatch(user, id);
  }

  @Put('daily-stats/import/:id/mapping')
  importMapping(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(importMappingSchema)) body: z.infer<typeof importMappingSchema>) {
    return this.imports.putMapping(user, id, body);
  }

  @Post('daily-stats/import/:id/validate')
  importValidate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.imports.validate(user, id);
  }

  @Post('daily-stats/import/:id/rows/:rowNo/mark')
  importMark(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('rowNo', ParseIntPipe) rowNo: number,
    @Body(new ZodPipe(importMarkSchema)) body: z.infer<typeof importMarkSchema>,
  ) {
    return this.imports.markRow(user, id, rowNo, body.reason);
  }

  @Post('daily-stats/import/:id/rows/:rowNo/confirm')
  importConfirm(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('rowNo', ParseIntPipe) rowNo: number,
    @Body(new ZodPipe(importConfirmSchema)) body: z.infer<typeof importConfirmSchema>,
  ) {
    return this.imports.confirmRow(user, id, rowNo, body.dramaId);
  }

  @Post('daily-stats/import/:id/rows/:rowNo/ignore')
  importIgnore(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('rowNo', ParseIntPipe) rowNo: number,
    @Body(new ZodPipe(importIgnoreSchema)) body: z.infer<typeof importIgnoreSchema>,
  ) {
    return this.imports.ignoreRow(user, id, rowNo, body.reason);
  }

  @Patch('daily-stats/import/:id/rows/:rowNo')
  importPatch(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('rowNo', ParseIntPipe) rowNo: number,
    @Body(new ZodPipe(importPatchRowSchema)) body: z.infer<typeof importPatchRowSchema>,
  ) {
    return this.imports.patchRow(user, id, rowNo, body.values);
  }

  @Post('daily-stats/import/:id/publish')
  importPublish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.imports.publish(user, id);
  }

  @Post('daily-stats/import/:id/force-publish')
  importForce(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(forcePublishSchema)) body: z.infer<typeof forcePublishSchema>) {
    return this.imports.forcePublish(user, id, body);
  }

  @Post('daily-stats/import/:id/submit-manager')
  importSubmit(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(submitManagerSchema)) body: z.infer<typeof submitManagerSchema>) {
    return this.imports.submitManager(user, id, body);
  }

  @Post('daily-stats/:id/review')
  reviewDaily(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.metrics.reviewDaily(user, id);
  }

  @Post('daily-stats/:id/report')
  reportDaily(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(z.object({ note: z.string().trim().min(1).max(500) }))) body: { note: string },
  ) {
    return this.metrics.reportDaily(user, id, body.note);
  }

  @Post('daily-stats/:id/lock')
  lockDaily(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.metrics.lockDaily(user, id);
  }

  @Post('daily-stats/:id/force-publish')
  forcePublish(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(forcePublishSchema)) body: z.infer<typeof forcePublishSchema>,
  ) {
    return this.metrics.forcePublish(user, id, body.reason);
  }

  @Post('evidence/archive-zip')
  async archiveZip(@CurrentUser() user: AuthUser, @Body(new ZodPipe(evidenceArchiveSchema)) body: z.infer<typeof evidenceArchiveSchema>) {
    const zip = await this.metrics.archiveEvidence(user, body.fileKeys);
    return new StreamableFile(zip, { type: 'application/zip', disposition: 'attachment; filename="evidence.zip"' });
  }

  @Post('watermarks')
  createWatermark(@CurrentUser() user: AuthUser, @Body(new ZodPipe(watermarkCreateSchema)) body: z.infer<typeof watermarkCreateSchema>) {
    return this.metrics.createWatermark(user, body);
  }

  @Get('watermarks')
  listWatermarks(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.metrics.listWatermarks(user, status);
  }

  @Post('watermarks/:id/assign')
  assign(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(watermarkAssignSchema)) body: z.infer<typeof watermarkAssignSchema>) {
    return this.metrics.assignWatermark(user, id, body);
  }

  @Get('tickets')
  tickets(@CurrentUser() user: AuthUser, @Query(new ZodPipe(ticketQuery)) query: z.infer<typeof ticketQuery>) {
    return this.metrics.listTickets(user, query);
  }

  @Get('tickets/:id')
  ticket(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.metrics.getTicket(user, id);
  }

  @Post('tickets/:id/read')
  read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.metrics.readTicket(user, id);
  }

  @Post('tickets/:id/messages')
  message(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ticketMessageSchema)) body: z.infer<typeof ticketMessageSchema>) {
    return this.metrics.message(user, id, body);
  }
}
