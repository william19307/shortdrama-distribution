import { Controller, Get, Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { CommerceModule } from './commerce/commerce.module';
import { CompanyModule } from './company/company.module';
import { CoreModule } from './core/core.module';
import { DistributionModule } from './distribution/distribution.module';
import { MetricsModule } from './metrics/metrics.module';

@Controller('health')
class HealthController {
  @Get()
  health() {
    return { ok: true };
  }
}

@Module({
  imports: [CoreModule, AuthModule, CompanyModule, CatalogModule, DistributionModule, MetricsModule, CommerceModule, AdminModule],
  controllers: [HealthController],
})
export class AppModule {}
