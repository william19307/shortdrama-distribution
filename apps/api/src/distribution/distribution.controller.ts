import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Put, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { batchRejectSchema, episodeDecisionSchema, listingPatchSchema, planBatchSchema, planCreateSchema, rejectReasonPatchSchema, rejectReasonSchema, reviewBatchPassSchema, reviewReassignSchema, sharePutSchema, shareReviewSchema, shareTemplateApplySchema, shareTemplateSchema, spotCheckSchema } from '@shortform/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../core/auth';
import { ZodPipe } from '../core/zod.pipe';
import { DistributionService, planListSchema } from './distribution.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class DistributionController {
  constructor(private readonly distribution: DistributionService) {}

  @Post('plans')
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(planCreateSchema)) body: z.infer<typeof planCreateSchema>) {
    return this.distribution.createPlan(user, body);
  }

  @Post('plans/batch')
  createBatch(@CurrentUser() user: AuthUser, @Body(new ZodPipe(planBatchSchema)) body: z.infer<typeof planBatchSchema>) {
    return this.distribution.createPlans(user, body);
  }

  @Get('plans')
  list(@CurrentUser() user: AuthUser, @Query(new ZodPipe(planListSchema)) query: z.infer<typeof planListSchema>) {
    return this.distribution.listPlans(user, query);
  }

  @Get('plans/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.distribution.getPlan(user, id);
  }

  @Post('plans/:id/withdraw')
  withdraw(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.distribution.withdraw(user, id);
  }

  @Post('plans/:id/resubmit')
  resubmit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.distribution.resubmit(user, id);
  }

  @Put('plans/:id/shares')
  shares(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(sharePutSchema)) body: z.infer<typeof sharePutSchema>) {
    return this.distribution.putShares(user, id, body.items);
  }

  @Post('plans/:id/shares/review')
  reviewShares(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(shareReviewSchema)) body: z.infer<typeof shareReviewSchema>) {
    return this.distribution.reviewShares(user, id, body);
  }

  @Post('reviews/batch-pass')
  batchPass(@CurrentUser() user: AuthUser, @Body(new ZodPipe(reviewBatchPassSchema)) body: z.infer<typeof reviewBatchPassSchema>) {
    return this.distribution.batchPass(user, body.planIds);
  }

  @Get('reject-reasons')
  reasons(@CurrentUser() user: AuthUser) {
    return this.distribution.listRejectReasons(user);
  }

  @Post('reject-reasons')
  createReason(@CurrentUser() user: AuthUser, @Body(new ZodPipe(rejectReasonSchema)) body: z.infer<typeof rejectReasonSchema>) {
    return this.distribution.createRejectReason(user, body);
  }

  @Patch('reject-reasons/:id')
  patchReason(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(rejectReasonPatchSchema)) body: z.infer<typeof rejectReasonPatchSchema>) {
    return this.distribution.updateRejectReason(user, id, body);
  }

  @Post('reviews/batch-reject')
  batchReject(@CurrentUser() user: AuthUser, @Body(new ZodPipe(batchRejectSchema)) body: z.infer<typeof batchRejectSchema>) {
    return this.distribution.batchReject(user, body);
  }

  @Get('share-templates')
  templates() {
    return this.distribution.listTemplates();
  }

  @Post('share-templates')
  createTemplate(@CurrentUser() user: AuthUser, @Body(new ZodPipe(shareTemplateSchema)) body: z.infer<typeof shareTemplateSchema>) {
    return this.distribution.createTemplate(user, body);
  }

  @Post('share-templates/:id/preview')
  previewTemplate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(shareTemplateApplySchema)) body: z.infer<typeof shareTemplateApplySchema>) {
    return this.distribution.previewTemplate(user, id, body.planIds);
  }

  @Post('share-templates/:id/apply')
  applyTemplate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(shareTemplateApplySchema)) body: z.infer<typeof shareTemplateApplySchema>) {
    return this.distribution.applyTemplate(user, id, body.planIds);
  }

  @Get('listings/template')
  async listingTemplate() {
    const body = await this.distribution.listingTemplate();
    return new StreamableFile(body, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', disposition: 'attachment; filename="listing-template.xlsx"' });
  }

  @Post('listings/import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  importListings(@CurrentUser() user: AuthUser, @UploadedFile() file?: { buffer: Buffer }) {
    if (!file?.buffer?.length) throw new BadRequestException('请上传 Excel');
    return this.distribution.importListings(user, file.buffer);
  }

  @Post('reviews/:id/open')
  open(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.distribution.openReview(user, id);
  }

  @Post('reviews/:id/episodes/:episodeId')
  decide(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('episodeId') episodeId: string,
    @Body(new ZodPipe(episodeDecisionSchema)) body: z.infer<typeof episodeDecisionSchema>,
  ) {
    return this.distribution.decideEpisode(user, id, episodeId, body);
  }

  @Get('reviews/sla-board')
  slaBoard(@CurrentUser() user: AuthUser) {
    return this.distribution.slaBoard(user);
  }

  @Post('reviews/:id/assign')
  assign(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(z.object({ assigneeId: z.string().min(1) }))) body: { assigneeId: string }) {
    return this.distribution.assign(user, id, body.assigneeId);
  }

  @Post('reviews/:id/reassign')
  reassign(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(reviewReassignSchema)) body: z.infer<typeof reviewReassignSchema>) {
    return this.distribution.reassign(user, id, body);
  }

  @Post('reviews/spot-check')
  spotCheck(@CurrentUser() user: AuthUser, @Body(new ZodPipe(spotCheckSchema)) body: z.infer<typeof spotCheckSchema>) {
    return this.distribution.spotCheck(user, body);
  }

  @Post('reviews/:id/expand')
  expand(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.distribution.expand(user, id);
  }

  @Post('reviews/:id/finish')
  finish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.distribution.finish(user, id);
  }

  @Patch('listings/:id')
  listing(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(listingPatchSchema)) body: z.infer<typeof listingPatchSchema>) {
    return this.distribution.patchListing(user, id, body);
  }
}
