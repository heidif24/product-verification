CREATE TABLE "PrivacyRequest" (
 "id" TEXT NOT NULL, "email" TEXT NOT NULL, "requestType" TEXT NOT NULL, "details" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'RECEIVED', "adminNote" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "PrivacyRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PrivacyRequest_status_createdAt_idx" ON "PrivacyRequest"("status","createdAt");
CREATE INDEX "PrivacyRequest_email_createdAt_idx" ON "PrivacyRequest"("email","createdAt");
