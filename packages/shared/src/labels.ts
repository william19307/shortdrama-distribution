import type { ClientPhase, PlanStatus, Role } from './enums';

export const ROLE_LABEL: Record<Role, string> = {
  CLIENT: '客户',
  OPS: '运营',
  BD: '商务',
  FINANCE: '财务',
  ADMIN: '管理员',
};

export const CERT_LABEL: Record<string, string> = {
  UNVERIFIED: '未认证',
  PENDING: '认证审核中',
  APPROVED: '已认证',
  REJECTED: '认证未通过',
  CHANGE_PENDING: '主体变更审核中',
};

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  PRECHECK_FAILED: '预检未通过',
  PENDING_ASSIGN: '待分派',
  PENDING_REVIEW: '待审核',
  IN_REVIEW: '审核中',
  NEEDS_REVISION: '需修改',
  SHARE_CONFIG: '分成配置中',
  SHARE_REVIEW: '分成待复核',
  APPROVED: '审核通过',
  DISTRIBUTING: '发行对接中',
  LIVE: '发行中',
  OFFLINE: '已下架',
  WITHDRAWN: '已撤回',
};

export const SHARE_MODE_LABEL: Record<string, string> = {
  MG: '保底',
  MG_OVER: '超保底',
  NO_MG: '无保底',
};

export const LISTING_LABEL: Record<string, string> = {
  PENDING_CONTACT: '待对接',
  IN_CONTACT: '对接中',
  REJECTED_BY_PLATFORM: '平台未接收',
  PENDING_LISTING: '待上架',
  LISTED: '已上架',
  DELISTED: '已下架',
};

export const SETTLEMENT_LABEL: Record<string, string> = {
  PENDING_ENTRY: '待录入',
  PENDING_REVIEW: '待复核',
  NO_SETTLEMENT: '无需结算',
  PENDING_APPLY: '待申请',
  BELOW_MINIMUM: '未达起提额',
  VERIFYING: '核对中',
  PENDING_INVOICE: '待开票',
  INVOICE_REVIEW: '发票审核中',
  PAYING: '打款中',
  PAID: '已到账',
};

export const CONTRACT_LABEL: Record<string, string> = {
  APPLYING: '申请中',
  DRAFTING: '起草中',
  PENDING_SIGN: '待签署',
  EFFECTIVE: '已生效',
  EXPIRED: '已到期',
};

export const TICKET_TYPE_LABEL: Record<string, string> = {
  REVIEW: '审核结果',
  WATERMARK: '防伪截图',
  DATA_DISPUTE: '数据异议',
  SETTLEMENT_DISPUTE: '结算异议',
};

export const TICKET_STATUS_LABEL: Record<string, string> = {
  CREATED: '已创建',
  PENDING_CLIENT: '待查看',
  READ: '已读',
  IN_PROGRESS: '处理中',
  RESOLVED: '已解决',
  CLOSED: '已关闭',
};

export const DEAL_TYPE_LABEL: Record<string, string> = {
  NO_MG: '无保底',
  MG_SHARE: '保底+分成',
  BUYOUT: '买断',
};

export const DATA_SOURCE_LABEL: Record<string, string> = {
  SCREENSHOT: '后台截图',
  REPORT_EMAIL: '平台报表邮件',
  BD_NOTE: '商务口径',
};

export const DAILY_STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿',
  REVIEWED: '已复核',
  ANOMALY: '异常',
  LOCKED: '已锁定',
};

export const CYCLE_LABEL: Record<string, string> = {
  MONTH: '自然月',
  QUARTER: '季度',
  CUSTOM_DAYS: '自定义天数',
};

export const CLIENT_PHASE_META: Record<ClientPhase, { label: string; tone: 'neutral' | 'warning' | 'success' | 'error' | 'info' | 'brand' }> = {
  action: { label: '需要你处理', tone: 'warning' },
  review: { label: '审核中', tone: 'info' },
  ready: { label: '准备上架', tone: 'info' },
  live: { label: '已上架', tone: 'success' },
  offline: { label: '已下架', tone: 'neutral' },
  withdrawn: { label: '已撤回', tone: 'neutral' },
  idle: { label: '未发行', tone: 'neutral' },
};

const ACTION: PlanStatus[] = ['NEEDS_REVISION', 'PRECHECK_FAILED'];
const REVIEW: PlanStatus[] = ['PENDING_ASSIGN', 'PENDING_REVIEW', 'IN_REVIEW', 'SHARE_CONFIG', 'SHARE_REVIEW'];
const READY: PlanStatus[] = ['APPROVED', 'DISTRIBUTING'];

export function clientPhaseFromPlans(statuses: string[]): ClientPhase {
  const has = (list: string[]) => statuses.some((s) => list.includes(s));
  if (has(ACTION)) return 'action';
  if (has(['LIVE'])) return 'live';
  if (has(READY)) return 'ready';
  if (has(REVIEW)) return 'review';
  if (has(['OFFLINE'])) return 'offline';
  if (has(['WITHDRAWN'])) return 'withdrawn';
  return 'idle';
}

export function toneForPlan(status: string): 'neutral' | 'warning' | 'success' | 'error' | 'info' | 'brand' {
  if (status === 'NEEDS_REVISION' || status === 'PRECHECK_FAILED' || status === 'REJECTED') return 'error';
  if (status === 'LIVE' || status === 'APPROVED' || status === 'PAID' || status === 'EFFECTIVE') return 'success';
  if (status === 'SHARE_REVIEW' || status === 'PENDING_REVIEW' || status === 'INVOICE_REVIEW' || status === 'PENDING') return 'warning';
  if (status === 'OFFLINE' || status === 'WITHDRAWN' || status === 'NO_SETTLEMENT' || status === 'EXPIRED') return 'neutral';
  return 'info';
}
