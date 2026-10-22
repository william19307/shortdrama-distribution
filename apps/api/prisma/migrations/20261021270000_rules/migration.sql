ALTER TABLE "Platform" ADD COLUMN "syncLagPending" "SyncLag";
ALTER TABLE "Platform" ADD COLUMN "syncLagEffectiveOn" DATE;

CREATE TABLE "PlatformRosterRequest" (
    "id" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "firstBatch" BOOLEAN,
    "enabled" BOOLEAN,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    CONSTRAINT "PlatformRosterRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SettlementPolicyVersion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "planId" TEXT,
    "version" INTEGER NOT NULL,
    "cycleType" "CycleType" NOT NULL,
    "customDays" INTEGER,
    "anchorDate" DATE NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "carryoverNote" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SettlementPolicyVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformRosterRequest_platformId_status_idx" ON "PlatformRosterRequest"("platformId", "status");
CREATE INDEX "SettlementPolicyVersion_companyId_version_idx" ON "SettlementPolicyVersion"("companyId", "version");
CREATE INDEX "SettlementPolicyVersion_planId_version_idx" ON "SettlementPolicyVersion"("planId", "version");
ALTER TABLE "PlatformRosterRequest" ADD CONSTRAINT "PlatformRosterRequest_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE CASCADE ON UPDATE CASCADE;
