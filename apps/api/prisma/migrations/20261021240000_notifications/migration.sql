-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "entityType" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateEnum
CREATE TYPE "SpotCheckResult" AS ENUM ('PASS', 'FAIL', 'NOTE');

-- CreateTable
CREATE TABLE "ReviewSpotCheck" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "checkedById" TEXT NOT NULL,
    "result" "SpotCheckResult" NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewSpotCheck_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt" DESC);
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX "Notification_type_entityId_idx" ON "Notification"("type", "entityId");
CREATE INDEX "ReviewSpotCheck_planId_createdAt_idx" ON "ReviewSpotCheck"("planId", "createdAt");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewSpotCheck" ADD CONSTRAINT "ReviewSpotCheck_planId_fkey" FOREIGN KEY ("planId") REFERENCES "DistributionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
