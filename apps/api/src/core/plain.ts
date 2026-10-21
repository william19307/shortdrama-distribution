import { Prisma } from '@prisma/client';

const CLIENT_SECRETS = new Set([
  'guaranteeAmount',
  'guaranteeCurrency',
  'guaranteePeriodDays',
  'mgAmount',
  'mgRecouped',
  'revenueShareDue',
  'carryoverNote',
  'internalNote',
  'passwordHash',
]);

function isDecimal(value: unknown): value is { toString(): string; d: unknown; s: number } {
  return Boolean(value && typeof value === 'object' && typeof (value as { toFixed?: unknown }).toFixed === 'function' && Array.isArray((value as { d?: unknown }).d));
}

/** 把 Prisma 对象收成可 JSON 化的结构，并对客户角色去掉保底等字段。 */
export function toPlain(value: unknown, role?: string): unknown {
  if (value == null) return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Prisma.Decimal || isDecimal(value)) return (value as { toString(): string }).toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => toPlain(item, role));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'passwordHash') continue;
      if (role === 'CLIENT' && CLIENT_SECRETS.has(key)) continue;
      out[key] = toPlain(item, role);
    }
    return out;
  }
  return value;
}
