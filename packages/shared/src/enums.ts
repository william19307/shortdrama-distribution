export const ROLES = ['CLIENT', 'OPS', 'BD', 'FINANCE', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const CERT_STATUSES = ['UNVERIFIED', 'PENDING', 'APPROVED', 'REJECTED', 'CHANGE_PENDING'] as const;
export type CertStatus = (typeof CERT_STATUSES)[number];

export const PLAN_ROUNDS = ['FIRST', 'SECOND'] as const;
export type PlanRound = (typeof PLAN_ROUNDS)[number];

export const PLAN_STATUSES = [
  'PRECHECK_FAILED',
  'PENDING_ASSIGN',
  'PENDING_REVIEW',
  'IN_REVIEW',
  'NEEDS_REVISION',
  'SHARE_CONFIG',
  'SHARE_REVIEW',
  'APPROVED',
  'DISTRIBUTING',
  'LIVE',
  'OFFLINE',
  'WITHDRAWN',
] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const EPISODE_REVIEW_STATUSES = ['UNSAMPLED', 'PENDING', 'APPROVED', 'REJECTED', 'REPLACED'] as const;
export type EpisodeReviewStatus = (typeof EPISODE_REVIEW_STATUSES)[number];

export const LISTING_STATUSES = [
  'PENDING_CONTACT',
  'IN_CONTACT',
  'REJECTED_BY_PLATFORM',
  'PENDING_LISTING',
  'LISTED',
  'DELISTED',
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const SHARE_MODES = ['MG', 'MG_OVER', 'NO_MG'] as const;
export type ShareMode = (typeof SHARE_MODES)[number];

export const TICKET_TYPES = ['REVIEW', 'WATERMARK', 'DATA_DISPUTE', 'SETTLEMENT_DISPUTE'] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const TICKET_STATUSES = ['CREATED', 'PENDING_CLIENT', 'READ', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const CONTRACT_STATUSES = ['APPLYING', 'DRAFTING', 'PENDING_SIGN', 'EFFECTIVE', 'EXPIRED'] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const SETTLEMENT_STATUSES = [
  'PENDING_ENTRY',
  'PENDING_REVIEW',
  'NO_SETTLEMENT',
  'PENDING_APPLY',
  'BELOW_MINIMUM',
  'VERIFYING',
  'PENDING_INVOICE',
  'INVOICE_REVIEW',
  'PAYING',
  'PAID',
] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export const DAILY_STATUSES = ['DRAFT', 'REVIEWED', 'ANOMALY', 'LOCKED'] as const;
export type DailyStatus = (typeof DAILY_STATUSES)[number];

export const DEAL_TYPES = ['NO_MG', 'MG_SHARE', 'BUYOUT'] as const;
export type DealType = (typeof DEAL_TYPES)[number];

export const DATA_SOURCES = ['SCREENSHOT', 'REPORT_EMAIL', 'BD_NOTE'] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

export const SYNC_LAGS = ['T1', 'T2'] as const;
export type SyncLag = (typeof SYNC_LAGS)[number];

export const CYCLE_TYPES = ['MONTH', 'QUARTER', 'CUSTOM_DAYS'] as const;
export type CycleType = (typeof CYCLE_TYPES)[number];

export const UPLOAD_PURPOSES = [
  'EPISODE',
  'COVER',
  'LICENSE',
  'COPYRIGHT',
  'INVOICE',
  'VOUCHER',
  'WATERMARK_SOURCE',
  'CONTRACT',
] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

export const CLIENT_PHASES = ['action', 'review', 'ready', 'live', 'offline', 'withdrawn', 'idle'] as const;
export type ClientPhase = (typeof CLIENT_PHASES)[number];

/** 对客户隐藏的字段。接口层一律剔除，不只靠前端。 */
export const CLIENT_SECRET_KEYS = [
  'guaranteeAmount',
  'guaranteeCurrency',
  'guaranteePeriodDays',
  'mgAmount',
  'mgRecouped',
  'revenueShareDue',
  'carryoverNote',
  'passwordHash',
] as const;

export const BLOCKING_PLAN_STATUSES: PlanStatus[] = [
  'PENDING_ASSIGN',
  'PENDING_REVIEW',
  'IN_REVIEW',
  'NEEDS_REVISION',
  'SHARE_CONFIG',
  'SHARE_REVIEW',
  'APPROVED',
  'DISTRIBUTING',
  'LIVE',
];

export const FIRST_BATCH_PLATFORM_NAMES = ['ReelShort', 'DramaBox', 'ShortMax', 'FlexTV', 'GoodShort'] as const;
