CREATE TABLE "ShareTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT NOT NULL DEFAULT '',
    "mode" "ShareMode" NOT NULL,
    "clientRate" DECIMAL(6,2) NOT NULL,
    "overRate" DECIMAL(6,2),
    "guaranteeAmount" DECIMAL(18,2),
    "guaranteeCurrency" TEXT,
    "guaranteePeriodDays" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShareTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShareTemplate_name_version_idx" ON "ShareTemplate"("name", "version");
