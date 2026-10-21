import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { bankAccountSchema, certReviewSchema, certSchema, ownerPatchSchema, pageSchema } from '@shortform/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../core/auth';
import { ZodPipe } from '../core/zod.pipe';
import { CompanyService } from './company.service';

const listSchema = pageSchema.extend({
  q: z.string().optional(),
  certStatus: z.string().optional(),
});

@Controller()
@UseGuards(JwtAuthGuard)
export class CompanyController {
  constructor(private readonly companies: CompanyService) {}

  @Get('company')
  mine(@CurrentUser() user: AuthUser) {
    return this.companies.myCompany(user);
  }

  @Put('company/certification')
  submit(@CurrentUser() user: AuthUser, @Body(new ZodPipe(certSchema)) body: z.infer<typeof certSchema>) {
    return this.companies.submitCert(user, body);
  }

  @Get('companies')
  list(@CurrentUser() user: AuthUser, @Query(new ZodPipe(listSchema)) query: z.infer<typeof listSchema>) {
    return this.companies.list(user, query);
  }

  @Get('companies/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.companies.detail(user, id);
  }

  @Post('companies/:id/certification/review')
  review(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(certReviewSchema)) body: z.infer<typeof certReviewSchema>) {
    return this.companies.reviewCert(user, id, body);
  }

  @Patch('companies/:id/owner')
  owner(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ownerPatchSchema)) body: z.infer<typeof ownerPatchSchema>) {
    return this.companies.setOwner(user, id, body);
  }

  @Patch('companies/:id/bd')
  bd(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(z.object({ bdId: z.string().nullable() }))) body: { bdId: string | null }) {
    return this.companies.setBd(user, id, body.bdId);
  }

  @Get('bank-accounts')
  banks(@CurrentUser() user: AuthUser) {
    return this.companies.listBanks(user);
  }

  @Post('bank-accounts')
  addBank(@CurrentUser() user: AuthUser, @Body(new ZodPipe(bankAccountSchema)) body: z.infer<typeof bankAccountSchema>) {
    return this.companies.addBank(user, body);
  }

  @Patch('bank-accounts/:id')
  updateBank(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(bankAccountSchema.partial())) body: Partial<z.infer<typeof bankAccountSchema>>) {
    return this.companies.updateBank(user, id, body);
  }

  @Delete('bank-accounts/:id')
  removeBank(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.companies.removeBank(user, id);
  }
}
