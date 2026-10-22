import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const MONEY_PATTERN = /^-?\d+(\.\d{1,2})?$/;

/** 超过两位小数直接拒绝，不交给数据库四舍五入。 */
export function moneyDecimal(value: string) {
  if (!MONEY_PATTERN.test(value)) throw new BadRequestException('金额最多保留两位小数');
  return new Prisma.Decimal(value);
}
