import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { pageSchema } from '@shortform/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../core/auth';
import { ZodPipe } from '../core/zod.pipe';
import { NotificationsService } from './notifications.service';

const listSchema = pageSchema.extend({
  unreadOnly: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => value === true || value === 'true' || value === '1'),
});

@Controller()
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('notifications')
  list(@CurrentUser() user: AuthUser, @Query(new ZodPipe(listSchema)) query: z.infer<typeof listSchema>) {
    return this.notifications.list(user, query);
  }

  @Post('notifications/:id/read')
  read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user, id);
  }

  @Post('notifications/read-all')
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user);
  }
}
