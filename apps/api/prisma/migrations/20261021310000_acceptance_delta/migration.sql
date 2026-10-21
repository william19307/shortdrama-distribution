-- 0004 里已有的表和列不再重复创建。这里只补当前分支还没有的字段。
ALTER TABLE "ShareConfig" ADD COLUMN "templateId" TEXT;
ALTER TABLE "ShareConfig" ADD COLUMN "templateVersion" INTEGER;
ALTER TABLE "Settlement" ADD COLUMN "policyVersionId" TEXT;
ALTER TABLE "SettlementPolicyVersion" ADD COLUMN "effectiveFrom" DATE;
UPDATE "SettlementPolicyVersion" SET "effectiveFrom" = ("createdAt" AT TIME ZONE 'UTC')::date WHERE "effectiveFrom" IS NULL;
ALTER TABLE "SettlementPolicyVersion" ALTER COLUMN "effectiveFrom" SET DEFAULT CURRENT_DATE;
ALTER TABLE "SettlementPolicyVersion" ALTER COLUMN "effectiveFrom" SET NOT NULL;
ALTER TABLE "AsyncTask" ADD COLUMN "parentId" TEXT;
ALTER TABLE "AsyncTask" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "PlatformRosterRequest" ADD COLUMN "decisionNote" TEXT NOT NULL DEFAULT '';

CREATE TABLE "SlaAlert" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SlaAlert_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SlaAlert_planId_tier_dueAt_key" ON "SlaAlert"("planId", "tier", "dueAt");
