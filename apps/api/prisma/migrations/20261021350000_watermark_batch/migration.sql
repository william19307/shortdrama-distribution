ALTER TABLE "WatermarkShot" ADD COLUMN "batchNo" TEXT NOT NULL DEFAULT '';

CREATE INDEX "WatermarkShot_batchNo_idx" ON "WatermarkShot"("batchNo");
