import { z } from 'zod';
import {
  CONTRACT_STATUSES,
  CYCLE_TYPES,
  DATA_SOURCES,
  DEAL_TYPES,
  LISTING_STATUSES,
  PLAN_ROUNDS,
  ROLES,
  SHARE_MODES,
  SYNC_LAGS,
  UPLOAD_PURPOSES,
} from './enums';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式应为 YYYY-MM-DD');
const decimalStr = z.string().regex(/^-?\d+(\.\d{1,6})?$/, '金额格式不正确');
const rateStr = z.string().regex(/^\d+(\.\d{1,4})?$/, '比例格式不正确');

export const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(8, '密码至少 8 位').max(72),
  name: z.string().trim().min(1).max(40),
  companyName: z.string().trim().min(2).max(80),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const certSchema = z.object({
  name: z.string().trim().min(2).max(80),
  creditCode: z.string().trim().regex(/^[0-9A-Z]{18}$/, '统一社会信用代码为 18 位'),
  legalPerson: z.string().trim().min(1).max(40),
  contactName: z.string().trim().min(1).max(40),
  contactPhone: z.string().trim().min(6).max(30),
  licenseKey: z.string().min(1).optional(),
});

export const certReviewSchema = z.object({
  pass: z.boolean(),
  reason: z.string().max(500).optional(),
});

export const bankAccountSchema = z.object({
  accountName: z.string().trim().min(2).max(80),
  bankName: z.string().trim().min(2).max(80),
  branch: z.string().trim().max(80).optional(),
  accountNo: z.string().trim().min(6).max(40),
  isDefault: z.boolean().optional(),
});

export const dramaCreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  titleEn: z.string().trim().max(160).optional(),
  synopsis: z.string().max(2000).optional(),
  genre: z.string().trim().max(40).optional(),
  language: z.string().trim().min(1).max(40).default('英语'),
  episodeCountExpected: z.number().int().min(1).max(500).optional(),
  tags: z.array(z.string().trim().min(1).max(20)).max(12).optional(),
  groups: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
});

export const dramaPatchSchema = dramaCreateSchema.partial();

export const dramaListSchema = pageSchema.extend({
  q: z.string().max(120).optional(),
  phase: z.enum(['action', 'review', 'ready', 'live', 'offline', 'withdrawn', 'idle']).optional(),
  genre: z.string().optional(),
  language: z.string().optional(),
  round: z.enum(PLAN_ROUNDS).optional(),
  platformId: z.string().optional(),
  companyId: z.string().optional(),
  sort: z.enum(['updatedAt', 'createdAt', 'title']).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const uploadInitSchema = z.object({
  filename: z.string().trim().min(1).max(240),
  contentType: z.string().trim().min(1).max(120).default('application/octet-stream'),
  size: z.number().int().positive().max(10 * 1024 * 1024 * 1024),
  purpose: z.enum(UPLOAD_PURPOSES),
  dramaId: z.string().optional(),
  companyId: z.string().optional(),
  episodeNo: z.number().int().positive().max(999).optional(),
  fingerprint: z.string().max(200).optional(),
});

export const partSignSchema = z.object({
  partNumber: z.number().int().min(1).max(10000),
});

export const partAckSchema = z.object({
  partNumber: z.number().int().min(1).max(10000),
  etag: z.string().min(1).max(200),
});

export const uploadCompleteSchema = z.object({
  parts: z.array(z.object({ partNumber: z.number().int(), etag: z.string() })).optional(),
});

export const planCreateSchema = z.object({
  dramaId: z.string().min(1),
  round: z.enum(PLAN_ROUNDS),
  platformIds: z.array(z.string()).optional(),
  customPlatforms: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  idempotencyKey: z.string().max(80).optional(),
});

export const episodeDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().trim().max(500).optional(),
});

export const shareItemSchema = z.object({
  platformId: z.string().min(1),
  mode: z.enum(SHARE_MODES),
  clientRate: rateStr,
  overRate: rateStr.optional(),
  guaranteeAmount: decimalStr.optional(),
  guaranteeCurrency: z.string().max(8).optional(),
  guaranteePeriodDays: z.number().int().positive().max(3650).optional(),
});

export const sharePutSchema = z.object({
  items: z.array(shareItemSchema).min(1),
});

export const shareReviewSchema = z.object({
  pass: z.boolean(),
  reason: z.string().max(500).optional(),
});

export const listingPatchSchema = z.object({
  status: z.enum(LISTING_STATUSES),
  platformDramaId: z.string().max(80).optional(),
  listingUrl: z.string().max(500).optional(),
  listedAt: dateStr.optional(),
});

export const dailyStatSchema = z.object({
  statDate: dateStr,
  statTimezone: z.string().trim().min(1).max(60),
  platformId: z.string().min(1),
  contractCode: z.string().max(60).optional(),
  dramaId: z.string().min(1),
  platformDramaId: z.string().max(80).optional(),
  titleLocal: z.string().trim().min(1).max(160),
  language: z.string().trim().min(1).max(40),
  territory: z.string().max(80).optional(),
  episodesOnline: z.number().int().nonnegative(),
  views: z.number().int().nonnegative(),
  viewMetricDef: z.string().trim().min(1).max(200),
  uniqueViewers: z.number().int().nonnegative().optional(),
  paidUnlocks: z.number().int().nonnegative().optional(),
  grossRevenue: decimalStr.optional(),
  netRevenue: decimalStr.optional(),
  currency: z.string().trim().min(1).max(8),
  shareRate: rateStr.optional(),
  mgAmount: decimalStr.optional(),
  mgRecouped: decimalStr.optional(),
  revenueShareDue: decimalStr.optional(),
  dealType: z.enum(DEAL_TYPES),
  dataSource: z.enum(DATA_SOURCES),
  evidenceFiles: z.string().max(2000).optional(),
  watermarkId: z.string().optional(),
  anomalyNote: z.string().max(500).optional(),
});

export const dailyListSchema = pageSchema.extend({
  platformId: z.string().optional(),
  dramaId: z.string().optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
  status: z.enum(['DRAFT', 'REVIEWED', 'ANOMALY', 'LOCKED']).optional(),
  companyId: z.string().optional(),
});

export const watermarkCreateSchema = z.object({
  fileKey: z.string().min(1),
  dramaId: z.string().optional(),
  platformId: z.string().optional(),
  shotDate: dateStr.optional(),
  kind: z.enum(['LISTING', 'DATA', 'DELIST']).default('DATA'),
  filename: z.string().max(240).optional(),
});

export const watermarkAssignSchema = z.object({
  dramaId: z.string().min(1),
  platformId: z.string().min(1),
  shotDate: dateStr,
});

export const contractCreateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  type: z.enum(['DISTRIBUTION', 'SUPPLEMENT']).default('DISTRIBUTION'),
  dramaIds: z.array(z.string()).min(1),
  planId: z.string().optional(),
  note: z.string().max(1000).optional(),
});

export const contractPatchSchema = z.object({
  status: z.enum(CONTRACT_STATUSES).optional(),
  fileKey: z.string().min(1).optional(),
  note: z.string().max(1000).optional(),
});

export const settlementGenerateSchema = z.object({
  companyId: z.string().min(1),
  periodStart: dateStr,
  periodEnd: dateStr,
});

export const settlementAmountSchema = z.object({
  amountCny: decimalStr,
  internalNote: z.string().trim().min(1).max(1000),
  clientNote: z.string().max(1000).optional(),
  reason: z.string().max(500).optional(),
  lines: z
    .array(z.object({ lineId: z.string(), amountCny: decimalStr }))
    .optional(),
});

export const settlementReviewSchema = z.object({
  pass: z.boolean(),
  reason: z.string().max(500).optional(),
});

export const policySchema = z.object({
  cycleType: z.enum(CYCLE_TYPES),
  customDays: z.number().int().positive().max(366).optional(),
  anchorDate: dateStr,
  note: z.string().max(500).optional(),
  carryoverNote: z.string().max(500).optional(),
});

export const withdrawalCreateSchema = z.object({
  settlementIds: z.array(z.string()).min(1),
  bankAccountId: z.string().min(1),
  idempotencyKey: z.string().max(80).optional(),
});

export const invoiceSchema = z.object({
  invoiceKey: z.string().min(1),
  invoiceNo: z.string().max(60).optional(),
});

export const invoiceReviewSchema = z.object({
  pass: z.boolean(),
  reason: z.string().max(500).optional(),
});

export const paySchema = z.object({
  voucherKey: z.string().min(1),
});

export const rateSchema = z.object({
  pair: z.string().regex(/^[A-Z]{3}->CNY$/),
  rateDate: dateStr,
  value: z.string().regex(/^\d+(\.\d{1,6})?$/),
  source: z.string().trim().min(1).max(80),
});

export const platformPatchSchema = z.object({
  region: z.string().max(80).optional(),
  enabled: z.boolean().optional(),
  firstBatch: z.boolean().optional(),
  sort: z.number().int().optional(),
  syncMode: z.enum(['MANUAL', 'API']).optional(),
  syncLag: z.enum(SYNC_LAGS).optional(),
  contact: z.string().max(120).optional(),
  color: z.string().max(20).optional(),
});

export const platformCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  region: z.string().max(80).optional(),
  syncLag: z.enum(SYNC_LAGS).default('T1'),
  contact: z.string().max(120).optional(),
});

export const userCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  name: z.string().trim().min(1).max(40),
  role: z.enum(ROLES).refine((r) => r !== 'CLIENT', '客户请走注册'),
});

export const userPatchSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  role: z.enum(['OPS', 'BD', 'FINANCE', 'ADMIN']).optional(),
  disabled: z.boolean().optional(),
});

export const settingsSchema = z.object({
  minWithdrawAmount: decimalStr,
  deviationPct: z.string().regex(/^\d+(\.\d{1,2})?$/),
  syncDeadline: z.string().regex(/^\d{2}:\d{2}$/),
});

export const ticketMessageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

export const ownerPatchSchema = z.object({
  ownerId: z.string().nullable(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type DramaListQuery = z.infer<typeof dramaListSchema>;
export type DailyStatInput = z.infer<typeof dailyStatSchema>;
export type PlanCreateInput = z.infer<typeof planCreateSchema>;
export type SharePutInput = z.infer<typeof sharePutSchema>;
