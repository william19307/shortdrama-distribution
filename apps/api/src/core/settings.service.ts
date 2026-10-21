import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

const DEFAULTS = {
  minWithdrawAmount: '10000.00',
  deviationPct: '5',
  syncDeadline: '06:00',
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
