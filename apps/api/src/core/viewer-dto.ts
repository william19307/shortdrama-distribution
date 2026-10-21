/** 客户与商务看到的分成、结算明细只用白名单，避免新增的保底字段漏出。 */

export function hidesCommercialTerms(role?: string) {
  return role === 'CLIENT' || role === 'BD';
}

export const SHARE_PUBLIC_KEYS = ['id', 'platformId', 'clientRate', 'overRate', 'reviewStatus'] as const;

export const SETTLEMENT_LINE_PUBLIC_KEYS = [
  'id',
  'settlementId',
  'dramaId',
  'drama',
  'platformId',
  'platformName',
  'currency',
  'originalAmount',
  'rateValue',
  'rateDate',
  'rateSource',
  'clientRate',
  'lineAmountCny',
] as const;

const COMMERCIAL_KEYS = new Set([
  'guaranteeAmount',
  'guaranteeCurrency',
  'guaranteePeriodDays',
  'mgAmount',
  'mgRecouped',
  'revenueShareDue',
  'carryoverNote',
  'internalNote',
]);

export function isShareRecord(value: Record<string, unknown>) {
  return 'clientRate' in value && 'platformId' in value && ('mode' in value || 'guaranteeAmount' in value) && !('originalAmount' in value);
}

export function isSettlementLineRecord(value: Record<string, unknown>) {
  return 'originalAmount' in value && 'platformName' in value && ('guaranteeAmount' in value || 'shareMode' in value);
}

export function pickKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in value) out[key] = value[key];
  }
  return out;
}

export function shareDto(share: Record<string, unknown>) {
  return pickKeys(share, SHARE_PUBLIC_KEYS);
}

export function settlementLineDto(line: Record<string, unknown>) {
  return pickKeys(line, SETTLEMENT_LINE_PUBLIC_KEYS);
}

export function stripCommercialKeys<T extends Record<string, unknown>>(value: T) {
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!COMMERCIAL_KEYS.has(key)) out[key] = item;
  }
  return out;
}
