import { Prisma } from '@prisma/client';
import { dailyDto, hidesCommercialTerms, isDailyStatRecord, isPolicyVersionRecord, isProjectPolicyRecord, isSettlementLineRecord, isShareRecord, pickKeys, policyVersionDto, projectPolicyDto, SETTLEMENT_LINE_PUBLIC_KEYS, SHARE_PUBLIC_KEYS, stripCommercialKeys } from './viewer-dto';

function projectPlain(value: Record<string, unknown>, role?: string) {
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) out[key] = toPlain(item, role);
  return out;
}

function isDecimal(value: unknown): value is { toString(): string; d: unknown; s: number } {
  return Boolean(value && typeof value === 'object' && typeof (value as { toFixed?: unknown }).toFixed === 'function' && Array.isArray((value as { d?: unknown }).d));
}

/** 把 Prisma 对象收成可 JSON 化的结构。客户的分成、结算明细、日报和结算策略按白名单投影；商务的分成和结算明细同样按白名单，其余对象只剔除保底字段。 */
export function toPlain(value: unknown, role?: string): unknown {
  if (value == null) return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Prisma.Decimal || isDecimal(value)) return (value as { toString(): string }).toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => toPlain(item, role));
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (hidesCommercialTerms(role) && isShareRecord(record)) {
      return toPlain(pickKeys(record, SHARE_PUBLIC_KEYS), role);
    }
    if (hidesCommercialTerms(role) && isSettlementLineRecord(record)) {
      return toPlain(pickKeys(record, SETTLEMENT_LINE_PUBLIC_KEYS), role);
    }
    if (role === 'CLIENT' && isDailyStatRecord(record)) return projectPlain(dailyDto(record), role);
    if (role === 'CLIENT' && isProjectPolicyRecord(record)) return projectPlain(projectPolicyDto(record), role);
    if (role === 'CLIENT' && isPolicyVersionRecord(record)) return projectPlain(policyVersionDto(record), role);
    const source = hidesCommercialTerms(role) ? stripCommercialKeys(record) : record;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(source)) {
      if (key === 'passwordHash') continue;
      out[key] = toPlain(item, role);
    }
    return out;
  }
  return value;
}
