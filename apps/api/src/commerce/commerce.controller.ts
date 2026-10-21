import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import {
  contractCreateSchema,
  contractPatchSchema,
  invoiceReviewSchema,
  invoiceSchema,
  pageSchema,
  paySchema,
  policySchema,
  rateSchema,
  settlementAmountSchema,
  settlementGenerateSchema,
  settlementReviewSchema,
  withdrawalCreateSchema,
} from '@shortform/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../core/auth';
import { ZodPipe } from '../core/zod.pipe';
import { CommerceService, listQuery } from './commerce.service';

const decision = z.object({ pass: z.boolean(), reason: z.string().optional() });

@Controller()
@UseGuards(JwtAuthGuard)
export class CommerceController {
  constructor(private readonly commerce: CommerceService) {}

  @Get('contracts')
  contracts(@CurrentUser() user: AuthUser, @Query(new ZodPipe(listQuery)) query: z.infer<typeof listQuery>) {
    return this.commerce.listContracts(user, query);
  }

  @Post('contracts')
  createContract(@CurrentUser() user: AuthUser, @Body(new ZodPipe(contractCreateSchema)) body: z.infer<typeof contractCreateSchema>) {
    return this.commerce.createContract(user, body);
  }

  @Patch('contracts/:id')
  patchContract(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(contractPatchSchema)) body: z.infer<typeof contractPatchSchema>) {
    return this.commerce.patchContract(user, id, body);
  }

  @Get('companies/:id/settlement-policy')
  policy(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.commerce.getPolicy(user, id);
  }

  @Put('companies/:id/settlement-policy')
  putPolicy(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(policySchema)) body: z.infer<typeof policySchema>) {
    return this.commerce.putCompanyPolicy(user, id, body);
  }

  @Put('plans/:planId/settlement-policy')
  putProject(@CurrentUser() user: AuthUser, @Param('planId') planId: string, @Body(new ZodPipe(policySchema)) body: z.infer<typeof policySchema>) {
    return this.commerce.putProjectPolicy(user, planId, body);
  }

  @Get('settlements')
  settlements(@CurrentUser() user: AuthUser, @Query(new ZodPipe(listQuery)) query: z.infer<typeof listQuery>) {
    return this.commerce.listSettlements(user, query);
  }

  @Post('settlements/generate')
  generate(@CurrentUser() user: AuthUser, @Body(new ZodPipe(settlementGenerateSchema)) body: z.infer<typeof settlementGenerateSchema>) {
    return this.commerce.generate(user, body);
  }

  @Get('settlements/:id')
  settlement(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.commerce.getSettlement(user, id);
  }

  @Post('settlements/:id/amount')
  amount(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(settlementAmountSchema)) body: z.infer<typeof settlementAmountSchema>) {
    return this.commerce.enterAmount(user, id, body);
  }

  @Post('settlements/:id/review')
  reviewSettlement(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(settlementReviewSchema)) body: z.infer<typeof settlementReviewSchema>) {
    return this.commerce.reviewSettlement(user, id, body);
  }

  @Get('withdrawals')
  withdrawals(@CurrentUser() user: AuthUser, @Query(new ZodPipe(pageSchema)) query: z.infer<typeof pageSchema>) {
    return this.commerce.listWithdrawals(user, query);
  }

  @Post('withdrawals')
  createWithdrawal(@CurrentUser() user: AuthUser, @Body(new ZodPipe(withdrawalCreateSchema)) body: z.infer<typeof withdrawalCreateSchema>) {
    return this.commerce.createWithdrawal(user, body);
  }

  @Post('withdrawals/:id/verify')
  verify(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(decision)) body: z.infer<typeof decision>) {
    return this.commerce.verifyWithdrawal(user, id, body.pass, body.reason);
  }

  @Post('withdrawals/:id/invoice')
  invoice(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(invoiceSchema)) body: z.infer<typeof invoiceSchema>) {
    return this.commerce.uploadInvoice(user, id, body);
  }

  @Post('withdrawals/:id/invoice/review')
  reviewInvoice(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(invoiceReviewSchema)) body: z.infer<typeof invoiceReviewSchema>) {
    return this.commerce.reviewInvoice(user, id, body);
  }

  @Post('withdrawals/:id/pay')
  pay(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(paySchema)) body: z.infer<typeof paySchema>) {
    return this.commerce.pay(user, id, body);
  }

  @Get('rates')
  rates() {
    return this.commerce.listRates();
  }

  @Post('rates')
  addRate(@CurrentUser() user: AuthUser, @Body(new ZodPipe(rateSchema)) body: z.infer<typeof rateSchema>) {
    return this.commerce.addRate(user, body);
  }
}
