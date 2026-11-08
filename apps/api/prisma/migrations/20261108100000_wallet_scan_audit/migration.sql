CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');
CREATE TYPE "WalletEntryType" AS ENUM ('PAYMENT_CREDIT', 'PROMOTION_CREDIT', 'ADMIN_ADJUSTMENT', 'ISSUANCE_DEBIT', 'ISSUANCE_REFUND');

CREATE TABLE "CreditPackage" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "credits" INTEGER NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreditPackage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CreditPackage_credits_positive" CHECK ("credits" > 0),
  CONSTRAINT "CreditPackage_amount_positive" CHECK ("amountMinor" > 0)
);

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "manufacturerId" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'PAYSTACK',
  "reference" TEXT NOT NULL,
  "providerReference" TEXT,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "credits" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payment_amount_positive" CHECK ("amountMinor" > 0),
  CONSTRAINT "Payment_credits_positive" CHECK ("credits" > 0)
);

CREATE TABLE "WalletEntry" (
  "id" TEXT NOT NULL,
  "manufacturerId" TEXT NOT NULL,
  "amountCredits" INTEGER NOT NULL,
  "type" "WalletEntryType" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "actorId" TEXT,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WalletEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WalletEntry_amount_nonzero" CHECK ("amountCredits" <> 0),
  CONSTRAINT "WalletEntry_type_sign" CHECK (
    ("type" IN ('PAYMENT_CREDIT', 'PROMOTION_CREDIT', 'ISSUANCE_REFUND') AND "amountCredits" > 0) OR
    ("type" = 'ISSUANCE_DEBIT' AND "amountCredits" < 0) OR
    ("type" = 'ADMIN_ADJUSTMENT')
  )
);

CREATE UNIQUE INDEX "CreditPackage_name_key" ON "CreditPackage"("name");
CREATE INDEX "CreditPackage_active_createdAt_idx" ON "CreditPackage"("active", "createdAt");
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");
CREATE INDEX "Payment_manufacturerId_createdAt_idx" ON "Payment"("manufacturerId", "createdAt");
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");
CREATE UNIQUE INDEX "WalletEntry_idempotencyKey_key" ON "WalletEntry"("idempotencyKey");
CREATE INDEX "WalletEntry_manufacturerId_createdAt_idx" ON "WalletEntry"("manufacturerId", "createdAt");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "CreditPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "VerificationEvent" ADD COLUMN "sessionHash" TEXT;
ALTER TABLE "VerificationEvent" ADD COLUMN "sessionDate" DATE;
ALTER TABLE "VerificationEvent" ADD COLUMN "isIndependent" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "VerificationEvent" ADD COLUMN "riskLevel" TEXT NOT NULL DEFAULT 'NORMAL';
CREATE INDEX "VerificationEvent_identityId_sessionDate_riskLevel_idx" ON "VerificationEvent"("identityId", "sessionDate", "riskLevel");
CREATE TABLE "ScanSession" (
  "id" TEXT NOT NULL,
  "identityId" TEXT NOT NULL,
  "sessionHash" TEXT NOT NULL,
  "sessionDate" DATE NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScanSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ScanSession_identityId_sessionHash_sessionDate_key" ON "ScanSession"("identityId", "sessionHash", "sessionDate");
CREATE INDEX "ScanSession_identityId_sessionDate_idx" ON "ScanSession"("identityId", "sessionDate");
ALTER TABLE "ScanSession" ADD CONSTRAINT "ScanSession_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "ProductIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConsumerReport" ADD COLUMN "storeName" TEXT;
ALTER TABLE "ConsumerReport" ADD COLUMN "city" TEXT;
ALTER TABLE "ConsumerReport" ADD COLUMN "state" TEXT;
ALTER TABLE "ConsumerReport" ADD COLUMN "purchaseDate" TIMESTAMP(3);
ALTER TABLE "ConsumerReport" ADD COLUMN "evidenceKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "AuditLog" ADD COLUMN "previousHash" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "entryHash" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "metadata" JSONB;
ALTER TABLE "AuditLog" ADD COLUMN "sequence" BIGSERIAL NOT NULL;
CREATE UNIQUE INDEX "AuditLog_entryHash_key" ON "AuditLog"("entryHash");
CREATE UNIQUE INDEX "AuditLog_sequence_key" ON "AuditLog"("sequence");

CREATE TABLE "AuditChainHead" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "lastSequence" BIGINT NOT NULL DEFAULT 0,
  "lastHash" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuditChainHead_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditChainHead_singleton" CHECK ("id" = 1)
);
INSERT INTO "AuditChainHead" ("id", "lastSequence", "lastHash", "updatedAt")
SELECT 1, COALESCE(MAX("sequence"), 0), NULL, CURRENT_TIMESTAMP FROM "AuditLog";

CREATE FUNCTION "reject_pan_immutable_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'PAN ledger and audit records are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "WalletEntry_append_only" BEFORE UPDATE OR DELETE ON "WalletEntry"
  FOR EACH ROW EXECUTE FUNCTION "reject_pan_immutable_mutation"();
CREATE TRIGGER "AuditLog_append_only" BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION "reject_pan_immutable_mutation"();
CREATE FUNCTION "reject_pan_audit_head_delete"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'PAN audit chain head cannot be deleted';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AuditChainHead_no_delete" BEFORE DELETE ON "AuditChainHead"
  FOR EACH ROW EXECUTE FUNCTION "reject_pan_audit_head_delete"();