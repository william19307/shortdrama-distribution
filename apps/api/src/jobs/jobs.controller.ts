import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../core/auth';
import { JobsService } from './jobs.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post('admin/jobs/:name/run')
  run(@CurrentUser() user: AuthUser, @Param('name') name: string) {
    return this.jobs.run(name, user);
  }
}
