/** 客户与商务看到的分成、结算明细只用白名单。客户的日报和结算策略同样按白名单投影。 */

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

/** 客户端日报去掉保底三字段，也不带名单外的内部备注。 */
export const DAILY_PUBLIC_KEYS = [
  'id',
  'recordId',
  'companyId',
  'platformId',
  'platform',
  'dramaId',
  'drama',
  'statDate',
  'statTimezone',
  'contractCode',
  'platformDramaId',
  'titleLocal',
  'language',
  'territory',
  'episodesOnline',
  'views',
  'viewMetricDef',
  'uniqueViewers',
  'paidUnlocks',
  'grossRevenue',
  'netRevenue',
  'currency',
  'shareRate',
  'dealType',
  'dataSource',
  'evidenceFiles',
  'evidenceSha256',
  'watermarkId',
  'anomalyNote',
  'status',
  'lagWarning',
  'enteredById',
  'enteredAt',
  'reviewedById',
  'reviewedAt',
  'lockedAt',
  'version',
] as const;

/** 客户项目结算策略不含结转说明。 */
export const PROJECT_POLICY_PUBLIC_KEYS = ['id', 'planId', 'plan', 'cycleType', 'customDays', 'anchorDate', 'note', 'updatedAt'] as const;

/** 客户结算策略版本不含结转说明。 */
export const POLICY_VERSION_PUBLIC_KEYS = [
  'id',
  'companyId',
  'planId',
  'version',
  'cycleType',
  'customDays',
  'anchorDate',
  'effectiveFrom',
  'note',
  'createdById',
  'createdAt',
] as const;

export function isDailyStatRecord(value: Record<string, unknown>) {
  return 'recordId' in value && 'views' in value && 'statDate' in value && 'dealType' in value;
}

export function isProjectPolicyRecord(value: Record<string, unknown>) {
  return 'carryoverNote' in value && 'planId' in value && 'cycleType' in value && !('version' in value);
}

export function isPolicyVersionRecord(value: Record<string, unknown>) {
  return 'carryoverNote' in value && 'version' in value && 'cycleType' in value;
}

export function dailyDto(row: Record<string, unknown>) {
  return pickKeys(row, DAILY_PUBLIC_KEYS);
}

export function projectPolicyDto(row: Record<string, unknown>) {
  return pickKeys(row, PROJECT_POLICY_PUBLIC_KEYS);
}

export function policyVersionDto(row: Record<string, unknown>) {
  return pickKeys(row, POLICY_VERSION_PUBLIC_KEYS);
}

export function stripCommercialKeys<T extends Record<string, unknown>>(value: T) {
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!COMMERCIAL_KEYS.has(key)) out[key] = item;
  }
  return out;
}
