ALTER TABLE "PrivacyRequest"
  ADD COLUMN "completedAt" TIMESTAMP(3);

UPDATE "PrivacyRequest"
SET "completedAt" = "updatedAt"
WHERE "status" = 'COMPLETED' AND "completedAt" IS NULL;
