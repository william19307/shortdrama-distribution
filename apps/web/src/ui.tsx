import {
  CERT_LABEL,
  ROLE_LABEL,
  CLIENT_PHASE_META,
  CONTRACT_LABEL,
  CYCLE_LABEL,
  DAILY_STATUS_LABEL,
  DATA_SOURCE_LABEL,
  DEAL_TYPE_LABEL,
  LISTING_LABEL,
  PLAN_STATUS_LABEL,
  SETTLEMENT_LABEL,
  SHARE_MODE_LABEL,
  TICKET_STATUS_LABEL,
  TICKET_TYPE_LABEL,
} from '@shortform/shared';
import { toneToTagColor } from '@ds/antdTheme';
import { bizToneFor, platform, platformSolid, type AnyPlatformKey, type BizStatus, type BizTone, type PlatformKey } from '@ds/tokens';
import { Alert, Tag } from 'antd';
import type { ReactNode } from 'react';
import { useAuth } from './auth';

const LABELS: Record<string, string> = {
  ...ROLE_LABEL,
  ...PLAN_STATUS_LABEL,
  ...SETTLEMENT_LABEL,
  ...CONTRACT_LABEL,
  ...CERT_LABEL,
  ...LISTING_LABEL,
  ...TICKET_STATUS_LABEL,
  ...TICKET_TYPE_LABEL,
  ...DAILY_STATUS_LABEL,
  ...SHARE_MODE_LABEL,
  ...DEAL_TYPE_LABEL,
  ...DATA_SOURCE_LABEL,
  ...CYCLE_LABEL,
  FIRST: '首发',
  SECOND: '二轮',
  UNSAMPLED: '未抽检',
  PENDING: '待审',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  REPLACED: '已替换',
  T1: '昨天',
  T2: '前天',
  MANUAL: '手工',
  API: '接口',
  DISTRIBUTION: '发行合同',
  SUPPLEMENT: '补充协议',
  MONTH: '自然月',
  QUARTER: '季度',
  CUSTOM_DAYS: '自定义天数',
};

export function labelOf(status?: string | null) {
  if (!status) return '—';
  return LABELS[status] || CLIENT_PHASE_META[status as keyof typeof CLIENT_PHASE_META]?.label || status;
}

const STATUS_BIZ: Record<string, BizStatus> = {
  DRAFT: 'draft',
  PENDING: 'reviewing',
  PENDING_ASSIGN: 'actionRequired',
  PENDING_REVIEW: 'reviewing',
  IN_REVIEW: 'reviewing',
  SHARE_CONFIG: 'reviewing',
  SHARE_REVIEW: 'reviewing',
  REVIEW: 'reviewing',
  NEEDS_REVISION: 'needMaterial',
  PRECHECK_FAILED: 'needMaterial',
  REPLACED: 'toSubmit',
  UNSAMPLED: 'reviewing',
  PENDING_ENTRY: 'pendingSettle',
  PENDING_APPLY: 'pendingSettle',
  PENDING_INVOICE: 'invoicePending',
  INVOICE_REVIEW: 'reviewing',
  PAYING: 'pendingSettle',
  APPROVED: 'approved',
  LIVE: 'live',
  DISTRIBUTING: 'live',
  LISTED: 'live',
  REJECTED: 'rejected',
  PAID: 'settled',
  SETTLED: 'settled',
  EFFECTIVE: 'settled',
  EXPIRED: 'offline',
  OFFLINE: 'offline',
  WITHDRAWN: 'offline',
  UNVERIFIED: 'toSubmit',
  CHANGE_PENDING: 'actionRequired',
  NO_SETTLEMENT: 'rejected',
};

function viewerOf(role?: string): 'client' | 'ops' | 'finance' {
  if (role === 'CLIENT') return 'client';
  if (role === 'FINANCE') return 'finance';
  return 'ops';
}

export function StatusTag({ status, text }: { status?: string | null; text?: string }) {
  const { user } = useAuth();
  if (!status) return <Tag>未开始</Tag>;
  const biz = STATUS_BIZ[status];
  const tone: BizTone = biz ? bizToneFor(biz, viewerOf(user?.role)) : 'neutral';
  return <Tag bordered={false} color={toneToTagColor[tone]}>{text || labelOf(status)}</Tag>;
}

const PLATFORM_ALIAS: Record<string, AnyPlatformKey> = {
  RS: 'ReelShort', DB: 'DramaBox', SM: 'ShortMax', FT: 'FlexTV', GS: 'GoodShort', NS: 'NetShort',
};

function platformKey(name: string): AnyPlatformKey | null {
  if (name in platform) return name as PlatformKey;
  return PLATFORM_ALIAS[name] ?? null;
}

function platformTextColor(key: AnyPlatformKey | null) {
  if (key === 'ShortMax') return 'var(--ds-platform-shortmax-text)';
  if (key === 'FlexTV') return 'var(--ds-platform-flextv-text)';
  if (key && key in platform) return `var(${platform[key as PlatformKey].css})`;
  return 'var(--ds-text-2)';
}

export function PlatformChip({ name, sync }: { name: string; sync?: string }) {
  const key = platformKey(name);
  const letters = (name.match(/[A-Za-z]/g) || []).join('').slice(0, 2).toUpperCase() || name.slice(0, 1);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
      <span className="ds-plat-logo ds-plat-logo--sm" style={{ background: key ? platformSolid(key) : 'var(--ds-text-3)' }}>{letters}</span>
      <span className="ds-plat-sync" style={{ color: platformTextColor(key) }}>{sync ? `${name} · ${sync}` : name}</span>
    </span>
  );
}

export function MoneyText({ value }: { value?: string | number | null }) {
  return <span className="ds-money">{money(value)}</span>;
}

const PHASE_TONE: Record<string, BizTone> = {
  warning: 'action', neutral: 'neutral', success: 'success', error: 'error', info: 'info', brand: 'brand',
};

export function PhaseTag({ phase }: { phase?: string | null }) {
  const meta = phase ? CLIENT_PHASE_META[phase as keyof typeof CLIENT_PHASE_META] : undefined;
  if (!meta) return <Tag>未发行</Tag>;
  return <Tag bordered={false} color={toneToTagColor[PHASE_TONE[meta.tone] || 'neutral']}>{meta.label}</Tag>;
}

export function PageHead({ title, extra, hint }: { title: string; extra?: ReactNode; hint?: string }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {hint ? <p>{hint}</p> : null}
      </div>
      {extra}
    </div>
  );
}

export function ErrorNote({ error }: { error?: string }) {
  if (!error) return null;
  return <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />;
}

export function money(value?: string | number | null) {
  if (value == null || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return `¥${num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function dayText(value?: string | null) {
  if (!value) return '—';
  return String(value).slice(0, 10);
}

export const EPISODE_CLIENT: Record<string, string> = {
  UNSAMPLED: '已接收',
  PENDING: '审核中',
  APPROVED: '已通过',
  REJECTED: '需要替换',
  REPLACED: '已替换，等待再次提交',
};
