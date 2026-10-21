import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { dailyListSchema, dailyStatSchema, pageSchema, ticketMessageSchema, watermarkAssignSchema, watermarkCreateSchema } from '@shortform/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../core/auth';
import { ZodPipe } from '../core/zod.pipe';
import { MetricsService } from './metrics.service';

const ticketQuery = pageSchema.extend({ type: z.string().optional(), status: z.string().optional() });

@Controller()
@UseGuards(JwtAuthGuard)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

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

  @Post('daily-stats/:id/review')
  reviewDaily(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.metrics.reviewDaily(user, id);
  }

  @Post('daily-stats/:id/lock')
  lockDaily(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.metrics.lockDaily(user, id);
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
