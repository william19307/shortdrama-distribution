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
  toneForPlan,
} from '@shortform/shared';
import { toneToTagColor } from '@ds/antdTheme';
import { Alert, Tag } from 'antd';
import type { ReactNode } from 'react';

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

export function StatusTag({ status, text }: { status?: string | null; text?: string }) {
  if (!status) return <Tag>未开始</Tag>;
  const tone = toneForPlan(status);
  return <Tag color={toneToTagColor[tone]}>{text || labelOf(status)}</Tag>;
}

export function PhaseTag({ phase }: { phase?: string | null }) {
  const meta = phase ? CLIENT_PHASE_META[phase as keyof typeof CLIENT_PHASE_META] : undefined;
  if (!meta) return <Tag>未发行</Tag>;
  return <Tag color={toneToTagColor[meta.tone]}>{meta.label}</Tag>;
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
