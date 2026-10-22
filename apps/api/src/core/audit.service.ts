import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async write(actorId: string | null, action: string, entityType: string, entityId: string, detail?: Prisma.InputJsonValue) {
    await this.prisma.auditLog.create({
      data: { actorId, action, entityType, entityId, detail },
    });
  }
}
