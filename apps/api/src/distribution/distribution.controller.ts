import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { episodeDecisionSchema, listingPatchSchema, planCreateSchema, reviewReassignSchema, sharePutSchema, shareReviewSchema, spotCheckSchema } from '@shortform/shared';
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
