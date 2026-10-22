import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuditService } from './audit.service';
import { SettingsService } from './settings.service';
import { JwtStrategy, jwtSecret } from './auth';
import { PlainInterceptor } from './http';
import { PrismaService } from './prisma.service';
import { MemoryStorageService, S3StorageService, StorageLifecycle, StorageService, useMemoryStorage } from './storage.service';

@Global()
@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: jwtSecret(),
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [
    PrismaService,
    AuditService,
    SettingsService,
    JwtStrategy,
    {
      provide: StorageService,
      useFactory: () => (useMemoryStorage() ? new MemoryStorageService() : new S3StorageService()),
    },
    StorageLifecycle,
    { provide: APP_INTERCEPTOR, useClass: PlainInterceptor },
  ],
  exports: [PrismaService, AuditService, SettingsService, JwtModule, StorageService],
})
export class CoreModule {}
