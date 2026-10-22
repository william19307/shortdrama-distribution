import { Module } from '@nestjs/common';
import { CommerceController } from './commerce.controller';
import { CommerceService } from './commerce.service';
import { SettlementImportService } from './settlement-import.service';

@Module({ controllers: [CommerceController], providers: [CommerceService, SettlementImportService] })
export class CommerceModule {}
