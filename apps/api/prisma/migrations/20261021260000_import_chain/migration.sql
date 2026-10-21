ALTER TABLE "DailyImportBatch" ADD COLUMN "headerChanged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DailyImportBatch" ADD COLUMN "templateVersion" INTEGER;
ALTER TABLE "DailyImportRow" ADD COLUMN "issues" JSONB;
ALTER TABLE "DailyImportRow" ADD COLUMN "candidates" JSONB;
ALTER TABLE "DailyImportRow" ADD COLUMN "rowAction" TEXT NOT NULL DEFAULT '';

CREATE TYPE "SyncTaskStatus" AS ENUM ('PENDING', 'SYNCING', 'PUBLISHED', 'OVERDUE');

CREATE TABLE "SyncTask" (
    "id" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "statDate" DATE NOT NULL,
    "status" "SyncTaskStatus" NOT NULL DEFAULT 'PENDING',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SyncTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportFieldTemplate" (
    "id" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "mapping" JSONB NOT NULL,
    "headers" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportFieldTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DramaAlias" (
    "id" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "dramaId" TEXT NOT NULL,
    "aliasNorm" TEXT NOT NULL,
    "aliasRaw" TEXT NOT NULL DEFAULT '',
    "platformSeriesId" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DramaAlias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SettlementImportBatch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREVIEWED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SettlementImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SettlementImportRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "settlementId" TEXT,
    "settlementCode" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountCny" TEXT NOT NULL DEFAULT '',
    "previousAmount" TEXT NOT NULL DEFAULT '',
    "internalNote" TEXT NOT NULL DEFAULT '',
    "clientNote" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "errorReason" TEXT NOT NULL DEFAULT '',
    "lines" JSONB,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "SettlementImportRow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SyncTask_platformId_statDate_key" ON "SyncTask"("platformId", "statDate");
CREATE INDEX "SyncTask_status_statDate_idx" ON "SyncTask"("status", "statDate");
CREATE UNIQUE INDEX "ImportFieldTemplate_platformId_version_key" ON "ImportFieldTemplate"("platformId", "version");
CREATE UNIQUE INDEX "DramaAlias_platformId_aliasNorm_key" ON "DramaAlias"("platformId", "aliasNorm");
CREATE INDEX "DramaAlias_platformId_platformSeriesId_idx" ON "DramaAlias"("platformId", "platformSeriesId");
CREATE UNIQUE INDEX "SettlementImportBatch_code_key" ON "SettlementImportBatch"("code");
CREATE INDEX "SettlementImportBatch_createdById_createdAt_idx" ON "SettlementImportBatch"("createdById", "createdAt");
CREATE INDEX "SettlementImportRow_batchId_kind_idx" ON "SettlementImportRow"("batchId", "kind");

ALTER TABLE "SyncTask" ADD CONSTRAINT "SyncTask_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportFieldTemplate" ADD CONSTRAINT "ImportFieldTemplate_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportFieldTemplate" ADD CONSTRAINT "ImportFieldTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DramaAlias" ADD CONSTRAINT "DramaAlias_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DramaAlias" ADD CONSTRAINT "DramaAlias_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DramaAlias" ADD CONSTRAINT "DramaAlias_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SettlementImportRow" ADD CONSTRAINT "SettlementImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SettlementImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
