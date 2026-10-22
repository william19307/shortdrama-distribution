-- 商务负责的客户。运营负责人仍用 ownerId，两者互不影响。
ALTER TABLE "Company" ADD COLUMN "bdId" TEXT;

CREATE INDEX "Company_bdId_idx" ON "Company"("bdId");

ALTER TABLE "Company" ADD CONSTRAINT "Company_bdId_fkey" FOREIGN KEY ("bdId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
