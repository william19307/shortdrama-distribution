-- 授权书/版权证明审核状态。已有演示材料视为已通过，避免发行被挡住。
CREATE TYPE "AssetReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Asset" ADD COLUMN "reviewStatus" "AssetReviewStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Asset" ADD COLUMN "reviewedById" TEXT;
ALTER TABLE "Asset" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "Asset" ADD COLUMN "rejectReason" TEXT;

UPDATE "Asset" SET "reviewStatus" = 'APPROVED', "reviewedAt" = CURRENT_TIMESTAMP WHERE "type" IN ('LICENSE', 'COPYRIGHT');

CREATE INDEX "Asset_reviewStatus_idx" ON "Asset"("reviewStatus");
