import { Module } from '@nestjs/common';
import { ImportService } from './import.service';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({ controllers: [MetricsController], providers: [MetricsService, ImportService] })
export class MetricsModule {}
