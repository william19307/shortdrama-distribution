import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { pageSchema, platformCreateSchema, platformPatchSchema, settingsSchema, userCreateSchema, userPatchSchema } from '@shortform/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../core/auth';
import { ZodPipe } from '../core/zod.pipe';
import { AdminService, logQuery } from './admin.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('workbench')
  workbench(@CurrentUser() user: AuthUser) {
    return this.admin.workbench(user);
  }

  @Get('admin/assignees')
  assignees(@CurrentUser() user: AuthUser) {
    return this.admin.assignees(user);
  }

  @Get('admin/users')
  users(@CurrentUser() user: AuthUser, @Query(new ZodPipe(pageSchema)) query: z.infer<typeof pageSchema>) {
    return this.admin.users(user, query);
  }

  @Post('admin/users')
  createUser(@CurrentUser() user: AuthUser, @Body(new ZodPipe(userCreateSchema)) body: z.infer<typeof userCreateSchema>) {
    return this.admin.createUser(user, body);
  }

  @Patch('admin/users/:id')
  patchUser(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(userPatchSchema)) body: z.infer<typeof userPatchSchema>) {
    return this.admin.patchUser(user, id, body);
  }

  @Get('admin/settings')
  settings(@CurrentUser() user: AuthUser) {
    return this.admin.getSettings(user);
  }

  @Put('admin/settings')
  putSettings(@CurrentUser() user: AuthUser, @Body(new ZodPipe(settingsSchema)) body: z.infer<typeof settingsSchema>) {
    return this.admin.putSettings(user, body);
  }

  @Get('platforms')
  platforms() {
    return this.admin.platforms();
  }

  @Post('platforms')
  createPlatform(@CurrentUser() user: AuthUser, @Body(new ZodPipe(platformCreateSchema)) body: z.infer<typeof platformCreateSchema>) {
    return this.admin.createPlatform(user, body);
  }

  @Patch('platforms/:id')
  patchPlatform(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(platformPatchSchema)) body: z.infer<typeof platformPatchSchema>) {
    return this.admin.patchPlatform(user, id, body);
  }

  @Get('audit-logs')
  logs(@CurrentUser() user: AuthUser, @Query(new ZodPipe(logQuery)) query: z.infer<typeof logQuery>) {
    return this.admin.logs(user, query);
  }

  @Get('tasks')
  tasks(@CurrentUser() user: AuthUser, @Query(new ZodPipe(pageSchema)) query: z.infer<typeof pageSchema>) {
    return this.admin.tasks(user, query);
  }
}
