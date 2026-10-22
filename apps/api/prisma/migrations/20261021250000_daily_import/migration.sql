CREATE TYPE "ImportBatchStatus" AS ENUM ('UPLOADED', 'MAPPED', 'VALIDATED', 'PUBLISHED', 'FORCE_PUBLISHED', 'SUBMITTED_MANAGER');
CREATE TYPE "ImportRowStatus" AS ENUM ('OK', 'ERROR', 'EXCLUDED', 'PUBLISHED');

CREATE TABLE "DailyImportBatch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "platformId" TEXT,
    "fileName" TEXT NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'UPLOADED',
    "mapping" JSONB,
    "headers" JSONB,
    "forceReason" TEXT,
    "managerNote" TEXT,
    "createdById" TEXT NOT NULL,
    "submittedToManagerAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyImportRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNo" INTEGER NOT NULL,
    "raw" JSONB NOT NULL,
    "mapped" JSONB,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'OK',
    "errorReason" TEXT NOT NULL DEFAULT '',
    "dailyStatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyImportRow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyImportBatch_code_key" ON "DailyImportBatch"("code");
CREATE INDEX "DailyImportBatch_createdById_createdAt_idx" ON "DailyImportBatch"("createdById", "createdAt");
CREATE INDEX "DailyImportBatch_status_idx" ON "DailyImportBatch"("status");
CREATE UNIQUE INDEX "DailyImportRow_batchId_rowNo_key" ON "DailyImportRow"("batchId", "rowNo");
CREATE INDEX "DailyImportRow_batchId_status_idx" ON "DailyImportRow"("batchId", "status");

ALTER TABLE "DailyImportBatch" ADD CONSTRAINT "DailyImportBatch_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DailyImportBatch" ADD CONSTRAINT "DailyImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyImportRow" ADD CONSTRAINT "DailyImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DailyImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
