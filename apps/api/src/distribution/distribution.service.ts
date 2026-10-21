import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import {
  BLOCKING_PLAN_STATUSES,
  PLAN_STATUS_LABEL,
  addBusinessDays,
  clientPhaseFromPlans,
  formatCnDate,
  pageSchema,
  sampleEpisodeNos,
} from '@shortform/shared';
import { z } from 'zod';
import { assertCompanyAccess, assertFound } from '../core/access';
import { hidesCommercialTerms, shareDto } from '../core/viewer-dto';
import { AuditService } from '../core/audit.service';
import { assertBusinessWrite, assertRole, AuthUser, day, nextCode } from '../core/auth';
import { moneyDecimal } from '../core/money';
import { jobScheduleFromEnv } from '../jobs/jobs.service';
import { toPlain } from '../core/plain';
import { PrismaService } from '../core/prisma.service';

const REVIEW_LOAD_CAP = 30;
const OPEN_REVIEW_STATUSES = ['PENDING_REVIEW', 'IN_REVIEW'] as const;

const planInclude = {
  drama: { select: { id: true, code: true, title: true, titleEn: true, companyId: true } },
  company: { select: { id: true, name: true, ownerId: true, bdId: true } },
  platforms: { include: { platform: true }, orderBy: { platform: { sort: 'asc' as const } } },
  shares: true,
} satisfies Prisma.DistributionPlanInclude;

@Injectable()
export class DistributionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createPlan(user: AuthUser, input: { dramaId: string; round: 'FIRST' | 'SECOND'; platformIds?: string[]; customPlatforms?: string[]; idempotencyKey?: string }) {
    if (user.role !== 'CLIENT' || !user.companyId) throw new ForbiddenException('只有客户可以申请发行');
    return this.prisma.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const key = `${user.id}:${input.idempotencyKey}`;
        const hit = await tx.idempotencyKey.findUnique({ where: { id: key } });
        if (hit) return hit.body;
      }
      const drama = assertFound(
        await tx.drama.findFirst({
          where: { id: input.dramaId, companyId: user.companyId! },
          include: { episodes: true, assets: true, company: true },
        }),
        '剧目不存在',
      );
      const licenseAssets = drama.assets.filter((asset) => asset.type === 'LICENSE' || asset.type === 'COPYRIGHT');
      if (!licenseAssets.some((asset) => asset.reviewStatus === 'APPROVED')) {
        throw new BadRequestException('授权书/版权证明须经运营审核通过后才能申请发行');
      }
      const problems: string[] = [];
      const readyEpisodes = drama.episodes.filter((episode) => episode.fileKey);
      if (!readyEpisodes.length) problems.push('还没有上传成片');
      const blocking = await tx.distributionPlan.findFirst({
        where: { dramaId: drama.id, round: input.round, status: { in: BLOCKING_PLAN_STATUSES } },
      });
      if (blocking) problems.push(`已有进行中的${input.round === 'FIRST' ? '首发' : '二轮'}申请`);

      const targets = await this.resolvePlatforms(tx, input);
      if (problems.length) {
        return { id: '', status: 'PRECHECK_FAILED' as const, precheckNote: problems.join('；'), drama: { id: drama.id, title: drama.title, code: drama.code } };
      }

      const allApproved = readyEpisodes.length > 0 && readyEpisodes.every((episode) => episode.reviewStatus === 'APPROVED');
      const skipReview = input.round === 'SECOND' && allApproved;
      const priorDramas = await tx.distributionPlan.count({
        where: { companyId: drama.companyId, status: { not: 'PRECHECK_FAILED' } },
      });
      const fullReview = priorDramas === 0;
      const assigneeId = skipReview ? drama.company.ownerId : await this.pickAssignee(tx, drama.company);
      const status: 'SHARE_CONFIG' | 'PENDING_REVIEW' | 'PENDING_ASSIGN' = skipReview ? 'SHARE_CONFIG' : assigneeId ? 'PENDING_REVIEW' : 'PENDING_ASSIGN';
      if (!skipReview) {
        const pool = readyEpisodes.filter((episode) => episode.reviewStatus !== 'APPROVED');
        const sampledSet = fullReview
          ? new Set(pool.map((episode) => episode.no))
          : new Set(sampleEpisodeNos(pool.map((episode) => episode.no)).sampled);
        for (const episode of pool) {
          await tx.episode.update({
            where: { id: episode.id },
            data: { reviewStatus: sampledSet.has(episode.no) ? 'PENDING' : 'UNSAMPLED', rejectReason: null },
          });
        }
      }
      const plan = await tx.distributionPlan.create({
        data: {
          code: await nextCode(tx, 'PL'),
          dramaId: drama.id,
          companyId: drama.companyId,
          round: input.round,
          status,
          assigneeId,
          slaDueAt: assigneeId ? addBusinessDays(new Date(), status === 'SHARE_CONFIG' ? 1 : 2) : null,
          platforms: {
            create: targets.map((platform) => ({
              platformId: platform.id,
              platformName: platform.name,
            })),
          },
        },
      });
      await this.audit.write(user.id, 'plan.create', 'DistributionPlan', plan.id, { round: input.round, status, assigneeId, fullReview });
      const body = await this.present(tx, plan.id, user);
      await this.saveIdem(tx, user.id, input.idempotencyKey, body);
      return body;
    });
  }

  async createPlans(user: AuthUser, input: { dramaIds: string[]; round: 'FIRST' | 'SECOND'; platformIds?: string[]; customPlatforms?: string[] }) {
    if (user.role !== 'CLIENT' || !user.companyId) throw new ForbiddenException('只有客户可以申请发行');
    if (input.dramaIds.length > 200) throw new BadRequestException('单次最多申请 200 部');
    const submitted = [];
    const needsAction: { dramaId: string; title: string; reason: string; href: string }[] = [];
    for (const dramaId of input.dramaIds) {
      try {
        const body = await this.createPlan(user, { dramaId, round: input.round, platformIds: input.platformIds, customPlatforms: input.customPlatforms }) as { status?: string; precheckNote?: string | null; drama?: { title?: string } | null } | null;
        if (body?.status === 'PRECHECK_FAILED') {
          needsAction.push({ dramaId, title: body.drama?.title || '', reason: body.precheckNote || '预检未通过', href: `/dramas/${dramaId}` });
        } else submitted.push(body);
      } catch (error) {
        if (!(error instanceof BadRequestException) && !(error instanceof ForbiddenException)) throw error;
        needsAction.push({ dramaId, title: '', reason: error.message, href: `/dramas/${dramaId}` });
      }
    }
    return { submittedCount: submitted.length, needsActionCount: needsAction.length, submitted, needsAction };
  }

  async listPlans(user: AuthUser, query: { page: number; pageSize: number; status?: string; companyId?: string }) {
    const where: Prisma.DistributionPlanWhereInput = {};
    if (user.role === 'CLIENT') where.companyId = user.companyId!;
    else if (user.role === 'OPS') where.OR = [{ assigneeId: user.id }, { company: { ownerId: user.id } }];
    else if (user.role === 'BD') where.company = { bdId: user.id };
    else if (user.role === 'FINANCE') where.status = 'SHARE_REVIEW';
    if (query.status) where.status = query.status as never;
    if (query.companyId && user.role !== 'CLIENT') where.companyId = query.companyId;
    const [rows, total] = await Promise.all([
      this.prisma.distributionPlan.findMany({
        where,
        include: planInclude,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.distributionPlan.count({ where }),
    ]);
    return { items: rows.map((row) => this.shape(row, user)), total, page: query.page, pageSize: query.pageSize };
  }

  async getPlan(user: AuthUser, id: string) {
    const plan = await this.must(user, id);
    const episodes = await this.prisma.episode.findMany({ where: { dramaId: plan.dramaId }, orderBy: { no: 'asc' } });
    return { ...this.shape(plan, user), episodes };
  }

  async withdraw(user: AuthUser, id: string) {
    const plan = await this.must(user, id);
    if (user.role !== 'CLIENT') throw new ForbiddenException('只有客户可以撤回');
    if (!['PENDING_ASSIGN', 'PENDING_REVIEW'].includes(plan.status)) throw new BadRequestException('审核开始后不能撤回');
    await this.prisma.distributionPlan.update({ where: { id }, data: { status: 'WITHDRAWN' } });
    await this.audit.write(user.id, 'plan.withdraw', 'DistributionPlan', id);
    return this.getPlan(user, id);
  }

  async openReview(user: AuthUser, id: string) {
    const plan = await this.must(user, id);
    this.assertReviewer(user, plan);
    if (!['PENDING_ASSIGN', 'PENDING_REVIEW'].includes(plan.status)) return this.getPlan(user, id);
    await this.prisma.distributionPlan.update({
      where: { id },
      data: { status: 'IN_REVIEW', assigneeId: plan.assigneeId ?? user.id },
    });
    await this.audit.write(user.id, 'review.open', 'DistributionPlan', id);
    return this.getPlan(user, id);
  }

  async decideEpisode(user: AuthUser, planId: string, episodeId: string, input: { decision: 'APPROVED' | 'REJECTED'; reason?: string }) {
    const plan = await this.must(user, planId);
    this.assertReviewer(user, plan);
    if (plan.status !== 'IN_REVIEW') throw new BadRequestException('请先打开审核');
    const episode = assertFound(await this.prisma.episode.findFirst({ where: { id: episodeId, dramaId: plan.dramaId } }), '分集不存在');
    if (!['PENDING', 'REPLACED'].includes(episode.reviewStatus)) throw new BadRequestException('这一集不在待审范围');
    if (input.decision === 'REJECTED' && !input.reason) throw new BadRequestException('驳回时请填写原因');
    await this.prisma.$transaction([
      this.prisma.episode.update({
        where: { id: episode.id },
        data: { reviewStatus: input.decision, rejectReason: input.decision === 'REJECTED' ? input.reason : null },
      }),
      this.prisma.reviewLog.create({
        data: { planId, episodeId: episode.id, episodeNo: episode.no, action: input.decision, reason: input.reason, actorId: user.id },
      }),
    ]);
    return this.getPlan(user, planId);
  }

  async assign(user: AuthUser, planId: string, assigneeId: string) {
    assertBusinessWrite(user);
    assertRole(user, ['OPS_MANAGER'], '分派由运营主管处理');
    const plan = await this.must(user, planId);
    if (!['PENDING_ASSIGN', 'PENDING_REVIEW', 'IN_REVIEW', 'NEEDS_REVISION'].includes(plan.status)) {
      throw new BadRequestException('当前状态不能改派');
    }
    const assignee = assertFound(await this.prisma.user.findUnique({ where: { id: assigneeId } }), '运营不存在');
    if (assignee.role !== 'OPS' || assignee.disabled) throw new BadRequestException('只能分派给在岗运营专员');
    const status = plan.status === 'PENDING_ASSIGN' ? 'PENDING_REVIEW' : plan.status;
    await this.prisma.distributionPlan.update({
      where: { id: planId },
      data: { assigneeId, status, slaDueAt: plan.slaDueAt ?? addBusinessDays(new Date(), 2) },
    });
    await this.audit.write(user.id, 'review.assign', 'DistributionPlan', planId, { assigneeId });
    return this.getPlan(user, planId);
  }

  async reassign(user: AuthUser, planId: string, input: { assigneeId: string; reason?: string }) {
    assertBusinessWrite(user);
    assertRole(user, ['OPS_MANAGER'], '改派由运营主管处理');
    const plan = await this.must(user, planId);
    const updated = await this.assign(user, planId, input.assigneeId);
    await this.audit.write(user.id, 'review.reassign', 'DistributionPlan', planId, { from: plan.assigneeId, to: input.assigneeId, reason: input.reason ?? '' });
    return updated;
  }

  async spotCheck(user: AuthUser, input: { ratio: number; results?: { planId: string; result: 'PASS' | 'FAIL' | 'NOTE'; note?: string }[] }) {
    assertBusinessWrite(user);
    assertRole(user, ['OPS_MANAGER'], '抽检由运营主管处理');
    if (input.results?.length) {
      const created = [];
      for (const item of input.results) {
        assertFound(await this.prisma.distributionPlan.findUnique({ where: { id: item.planId } }), '工单不存在');
        created.push(await this.prisma.reviewSpotCheck.create({
          data: { planId: item.planId, checkedById: user.id, result: item.result, note: item.note ?? '' },
        }));
      }
      await this.audit.write(user.id, 'review.spot_check', 'ReviewSpotCheck', created.map((row) => row.id).join(','), { count: created.length });
      return { ok: true, recorded: created.length, items: created };
    }
    const pool = await this.prisma.distributionPlan.findMany({
      where: { status: { in: ['SHARE_CONFIG', 'APPROVED', 'DISTRIBUTING', 'LIVE'] } },
      select: { id: true, code: true, status: true, assigneeId: true, company: { select: { id: true, name: true } }, drama: { select: { id: true, title: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    const checked = new Set((await this.prisma.reviewSpotCheck.findMany({ where: { planId: { in: pool.map((row) => row.id) } }, select: { planId: true } })).map((row) => row.planId));
    const candidates = pool.filter((row) => !checked.has(row.id));
    const count = candidates.length ? Math.max(1, Math.min(candidates.length, Math.ceil(candidates.length * input.ratio))) : 0;
    const items = candidates.slice(0, count);
    await this.audit.write(user.id, 'review.spot_check', 'DistributionPlan', items.map((row) => row.id).join(','), { ratio: input.ratio, sampled: items.length });
    return { ok: true, poolSize: pool.length, sampledCount: items.length, ratio: input.ratio, items };
  }

  async expand(user: AuthUser, planId: string) {
    assertBusinessWrite(user);
    assertRole(user, ['OPS_MANAGER'], '扩大抽检由运营主管处理');
    const plan = await this.must(user, planId);
    if (plan.status !== 'IN_REVIEW') throw new BadRequestException('只有审核中的申请可以扩大抽检');
    await this.prisma.episode.updateMany({ where: { dramaId: plan.dramaId, reviewStatus: 'UNSAMPLED' }, data: { reviewStatus: 'PENDING' } });
    await this.audit.write(user.id, 'review.expand', 'DistributionPlan', planId);
    return this.getPlan(user, planId);
  }

  async finish(user: AuthUser, planId: string) {
    const plan = await this.must(user, planId);
    this.assertReviewer(user, plan);
    if (plan.status !== 'IN_REVIEW') throw new BadRequestException('当前不能提交审核结果');
    const episodes = await this.prisma.episode.findMany({ where: { dramaId: plan.dramaId, reviewStatus: { not: 'UNSAMPLED' } } });
    if (episodes.some((episode) => episode.reviewStatus === 'PENDING' || episode.reviewStatus === 'REPLACED')) {
      throw new BadRequestException('还有未审的集');
    }
    const rejected = episodes.filter((episode) => episode.reviewStatus === 'REJECTED');
    if (rejected.length) {
      const summary = rejected.map((episode) => `第 ${episode.no} 集：${episode.rejectReason || '需修改'}`).join('\n');
      await this.prisma.distributionPlan.update({ where: { id: planId }, data: { status: 'NEEDS_REVISION', rejectSummary: summary } });
      await this.openTicket(plan, '审核还需要修改', summary, user.id);
    } else {
      await this.prisma.distributionPlan.update({ where: { id: planId }, data: { status: 'SHARE_CONFIG', slaDueAt: addBusinessDays(new Date(), 1) } });
    }
    await this.audit.write(user.id, rejected.length ? 'review.reject' : 'review.pass', 'DistributionPlan', planId);
    return this.getPlan(user, planId);
  }

  async resubmit(user: AuthUser, planId: string) {
    const plan = await this.must(user, planId);
    if (user.role !== 'CLIENT') throw new ForbiddenException('只有客户可以重新提交');
    if (plan.status !== 'NEEDS_REVISION') throw new BadRequestException('当前不需要重新提交');
    const rejected = await this.prisma.episode.count({ where: { dramaId: plan.dramaId, reviewStatus: 'REJECTED' } });
    if (rejected) throw new BadRequestException('请先替换被驳回的集，再重新提交');
    await this.prisma.episode.updateMany({ where: { dramaId: plan.dramaId, reviewStatus: 'REPLACED' }, data: { reviewStatus: 'PENDING' } });
    await this.prisma.distributionPlan.update({
      where: { id: planId },
      data: { status: 'IN_REVIEW', resubmitCount: { increment: 1 }, slaDueAt: addBusinessDays(new Date(), 1), rejectSummary: null },
    });
    await this.audit.write(user.id, 'plan.resubmit', 'DistributionPlan', planId);
    return this.getPlan(user, planId);
  }

  async putShares(user: AuthUser, planId: string, items: { platformId: string; mode: 'MG' | 'MG_OVER' | 'NO_MG'; clientRate: string; overRate?: string; guaranteeAmount?: string; guaranteeCurrency?: string; guaranteePeriodDays?: number }[]) {
    const plan = await this.must(user, planId);
    this.assertReviewer(user, plan);
    if (!['SHARE_CONFIG', 'SHARE_REVIEW'].includes(plan.status)) throw new BadRequestException('现在还不能配置分成');
    const required = new Set(plan.platforms.map((item) => item.platformId));
    if (items.length !== required.size || items.some((item) => !required.has(item.platformId))) {
      throw new BadRequestException('需要为每个目标平台填写分成');
    }
    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        if ((item.mode === 'MG' || item.mode === 'MG_OVER') && !item.guaranteeAmount) throw new BadRequestException('保底和超保底需要填写保底金额');
        if (item.mode === 'MG_OVER' && !item.overRate) throw new BadRequestException('超保底需要填写超出部分的分成比例');
        const rate = new Prisma.Decimal(item.clientRate);
        if (rate.lessThan(0) || rate.greaterThan(100)) throw new BadRequestException('分成比例需在 0 到 100 之间');
        await tx.shareConfig.upsert({
          where: { planId_platformId: { planId, platformId: item.platformId } },
          create: {
            planId,
            platformId: item.platformId,
            mode: item.mode,
            clientRate: rate,
            overRate: item.overRate ? new Prisma.Decimal(item.overRate) : null,
            guaranteeAmount: item.mode === 'NO_MG' ? null : moneyDecimal(item.guaranteeAmount!),
            guaranteeCurrency: item.mode === 'NO_MG' ? null : item.guaranteeCurrency || 'CNY',
            guaranteePeriodDays: item.mode === 'NO_MG' ? null : item.guaranteePeriodDays,
            reviewStatus: 'PENDING',
            submittedById: user.id,
          },
          update: {
            mode: item.mode,
            clientRate: rate,
            overRate: item.overRate ? new Prisma.Decimal(item.overRate) : null,
            guaranteeAmount: item.mode === 'NO_MG' ? null : moneyDecimal(item.guaranteeAmount!),
            guaranteeCurrency: item.mode === 'NO_MG' ? null : item.guaranteeCurrency || 'CNY',
            guaranteePeriodDays: item.mode === 'NO_MG' ? null : item.guaranteePeriodDays,
            reviewStatus: 'PENDING',
            submittedById: user.id,
            reviewedById: null,
            reviewNote: null,
          },
        });
      }
      await tx.distributionPlan.update({ where: { id: planId }, data: { status: 'SHARE_REVIEW' } });
    });
    await this.audit.write(user.id, 'share.submit', 'DistributionPlan', planId);
    return this.getPlan(user, planId);
  }

  async reviewShares(user: AuthUser, planId: string, input: { pass: boolean; reason?: string }) {
    assertBusinessWrite(user);
    assertRole(user, ['OPS_MANAGER'], '分成由运营主管复核');
    const plan = await this.must(user, planId);
    if (plan.status !== 'SHARE_REVIEW') throw new BadRequestException('当前没有待复核的分成');
    if (plan.shares.some((share) => share.submittedById === user.id)) throw new ForbiddenException('不能复核自己提交的分成');
    if (!input.pass && !input.reason) throw new BadRequestException('退回时请填写原因');
    await this.prisma.$transaction(async (tx) => {
      await tx.shareConfig.updateMany({
        where: { planId },
        data: { reviewStatus: input.pass ? 'APPROVED' : 'REJECTED', reviewedById: user.id, reviewNote: input.reason },
      });
      await tx.distributionPlan.update({ where: { id: planId }, data: { status: input.pass ? 'APPROVED' : 'SHARE_CONFIG' } });
    });
    if (input.pass) {
      const lines = plan.platforms.map((item) => {
        const share = plan.shares.find((row) => row.platformId === item.platformId);
        const rate = share ? `分成比例 ${share.clientRate.toString()}%` : '分成比例待确认';
        const over = share?.overRate ? `，超出约定后 ${share.overRate.toString()}%` : '';
        return `${item.platformName}：${rate}${over}`;
      });
      await this.openTicket(plan, '审核已通过', `可以准备上架。\n${lines.join('\n')}`, user.id);
    }
    await this.audit.write(user.id, input.pass ? 'share.approve' : 'share.reject', 'DistributionPlan', planId);
    return this.getPlan(user, planId);
  }

  async patchListing(user: AuthUser, listingId: string, input: { status: string; platformDramaId?: string; listingUrl?: string; listedAt?: string }) {
    assertBusinessWrite(user);
    assertRole(user, ['BD', 'OPS', 'OPS_MANAGER']);
    const listing = assertFound(
      await this.prisma.planPlatform.findUnique({ where: { id: listingId }, include: { plan: { include: { company: true, platforms: true } } } }),
      '发行记录不存在',
    );
    if (user.role === 'OPS' || user.role === 'BD') assertCompanyAccess(user, listing.plan.company);
    if (!['APPROVED', 'DISTRIBUTING', 'LIVE', 'OFFLINE'].includes(listing.plan.status)) {
      throw new BadRequestException('审核通过后才能录入上架结果');
    }
    await this.prisma.planPlatform.update({
      where: { id: listingId },
      data: {
        listingStatus: input.status as never,
        platformDramaId: input.platformDramaId,
        listingUrl: input.listingUrl,
        listedAt: input.listedAt ? day(input.listedAt) : input.status === 'LISTED' ? new Date() : undefined,
      },
    });
    const all = await this.prisma.planPlatform.findMany({ where: { planId: listing.planId } });
    const anyListed = all.some((item) => item.listingStatus === 'LISTED');
    const allClosed = all.every((item) => item.listingStatus === 'DELISTED' || item.listingStatus === 'REJECTED_BY_PLATFORM');
    let status = listing.plan.status;
    if (anyListed) status = 'LIVE';
    else if (allClosed) status = 'OFFLINE';
    else if (status === 'APPROVED') status = 'DISTRIBUTING';
    if (status !== listing.plan.status) await this.prisma.distributionPlan.update({ where: { id: listing.planId }, data: { status } });
    await this.audit.write(user.id, 'listing.update', 'PlanPlatform', listingId, { status: input.status });
    return this.getPlan(user, listing.planId);
  }

  async batchPass(user: AuthUser, planIds: string[]) {
    assertBusinessWrite(user);
    assertRole(user, ['OPS', 'OPS_MANAGER']);
    const passed: { id: string; code: string }[] = [];
    const skipped: { id: string; code: string; reason: string }[] = [];
    for (const planId of planIds) {
      const plan = await this.prisma.distributionPlan.findUnique({ where: { id: planId }, include: planInclude });
      if (!plan) {
        skipped.push({ id: planId, code: '', reason: '工单不存在' });
        continue;
      }
      if (user.role === 'OPS' && plan.assigneeId !== user.id) {
        try {
          assertCompanyAccess(user, plan.company);
        } catch {
          skipped.push({ id: plan.id, code: plan.code, reason: '不在你的队列' });
          continue;
        }
      }
      if (plan.status !== 'IN_REVIEW') {
        skipped.push({ id: plan.id, code: plan.code, reason: '抽检未完成' });
        continue;
      }
      const episodes = await this.prisma.episode.findMany({ where: { dramaId: plan.dramaId, reviewStatus: { not: 'UNSAMPLED' } } });
      if (episodes.some((episode) => episode.reviewStatus === 'PENDING' || episode.reviewStatus === 'REPLACED')) {
        skipped.push({ id: plan.id, code: plan.code, reason: '抽检未完成' });
        continue;
      }
      if (episodes.some((episode) => episode.reviewStatus === 'REJECTED')) {
        skipped.push({ id: plan.id, code: plan.code, reason: '有问题集，已跳过' });
        continue;
      }
      await this.prisma.distributionPlan.update({ where: { id: plan.id }, data: { status: 'SHARE_CONFIG', slaDueAt: addBusinessDays(new Date(), 1) } });
      await this.audit.write(user.id, 'review.batch_pass', 'DistributionPlan', plan.id);
      passed.push({ id: plan.id, code: plan.code });
    }
    return { passed, skipped, passedCount: passed.length, skippedCount: skipped.length };
  }

  listTemplates() {
    return this.prisma.shareTemplate.findMany({ orderBy: [{ name: 'asc' }, { version: 'desc' }] });
  }

  async createTemplate(user: AuthUser, input: { name: string; mode: 'MG' | 'MG_OVER' | 'NO_MG'; clientRate: string; overRate?: string; guaranteeAmount?: string; guaranteeCurrency?: string; guaranteePeriodDays?: number; note?: string }) {
    assertBusinessWrite(user);
    assertRole(user, ['OPS', 'OPS_MANAGER']);
    if ((input.mode === 'MG' || input.mode === 'MG_OVER') && !input.guaranteeAmount) throw new BadRequestException('保底和超保底需要填写保底金额');
    if (input.mode === 'MG_OVER' && !input.overRate) throw new BadRequestException('超保底需要填写超出部分的分成比例');
    const last = await this.prisma.shareTemplate.aggregate({ where: { name: input.name }, _max: { version: true } });
    return this.prisma.shareTemplate.create({
      data: {
        name: input.name,
        version: (last._max.version ?? 0) + 1,
        note: input.note ?? '',
        mode: input.mode,
        clientRate: new Prisma.Decimal(input.clientRate),
        overRate: input.overRate ? new Prisma.Decimal(input.overRate) : null,
        guaranteeAmount: input.mode === 'NO_MG' ? null : moneyDecimal(input.guaranteeAmount!),
        guaranteeCurrency: input.mode === 'NO_MG' ? null : input.guaranteeCurrency || 'CNY',
        guaranteePeriodDays: input.mode === 'NO_MG' ? null : input.guaranteePeriodDays,
        createdById: user.id,
      },
    });
  }

  async previewTemplate(user: AuthUser, templateId: string, planIds: string[]) {
    assertBusinessWrite(user);
    assertRole(user, ['OPS', 'OPS_MANAGER']);
    const template = assertFound(await this.prisma.shareTemplate.findUnique({ where: { id: templateId } }), '分成模板不存在');
    const items = [];
    for (const planId of planIds) {
      items.push(await this.classifyTemplate(user, planId));
    }
    return {
      template: { id: template.id, name: template.name, version: template.version },
      items,
      summary: {
        created: items.filter((item) => item.kind === 'NEW').length,
        overwrite: items.filter((item) => item.kind === 'OVERWRITE').length,
        skip: items.filter((item) => item.kind === 'SKIP').length,
      },
    };
  }

  async applyTemplate(user: AuthUser, templateId: string, planIds: string[]) {
    const preview = await this.previewTemplate(user, templateId, planIds);
    const template = assertFound(await this.prisma.shareTemplate.findUnique({ where: { id: templateId } }), '分成模板不存在');
    const applied: string[] = [];
    for (const item of preview.items) {
      if (item.kind === 'SKIP') continue;
      const plan = assertFound(await this.prisma.distributionPlan.findUnique({ where: { id: item.planId }, include: { platforms: true } }), '工单不存在');
      await this.prisma.$transaction(async (tx) => {
        for (const platform of plan.platforms) {
          await tx.shareConfig.upsert({
            where: { planId_platformId: { planId: plan.id, platformId: platform.platformId } },
            create: {
              planId: plan.id,
              platformId: platform.platformId,
              mode: template.mode,
              clientRate: template.clientRate,
              overRate: template.overRate,
              guaranteeAmount: template.guaranteeAmount,
              guaranteeCurrency: template.guaranteeCurrency,
              guaranteePeriodDays: template.guaranteePeriodDays,
              reviewStatus: 'PENDING',
              submittedById: user.id,
            },
            update: {
              mode: template.mode,
              clientRate: template.clientRate,
              overRate: template.overRate,
              guaranteeAmount: template.guaranteeAmount,
              guaranteeCurrency: template.guaranteeCurrency,
              guaranteePeriodDays: template.guaranteePeriodDays,
              reviewStatus: 'PENDING',
              submittedById: user.id,
              reviewedById: null,
              reviewNote: null,
            },
          });
        }
        await tx.distributionPlan.update({ where: { id: plan.id }, data: { status: 'SHARE_REVIEW' } });
      });
      applied.push(plan.id);
    }
    await this.audit.write(user.id, 'share.template.apply', 'ShareTemplate', template.id, { applied: applied.length, skipped: preview.summary.skip });
    return { ...preview, appliedCount: applied.length, status: 'SHARE_REVIEW' };
  }

  async listingTemplate() {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet('上架结果');
    sheet.addRow(['剧ID', '平台', '平台剧ID', '上架时间', '链接']);
    sheet.addRow(['D00001', 'ReelShort', 'RS-10001', '2026-10-21', 'https://example.com/drama']);
    return Buffer.from(await book.xlsx.writeBuffer());
  }

  async importListings(user: AuthUser, file: Buffer) {
    assertBusinessWrite(user);
    assertRole(user, ['BD', 'OPS', 'OPS_MANAGER']);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(file as unknown as ExcelJS.Buffer);
    const sheet = book.worksheets[0];
    if (!sheet) throw new BadRequestException('工作表为空');
    const rows: { rowNo: number; ok: boolean; error: string; dramaCode: string; platformName: string }[] = [];
    for (let rowNo = 2; rowNo <= sheet.rowCount; rowNo += 1) {
      const row = sheet.getRow(rowNo);
      const dramaToken = cellText(row.getCell(1).value);
      const platformName = cellText(row.getCell(2).value);
      const platformDramaId = cellText(row.getCell(3).value);
      const listedAt = cellText(row.getCell(4).value);
      const listingUrl = cellText(row.getCell(5).value);
      if (!dramaToken && !platformName && !platformDramaId) continue;
      const fail = (error: string) => rows.push({ rowNo, ok: false, error, dramaCode: dramaToken, platformName });
      if (!dramaToken || !platformName || !platformDramaId || !listedAt || !listingUrl) {
        fail('剧 ID、平台、平台剧 ID、上架时间、链接都要填');
        continue;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(listedAt)) {
        fail(`第 ${rowNo} 行上架时间格式应为 YYYY-MM-DD`);
        continue;
      }
      const drama = await this.prisma.drama.findFirst({ where: { OR: [{ id: dramaToken }, { code: dramaToken }] } });
      if (!drama) {
        fail(`第 ${rowNo} 行剧不存在`);
        continue;
      }
      const platform = await this.prisma.platform.findFirst({ where: { OR: [{ name: platformName }, { code: platformName }] } });
      if (!platform) {
        fail(`第 ${rowNo} 行平台不存在`);
        continue;
      }
      const listing = await this.prisma.planPlatform.findFirst({
        where: { platformId: platform.id, plan: { dramaId: drama.id, status: { in: ['APPROVED', 'DISTRIBUTING', 'LIVE', 'OFFLINE'] } } },
        orderBy: { plan: { updatedAt: 'desc' } },
      });
      if (!listing) {
        fail(`第 ${rowNo} 行没有可录入的上架记录`);
        continue;
      }
      try {
        await this.patchListing(user, listing.id, { status: 'LISTED', platformDramaId, listingUrl, listedAt });
        rows.push({ rowNo, ok: true, error: '', dramaCode: drama.code, platformName: platform.name });
      } catch (error) {
        fail(error instanceof Error ? error.message : `第 ${rowNo} 行没有录入`);
      }
    }
    if (!rows.length) throw new BadRequestException('没有读到上架结果');
    return { rows, applied: rows.filter((row) => row.ok).length, failed: rows.filter((row) => !row.ok).length };
  }

  private async classifyTemplate(user: AuthUser, planId: string) {
    const plan = await this.prisma.distributionPlan.findUnique({ where: { id: planId }, include: { shares: true, drama: { select: { title: true } }, company: true } });
    if (!plan) return { planId, code: '', title: '', kind: 'SKIP' as const, reason: '工单不存在' };
    if (user.role === 'OPS' && plan.assigneeId !== user.id) {
      try {
        assertCompanyAccess(user, plan.company);
      } catch {
        return { planId, code: plan.code, title: plan.drama.title, kind: 'SKIP' as const, reason: '不在你的队列' };
      }
    }
    if (!['SHARE_CONFIG', 'SHARE_REVIEW'].includes(plan.status)) {
      return { planId, code: plan.code, title: plan.drama.title, kind: 'SKIP' as const, reason: '当前状态不能套用分成' };
    }
    return { planId, code: plan.code, title: plan.drama.title, kind: plan.shares.length ? 'OVERWRITE' as const : 'NEW' as const, reason: '' };
  }

  private async resolvePlatforms(tx: Prisma.TransactionClient, input: { round: 'FIRST' | 'SECOND'; platformIds?: string[]; customPlatforms?: string[] }) {
    if (input.round === 'FIRST') {
      const required = await tx.platform.findMany({ where: { firstBatch: true, enabled: true }, orderBy: { sort: 'asc' } });
      if (!required.length) throw new BadRequestException('首发平台名单还没有配置');
      if (input.platformIds?.length) {
        const wanted = [...input.platformIds].sort().join(',');
        const fixed = required.map((item) => item.id).sort().join(',');
        if (wanted !== fixed) throw new BadRequestException('首发平台为固定名单，不可删除或更换');
      }
      if (input.customPlatforms?.length) throw new BadRequestException('首发不能改成其他平台');
      return required;
    }
    const ids = input.platformIds ?? [];
    const names = input.customPlatforms ?? [];
    if (!ids.length && !names.length) throw new BadRequestException('请填写二轮要去的平台');
    const found = ids.length ? await tx.platform.findMany({ where: { id: { in: ids }, enabled: true } }) : [];
    if (found.length !== ids.length) throw new BadRequestException('有平台不存在或已停用');
    const created = [];
    for (const name of names) {
      const hit = await tx.platform.findUnique({ where: { name } });
      if (hit) {
        created.push(hit);
        continue;
      }
      created.push(
        await tx.platform.create({
          data: { code: await nextCode(tx, 'PF', 3), name, proposed: true, enabled: true, firstBatch: false, syncMode: 'MANUAL', syncLag: 'T1' },
        }),
      );
    }
    const map = new Map([...found, ...created].map((item) => [item.id, item]));
    return [...map.values()];
  }

  private async must(user: AuthUser, id: string) {
    const plan = assertFound(await this.prisma.distributionPlan.findUnique({ where: { id }, include: planInclude }), '发行申请不存在');
    if (user.role === 'OPS' && plan.assigneeId === user.id) return plan;
    if (user.role === 'CLIENT' || user.role === 'OPS' || user.role === 'BD') assertCompanyAccess(user, plan.company);
    return plan;
  }

  /** 责任运营未满则分给本人；没有责任运营时分给在审量最少且未满 30 的专员。 */
  private async pickAssignee(tx: Prisma.TransactionClient, company: { ownerId: string | null }) {
    const open = await tx.distributionPlan.groupBy({
      by: ['assigneeId'],
      where: { status: { in: [...OPEN_REVIEW_STATUSES] }, assigneeId: { not: null } },
      _count: { _all: true },
    });
    const loadOf = (id: string) => open.find((row) => row.assigneeId === id)?._count._all ?? 0;
    if (company.ownerId) {
      const owner = await tx.user.findUnique({ where: { id: company.ownerId } });
      if (owner?.role === 'OPS' && !owner.disabled) return loadOf(owner.id) < REVIEW_LOAD_CAP ? owner.id : null;
    }
    const specialists = await tx.user.findMany({ where: { role: 'OPS', disabled: false }, select: { id: true } });
    const choice = specialists
      .map((row) => ({ id: row.id, load: loadOf(row.id) }))
      .filter((row) => row.load < REVIEW_LOAD_CAP)
      .sort((a, b) => a.load - b.load || a.id.localeCompare(b.id))[0];
    return choice?.id ?? null;
  }

  async slaBoard(user: AuthUser) {
    assertRole(user, ['OPS', 'OPS_MANAGER', 'ADMIN']);
    const limits = jobScheduleFromEnv();
    const where: Prisma.DistributionPlanWhereInput = {
      status: { in: ['PENDING_ASSIGN', 'PENDING_REVIEW', 'IN_REVIEW', 'SHARE_CONFIG', 'SHARE_REVIEW'] },
      slaDueAt: { not: null },
    };
    if (user.role === 'OPS') where.assigneeId = user.id;
    const plans = await this.prisma.distributionPlan.findMany({
      where,
      include: {
        company: { select: { id: true, name: true } },
        drama: { select: { id: true, title: true, code: true } },
      },
      orderBy: { slaDueAt: 'asc' },
    });
    const now = Date.now();
    const items = plans.map((plan) => {
      const tier = slaTier(plan.submittedAt, plan.slaDueAt, now, limits.slaWarnRatio, limits.slaDoubleRatio);
      return {
        id: plan.id,
        code: plan.code,
        status: plan.status,
        assigneeId: plan.assigneeId,
        company: plan.company,
        drama: plan.drama,
        submittedAt: plan.submittedAt,
        slaDueAt: plan.slaDueAt,
        elapsedRatio: tier.ratio,
        tier: tier.tier,
        tierLabel: tier.label,
      };
    });
    const byAssignee = new Map<string, { assigneeId: string | null; total: number; warn80: number; overdue: number; double: number }>();
    for (const item of items) {
      const key = item.assigneeId ?? '_unassigned';
      const row = byAssignee.get(key) ?? { assigneeId: item.assigneeId, total: 0, warn80: 0, overdue: 0, double: 0 };
      row.total += 1;
      if (item.tier === 'warn80') row.warn80 += 1;
      if (item.tier === 'overdue') row.overdue += 1;
      if (item.tier === 'double') row.double += 1;
      byAssignee.set(key, row);
    }
    return {
      summary: {
        total: items.length,
        ok: items.filter((item) => item.tier === 'ok').length,
        warn80: items.filter((item) => item.tier === 'warn80').length,
        overdue: items.filter((item) => item.tier === 'overdue').length,
        double: items.filter((item) => item.tier === 'double').length,
      },
      warnRatio: limits.slaWarnRatio,
      doubleRatio: limits.slaDoubleRatio,
      byAssignee: [...byAssignee.values()],
      items,
    };
  }

  private assertReviewer(user: AuthUser, plan: { assigneeId: string | null; company: { id: string; ownerId: string | null } }) {
    assertBusinessWrite(user);
    if (user.role === 'OPS_MANAGER') return;
    if (user.role !== 'OPS') throw new ForbiddenException('只有负责运营可以审核');
    if (plan.assigneeId && plan.assigneeId === user.id) return;
    assertCompanyAccess(user, plan.company);
  }

  private async openTicket(plan: { id: string; companyId: string; dramaId: string; drama: { title: string } }, title: string, body: string, actorId: string) {
    const code = await this.prisma.$transaction(async (tx) => nextCode(tx, 'GD', 5));
    await this.prisma.ticket.create({
      data: {
        code,
        companyId: plan.companyId,
        type: 'REVIEW',
        status: 'PENDING_CLIENT',
        title: `《${plan.drama.title}》${title}`,
        body,
        dramaId: plan.dramaId,
        planId: plan.id,
        createdById: actorId,
      },
    });
  }

  private async present(tx: Prisma.TransactionClient, id: string, user: AuthUser) {
    const plan = assertFound(await tx.distributionPlan.findUnique({ where: { id }, include: planInclude }));
    return this.shape(plan, user);
  }

  private shape(plan: Prisma.DistributionPlanGetPayload<{ include: typeof planInclude }>, user: AuthUser) {
    const phase = clientPhaseFromPlans([plan.status]);
    return {
      ...plan,
      statusLabel: PLAN_STATUS_LABEL[plan.status],
      phase,
      phaseLabel: phase === 'review' ? '审核中' : phase === 'action' ? '需要你处理' : phase === 'ready' ? '准备上架' : phase === 'live' ? '已上架' : phase === 'offline' ? '已下架' : phase === 'withdrawn' ? '已撤回' : '未发行',
      expectedFinish: plan.slaDueAt && ['PENDING_ASSIGN', 'PENDING_REVIEW', 'IN_REVIEW', 'SHARE_CONFIG', 'SHARE_REVIEW', 'NEEDS_REVISION'].includes(plan.status) ? `预计 ${formatCnDate(plan.slaDueAt)} 前完成` : null,
      shares: hidesCommercialTerms(user.role) ? plan.shares.map((share) => shareDto(share as unknown as Record<string, unknown>)) : plan.shares,
    };
  }

  private async saveIdem(tx: Prisma.TransactionClient, userId: string, key: string | undefined, body: unknown) {
    if (!key) return;
    const plain = JSON.parse(JSON.stringify(toPlain(body))) as Prisma.InputJsonValue;
    await tx.idempotencyKey.upsert({
      where: { id: `${userId}:${key}` },
      create: { id: `${userId}:${key}`, userId, body: plain },
      update: { body: plain },
    });
  }
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object' && 'text' in value && value.text) return String(value.text).trim();
  if (typeof value === 'object' && 'result' in value) return cellText(value.result as ExcelJS.CellValue);
  return String(value).trim();
}

function slaTier(submittedAt: Date | null, slaDueAt: Date | null, now: number, warnRatio: number, doubleRatio: number) {
  if (!slaDueAt || !submittedAt) return { tier: 'ok' as const, label: '正常', ratio: 0 };
  const span = Math.max(slaDueAt.getTime() - submittedAt.getTime(), 1);
  const ratio = (now - submittedAt.getTime()) / span;
  if (ratio >= doubleRatio) return { tier: 'double' as const, label: '2倍超时', ratio };
  if (now >= slaDueAt.getTime()) return { tier: 'overdue' as const, label: '已超时', ratio };
  if (ratio >= warnRatio) return { tier: 'warn80' as const, label: '已用80%', ratio };
  return { tier: 'ok' as const, label: '正常', ratio };
}

export const planListSchema = pageSchema.extend({
  status: z.string().optional(),
  companyId: z.string().optional(),
});
