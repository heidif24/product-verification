CREATE TABLE "ConsumerReport" (
 "id" TEXT NOT NULL, "identityId" TEXT, "publicCode" TEXT, "reason" TEXT NOT NULL,
 "details" TEXT NOT NULL, "contactEmail" TEXT, "status" TEXT NOT NULL DEFAULT 'OPEN',
 "adminNote" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ConsumerReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ConsumerReport_status_createdAt_idx" ON "ConsumerReport"("status","createdAt");
CREATE INDEX "ConsumerReport_identityId_createdAt_idx" ON "ConsumerReport"("identityId","createdAt");
CREATE INDEX "ConsumerReport_publicCode_idx" ON "ConsumerReport"("publicCode");
ALTER TABLE "ConsumerReport" ADD CONSTRAINT "ConsumerReport_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "ProductIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
