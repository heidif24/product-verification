ALTER TABLE "IssuanceJob"
  ADD COLUMN "leaseOwner" TEXT,
  ADD COLUMN "leaseUntil" TIMESTAMP(3);

CREATE INDEX "IssuanceJob_status_leaseUntil_idx"
  ON "IssuanceJob"("status", "leaseUntil");
