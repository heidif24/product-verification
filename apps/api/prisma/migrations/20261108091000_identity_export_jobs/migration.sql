ALTER TABLE "ProductIdentity" ALTER COLUMN "status" SET DEFAULT 'GENERATED';
ALTER TABLE "ProductIdentity" ADD COLUMN "issuanceJobId" TEXT;

CREATE INDEX "ProductIdentity_issuanceJobId_status_idx" ON "ProductIdentity"("issuanceJobId", "status");

ALTER TABLE "ProductIdentity" ADD CONSTRAINT "ProductIdentity_issuanceJobId_fkey" FOREIGN KEY ("issuanceJobId") REFERENCES "IssuanceJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;