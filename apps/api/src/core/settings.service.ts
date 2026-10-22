import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

function envText(key: string, fallback: string) {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return fallback;
  return raw.trim();
}

const DEFAULTS = {
  minWithdrawAmount: '10000.00',
  deviationPct: '5',
  syncDeadline: '06:00',
  spotCheckRatio: '0.1',
  reviewSlaDays: '2',
  shareSlaDays: '1',
  slaWarnRatio: '0.8',
  slaDoubleRatio: '2',
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async all() {
    const rows = await this.prisma.systemSetting.findMany();
    const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    return {
      minWithdrawAmount: map.minWithdrawAmount ?? DEFAULTS.minWithdrawAmount,
      deviationPct: map.deviationPct ?? DEFAULTS.deviationPct,
      syncDeadline: map.syncDeadline ?? DEFAULTS.syncDeadline,
      spotCheckRatio: map.spotCheckRatio ?? envText('SPOT_CHECK_RATIO', DEFAULTS.spotCheckRatio),
      reviewSlaDays: map.reviewSlaDays ?? envText('REVIEW_SLA_DAYS', DEFAULTS.reviewSlaDays),
      shareSlaDays: map.shareSlaDays ?? envText('SHARE_SLA_DAYS', DEFAULTS.shareSlaDays),
      slaWarnRatio: map.slaWarnRatio ?? envText('SLA_WARN_RATIO', DEFAULTS.slaWarnRatio),
      slaDoubleRatio: map.slaDoubleRatio ?? envText('SLA_DOUBLE_RATIO', DEFAULTS.slaDoubleRatio),
    };
  }

  async put(values: Partial<typeof DEFAULTS>, actorId: string) {
    for (const [key, value] of Object.entries(values)) {
      if (value == null) continue;
      await this.prisma.systemSetting.upsert({
        where: { key },
        create: { key, value, updatedById: actorId },
        update: { value, updatedById: actorId },
      });
    }
    return this.all();
  }
}
