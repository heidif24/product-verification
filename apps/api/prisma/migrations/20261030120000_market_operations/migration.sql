CREATE TYPE "IdentityLevel" AS ENUM ('UNIT', 'CARTON');
CREATE TYPE "DocumentReviewStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED');
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
CREATE TYPE "IssuanceJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');

ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Manufacturer" ADD COLUMN "registrationNumber" TEXT, ADD COLUMN "registeredAddress" TEXT, ADD COLUMN "phone" TEXT, ADD COLUMN "website" TEXT, ADD COLUMN "industry" TEXT;
ALTER TABLE "Product" ADD COLUMN "nafdacRegistrationNumber" TEXT, ADD COLUMN "sonCertificateNumber" TEXT;
ALTER TABLE "Batch" ADD COLUMN "cartonCount" INTEGER, ADD COLUMN "unitsPerCarton" INTEGER;
ALTER TABLE "ProductIdentity" ADD COLUMN "level" "IdentityLevel" NOT NULL DEFAULT 'UNIT', ADD COLUMN "parentId" TEXT;
CREATE INDEX "ProductIdentity_parentId_idx" ON "ProductIdentity"("parentId");
CREATE INDEX "ProductIdentity_batchId_level_idx" ON "ProductIdentity"("batchId", "level");

CREATE TABLE "VerificationToken" (
 "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "purpose" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL, "usedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VerificationToken_tokenHash_key" ON "VerificationToken"("tokenHash");
CREATE INDEX "VerificationToken_userId_purpose_expiresAt_idx" ON "VerificationToken"("userId","purpose","expiresAt");
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Facility" (
 "id" TEXT NOT NULL, "manufacturerId" TEXT NOT NULL, "name" TEXT NOT NULL, "facilityType" TEXT NOT NULL,
 "address" TEXT NOT NULL, "city" TEXT NOT NULL, "state" TEXT NOT NULL, "country" TEXT NOT NULL DEFAULT 'Nigeria',
 "isPrimary" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Facility_manufacturerId_idx" ON "Facility"("manufacturerId");
ALTER TABLE "Facility" ADD CONSTRAINT "Facility_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ManufacturerDocument" (
 "id" TEXT NOT NULL, "manufacturerId" TEXT NOT NULL, "kind" TEXT NOT NULL, "fileName" TEXT NOT NULL,
 "mimeType" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL, "storageKey" TEXT NOT NULL,
 "reviewStatus" "DocumentReviewStatus" NOT NULL DEFAULT 'SUBMITTED', "reviewNote" TEXT,
 "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "reviewedAt" TIMESTAMP(3),
 CONSTRAINT "ManufacturerDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ManufacturerDocument_storageKey_key" ON "ManufacturerDocument"("storageKey");
CREATE INDEX "ManufacturerDocument_manufacturerId_reviewStatus_idx" ON "ManufacturerDocument"("manufacturerId","reviewStatus");
ALTER TABLE "ManufacturerDocument" ADD CONSTRAINT "ManufacturerDocument_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Invitation" (
 "id" TEXT NOT NULL, "manufacturerId" TEXT NOT NULL, "email" TEXT NOT NULL, "role" "MembershipRole" NOT NULL,
 "tokenHash" TEXT NOT NULL, "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING', "expiresAt" TIMESTAMP(3) NOT NULL,
 "acceptedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE INDEX "Invitation_manufacturerId_status_idx" ON "Invitation"("manufacturerId","status");
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "IssuanceJob" (
 "id" TEXT NOT NULL, "manufacturerId" TEXT NOT NULL, "batchId" TEXT NOT NULL, "createdById" TEXT NOT NULL,
 "unitQuantity" INTEGER NOT NULL, "cartonQuantity" INTEGER NOT NULL DEFAULT 0,
 "status" "IssuanceJobStatus" NOT NULL DEFAULT 'QUEUED', "progress" INTEGER NOT NULL DEFAULT 0,
 "resultCiphertext" TEXT, "errorMessage" TEXT, "expiresAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "IssuanceJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "IssuanceJob_manufacturerId_createdAt_idx" ON "IssuanceJob"("manufacturerId","createdAt");
CREATE INDEX "IssuanceJob_status_createdAt_idx" ON "IssuanceJob"("status","createdAt");
ALTER TABLE "IssuanceJob" ADD CONSTRAINT "IssuanceJob_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IssuanceJob" ADD CONSTRAINT "IssuanceJob_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductIdentity" ADD CONSTRAINT "ProductIdentity_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProductIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
