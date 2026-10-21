-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENT', 'OPS', 'BD', 'FINANCE', 'ADMIN');

-- CreateEnum
CREATE TYPE "CertStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'APPROVED', 'REJECTED', 'CHANGE_PENDING');

-- CreateEnum
CREATE TYPE "PlanRound" AS ENUM ('FIRST', 'SECOND');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('PRECHECK_FAILED', 'PENDING_ASSIGN', 'PENDING_REVIEW', 'IN_REVIEW', 'NEEDS_REVISION', 'SHARE_CONFIG', 'SHARE_REVIEW', 'APPROVED', 'DISTRIBUTING', 'LIVE', 'OFFLINE', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "EpisodeReviewStatus" AS ENUM ('UNSAMPLED', 'PENDING', 'APPROVED', 'REJECTED', 'REPLACED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('PENDING_CONTACT', 'IN_CONTACT', 'REJECTED_BY_PLATFORM', 'PENDING_LISTING', 'LISTED', 'DELISTED');

-- CreateEnum
CREATE TYPE "ShareMode" AS ENUM ('MG', 'MG_OVER', 'NO_MG');

-- CreateEnum
CREATE TYPE "ShareReviewStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('REVIEW', 'WATERMARK', 'DATA_DISPUTE', 'SETTLEMENT_DISPUTE');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('CREATED', 'PENDING_CLIENT', 'READ', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('DISTRIBUTION', 'SUPPLEMENT');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('APPLYING', 'DRAFTING', 'PENDING_SIGN', 'EFFECTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING_ENTRY', 'PENDING_REVIEW', 'NO_SETTLEMENT', 'PENDING_APPLY', 'BELOW_MINIMUM', 'VERIFYING', 'PENDING_INVOICE', 'INVOICE_REVIEW', 'PAYING', 'PAID');

-- CreateEnum
CREATE TYPE "DailyStatus" AS ENUM ('DRAFT', 'REVIEWED', 'ANOMALY', 'LOCKED');

-- CreateEnum
CREATE TYPE "DealType" AS ENUM ('NO_MG', 'MG_SHARE', 'BUYOUT');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('SCREENSHOT', 'REPORT_EMAIL', 'BD_NOTE');

-- CreateEnum
CREATE TYPE "SyncLag" AS ENUM ('T1', 'T2');

-- CreateEnum
CREATE TYPE "SyncMode" AS ENUM ('MANUAL', 'API');

-- CreateEnum
CREATE TYPE "CycleType" AS ENUM ('MONTH', 'QUARTER', 'CUSTOM_DAYS');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('LICENSE', 'COPYRIGHT', 'POSTER', 'SUBTITLE', 'TRAILER');

-- CreateEnum
CREATE TYPE "UploadPurpose" AS ENUM ('EPISODE', 'COVER', 'LICENSE', 'COPYRIGHT', 'INVOICE', 'VOUCHER', 'WATERMARK_SOURCE', 'CONTRACT');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WatermarkStatus" AS ENUM ('ARCHIVED', 'PENDING_MATCH');

-- CreateEnum
CREATE TYPE "WatermarkKind" AS ENUM ('LISTING', 'DATA', 'DELIST');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "creditCode" TEXT,
    "legalPerson" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "licenseKey" TEXT,
    "certStatus" "CertStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "certRejectReason" TEXT,
    "certDraft" JSONB,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "branch" TEXT,
    "accountNo" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Platform" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "firstBatch" BOOLEAN NOT NULL DEFAULT false,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "syncMode" "SyncMode" NOT NULL DEFAULT 'MANUAL',
    "syncLag" "SyncLag" NOT NULL DEFAULT 'T1',
    "contact" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#86868B',
    "proposed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Platform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Drama" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL DEFAULT '',
    "nameNorm" TEXT NOT NULL,
    "synopsis" TEXT NOT NULL DEFAULT '',
    "genre" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT '英语',
    "episodeCountExpected" INTEGER,
    "coverKey" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "groups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Drama_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL,
    "dramaId" TEXT NOT NULL,
    "no" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "fileKey" TEXT,
    "fileName" TEXT,
    "fileSize" BIGINT,
    "contentType" TEXT,
    "fingerprint" TEXT,
    "reviewStatus" "EpisodeReviewStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "dramaId" TEXT,
    "type" "AssetType" NOT NULL,
    "name" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadSession" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "uploadId" TEXT,
    "purpose" "UploadPurpose" NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "fingerprint" TEXT,
    "partSize" INTEGER,
    "parts" JSONB,
    "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "dramaId" TEXT,
    "episodeNo" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DistributionPlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "dramaId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "round" "PlanRound" NOT NULL,
    "status" "PlanStatus" NOT NULL,
    "assigneeId" TEXT,
    "precheckNote" TEXT,
    "rejectSummary" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "slaDueAt" TIMESTAMP(3),
    "resubmitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanPlatform" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "platformName" TEXT NOT NULL,
    "listingStatus" "ListingStatus" NOT NULL DEFAULT 'PENDING_CONTACT',
    "platformDramaId" TEXT,
    "listingUrl" TEXT,
    "listedAt" TIMESTAMP(3),

    CONSTRAINT "PlanPlatform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareConfig" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "mode" "ShareMode" NOT NULL,
    "clientRate" DECIMAL(6,2) NOT NULL,
    "overRate" DECIMAL(6,2),
    "guaranteeAmount" DECIMAL(18,2),
    "guaranteeCurrency" TEXT,
    "guaranteePeriodDays" INTEGER,
    "reviewStatus" "ShareReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedById" TEXT,
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewLog" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "episodeId" TEXT,
    "episodeNo" INTEGER,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyStat" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "dramaId" TEXT NOT NULL,
    "statDate" DATE NOT NULL,
    "statTimezone" TEXT NOT NULL,
    "contractCode" TEXT NOT NULL DEFAULT '',
    "platformDramaId" TEXT NOT NULL DEFAULT '',
    "titleLocal" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "territory" TEXT NOT NULL DEFAULT '',
    "episodesOnline" INTEGER NOT NULL,
    "views" INTEGER NOT NULL,
    "viewMetricDef" TEXT NOT NULL,
    "uniqueViewers" INTEGER,
    "paidUnlocks" INTEGER,
    "grossRevenue" DECIMAL(18,4),
    "netRevenue" DECIMAL(18,4),
    "currency" TEXT NOT NULL,
    "shareRate" DECIMAL(6,2),
    "mgAmount" DECIMAL(18,2),
    "mgRecouped" DECIMAL(18,2),
    "revenueShareDue" DECIMAL(18,2),
    "dealType" "DealType" NOT NULL,
    "dataSource" "DataSource" NOT NULL,
    "evidenceFiles" TEXT NOT NULL DEFAULT '',
    "evidenceSha256" TEXT NOT NULL DEFAULT '',
    "watermarkId" TEXT,
    "anomalyNote" TEXT NOT NULL DEFAULT '',
    "status" "DailyStatus" NOT NULL DEFAULT 'DRAFT',
    "lagWarning" TEXT,
    "enteredById" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "DailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatermarkShot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "dramaId" TEXT,
    "platformId" TEXT,
    "shotDate" DATE,
    "kind" "WatermarkKind" NOT NULL DEFAULT 'DATA',
    "originalKey" TEXT NOT NULL,
    "watermarkedKey" TEXT,
    "sha256" TEXT NOT NULL DEFAULT '',
    "shortHash" TEXT NOT NULL DEFAULT '',
    "filename" TEXT NOT NULL DEFAULT '',
    "status" "WatermarkStatus" NOT NULL DEFAULT 'PENDING_MATCH',
    "failReason" TEXT,
    "operatorId" TEXT NOT NULL,
    "ticketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatermarkShot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "TicketType" NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'PENDING_CLIENT',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "dramaId" TEXT,
    "planId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "planId" TEXT,
    "title" TEXT NOT NULL,
    "type" "ContractType" NOT NULL DEFAULT 'DISTRIBUTION',
    "status" "ContractStatus" NOT NULL DEFAULT 'APPLYING',
    "note" TEXT NOT NULL DEFAULT '',
    "fileKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractDrama" (
    "contractId" TEXT NOT NULL,
    "dramaId" TEXT NOT NULL,

    CONSTRAINT "ContractDrama_pkey" PRIMARY KEY ("contractId","dramaId")
);

-- CreateTable
CREATE TABLE "SettlementPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cycleType" "CycleType" NOT NULL DEFAULT 'MONTH',
    "customDays" INTEGER,
    "anchorDate" DATE NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSettlementPolicy" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "cycleType" "CycleType" NOT NULL,
    "customDays" INTEGER,
    "anchorDate" DATE NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "carryoverNote" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSettlementPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING_ENTRY',
    "amountCny" DECIMAL(18,2),
    "referenceCny" DECIMAL(18,2),
    "internalNote" TEXT NOT NULL DEFAULT '',
    "clientNote" TEXT NOT NULL DEFAULT '',
    "enteredById" TEXT,
    "enteredAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "deviationPct" DECIMAL(8,2),
    "withdrawalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementLine" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "dramaId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "platformName" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "originalAmount" DECIMAL(18,4) NOT NULL,
    "rateValue" DECIMAL(18,6),
    "rateDate" DATE,
    "rateSource" TEXT NOT NULL DEFAULT '',
    "referenceCny" DECIMAL(18,2),
    "shareMode" TEXT NOT NULL DEFAULT '',
    "clientRate" DECIMAL(6,2),
    "guaranteeAmount" DECIMAL(18,2),
    "lineAmountCny" DECIMAL(18,2),

    CONSTRAINT "SettlementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementLog" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettlementLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "amountCny" DECIMAL(18,2) NOT NULL,
    "status" "SettlementStatus" NOT NULL,
    "invoiceKey" TEXT,
    "invoiceNo" TEXT,
    "invoiceRejectReason" TEXT,
    "voucherKey" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Withdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "pair" TEXT NOT NULL,
    "rateDate" DATE NOT NULL,
    "value" DECIMAL(18,6) NOT NULL,
    "source" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL DEFAULT '',
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsyncTask" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "succeeded" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AsyncTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counter" (
    "id" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE INDEX "Company_certStatus_idx" ON "Company"("certStatus");

-- CreateIndex
CREATE INDEX "Company_ownerId_idx" ON "Company"("ownerId");

-- CreateIndex
CREATE INDEX "Company_name_idx" ON "Company"("name");

-- CreateIndex
CREATE INDEX "BankAccount_companyId_idx" ON "BankAccount"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Platform_code_key" ON "Platform"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Platform_name_key" ON "Platform"("name");

-- CreateIndex
CREATE INDEX "Platform_firstBatch_enabled_sort_idx" ON "Platform"("firstBatch", "enabled", "sort");

-- CreateIndex
CREATE UNIQUE INDEX "Drama_code_key" ON "Drama"("code");

-- CreateIndex
CREATE INDEX "Drama_companyId_updatedAt_idx" ON "Drama"("companyId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "Drama_companyId_createdAt_idx" ON "Drama"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "Drama_companyId_nameNorm_idx" ON "Drama"("companyId", "nameNorm");

-- CreateIndex
CREATE INDEX "Episode_fingerprint_idx" ON "Episode"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_dramaId_no_key" ON "Episode"("dramaId", "no");

-- CreateIndex
CREATE INDEX "Asset_companyId_type_idx" ON "Asset"("companyId", "type");

-- CreateIndex
CREATE INDEX "Asset_dramaId_type_idx" ON "Asset"("dramaId", "type");

-- CreateIndex
CREATE INDEX "UploadSession_companyId_fingerprint_idx" ON "UploadSession"("companyId", "fingerprint");

-- CreateIndex
CREATE INDEX "UploadSession_expiresAt_idx" ON "UploadSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DistributionPlan_code_key" ON "DistributionPlan"("code");

-- CreateIndex
CREATE INDEX "DistributionPlan_companyId_status_idx" ON "DistributionPlan"("companyId", "status");

-- CreateIndex
CREATE INDEX "DistributionPlan_assigneeId_status_idx" ON "DistributionPlan"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "DistributionPlan_dramaId_round_idx" ON "DistributionPlan"("dramaId", "round");

-- CreateIndex
CREATE INDEX "DistributionPlan_status_slaDueAt_idx" ON "DistributionPlan"("status", "slaDueAt");

-- CreateIndex
CREATE INDEX "PlanPlatform_platformId_listingStatus_idx" ON "PlanPlatform"("platformId", "listingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "PlanPlatform_planId_platformId_key" ON "PlanPlatform"("planId", "platformId");

-- CreateIndex
CREATE UNIQUE INDEX "ShareConfig_planId_platformId_key" ON "ShareConfig"("planId", "platformId");

-- CreateIndex
CREATE INDEX "ReviewLog_planId_createdAt_idx" ON "ReviewLog"("planId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStat_recordId_key" ON "DailyStat"("recordId");

-- CreateIndex
CREATE INDEX "DailyStat_dramaId_statDate_idx" ON "DailyStat"("dramaId", "statDate");

-- CreateIndex
CREATE INDEX "DailyStat_companyId_statDate_idx" ON "DailyStat"("companyId", "statDate");

-- CreateIndex
CREATE INDEX "DailyStat_platformId_statDate_idx" ON "DailyStat"("platformId", "statDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStat_platformId_statDate_dramaId_language_key" ON "DailyStat"("platformId", "statDate", "dramaId", "language");

-- CreateIndex
CREATE INDEX "WatermarkShot_dramaId_shotDate_idx" ON "WatermarkShot"("dramaId", "shotDate");

-- CreateIndex
CREATE INDEX "WatermarkShot_status_idx" ON "WatermarkShot"("status");

-- CreateIndex
CREATE INDEX "WatermarkShot_companyId_shotDate_idx" ON "WatermarkShot"("companyId", "shotDate");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_code_key" ON "Ticket"("code");

-- CreateIndex
CREATE INDEX "Ticket_companyId_type_status_idx" ON "Ticket"("companyId", "type", "status");

-- CreateIndex
CREATE INDEX "Ticket_companyId_createdAt_idx" ON "Ticket"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_code_key" ON "Contract"("code");

-- CreateIndex
CREATE INDEX "Contract_companyId_status_idx" ON "Contract"("companyId", "status");

-- CreateIndex
CREATE INDEX "ContractDrama_dramaId_idx" ON "ContractDrama"("dramaId");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementPolicy_companyId_key" ON "SettlementPolicy"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSettlementPolicy_planId_key" ON "ProjectSettlementPolicy"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_code_key" ON "Settlement"("code");

-- CreateIndex
CREATE INDEX "Settlement_companyId_status_idx" ON "Settlement"("companyId", "status");

-- CreateIndex
CREATE INDEX "Settlement_status_idx" ON "Settlement"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_companyId_periodStart_periodEnd_key" ON "Settlement"("companyId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "SettlementLine_settlementId_idx" ON "SettlementLine"("settlementId");

-- CreateIndex
CREATE INDEX "SettlementLine_dramaId_idx" ON "SettlementLine"("dramaId");

-- CreateIndex
CREATE INDEX "SettlementLog_settlementId_createdAt_idx" ON "SettlementLog"("settlementId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Withdrawal_code_key" ON "Withdrawal"("code");

-- CreateIndex
CREATE INDEX "Withdrawal_companyId_status_idx" ON "Withdrawal"("companyId", "status");

-- CreateIndex
CREATE INDEX "ExchangeRate_pair_rateDate_idx" ON "ExchangeRate"("pair", "rateDate");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AsyncTask_ownerId_createdAt_idx" ON "AsyncTask"("ownerId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drama" ADD CONSTRAINT "Drama_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionPlan" ADD CONSTRAINT "DistributionPlan_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionPlan" ADD CONSTRAINT "DistributionPlan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanPlatform" ADD CONSTRAINT "PlanPlatform_planId_fkey" FOREIGN KEY ("planId") REFERENCES "DistributionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanPlatform" ADD CONSTRAINT "PlanPlatform_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareConfig" ADD CONSTRAINT "ShareConfig_planId_fkey" FOREIGN KEY ("planId") REFERENCES "DistributionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareConfig" ADD CONSTRAINT "ShareConfig_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_planId_fkey" FOREIGN KEY ("planId") REFERENCES "DistributionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyStat" ADD CONSTRAINT "DailyStat_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyStat" ADD CONSTRAINT "DailyStat_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyStat" ADD CONSTRAINT "DailyStat_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatermarkShot" ADD CONSTRAINT "WatermarkShot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatermarkShot" ADD CONSTRAINT "WatermarkShot_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatermarkShot" ADD CONSTRAINT "WatermarkShot_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatermarkShot" ADD CONSTRAINT "WatermarkShot_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_planId_fkey" FOREIGN KEY ("planId") REFERENCES "DistributionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_planId_fkey" FOREIGN KEY ("planId") REFERENCES "DistributionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDrama" ADD CONSTRAINT "ContractDrama_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDrama" ADD CONSTRAINT "ContractDrama_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementPolicy" ADD CONSTRAINT "SettlementPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSettlementPolicy" ADD CONSTRAINT "ProjectSettlementPolicy_planId_fkey" FOREIGN KEY ("planId") REFERENCES "DistributionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "Withdrawal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementLine" ADD CONSTRAINT "SettlementLine_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementLine" ADD CONSTRAINT "SettlementLine_dramaId_fkey" FOREIGN KEY ("dramaId") REFERENCES "Drama"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettlementLog" ADD CONSTRAINT "SettlementLog_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsyncTask" ADD CONSTRAINT "AsyncTask_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 剧名模糊搜索。月分区留到数据量上来之后再做，避免 Prisma 迁移被分区表绑死。
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "Drama_nameNorm_trgm" ON "Drama" USING gin ("nameNorm" gin_trgm_ops);

