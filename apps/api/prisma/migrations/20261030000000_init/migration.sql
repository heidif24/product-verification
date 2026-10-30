CREATE TYPE "ManufacturerStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED');
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'OPERATOR', 'ANALYST');
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "IdentityStatus" AS ENUM ('ACTIVE', 'QUARANTINED', 'REVOKED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Manufacturer" (
  "id" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" "ManufacturerStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Manufacturer_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Membership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "manufacturerId" TEXT NOT NULL,
  "role" "MembershipRole" NOT NULL DEFAULT 'OWNER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Product" (
  "id" TEXT NOT NULL,
  "manufacturerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "brand" TEXT,
  "category" TEXT,
  "description" TEXT,
  "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Batch" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "batchCode" TEXT NOT NULL,
  "productionDate" TIMESTAMP(3),
  "expiryDate" TIMESTAMP(3),
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ProductIdentity" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "publicCode" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "status" "IdentityStatus" NOT NULL DEFAULT 'ACTIVE',
  "verificationCount" INTEGER NOT NULL DEFAULT 0,
  "firstVerifiedAt" TIMESTAMP(3),
  "lastVerifiedAt" TIMESTAMP(3),
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductIdentity_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "VerificationEvent" (
  "id" TEXT NOT NULL,
  "identityId" TEXT,
  "outcome" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Manufacturer_slug_key" ON "Manufacturer"("slug");
CREATE UNIQUE INDEX "Membership_userId_manufacturerId_key" ON "Membership"("userId", "manufacturerId");
CREATE INDEX "Membership_manufacturerId_idx" ON "Membership"("manufacturerId");
CREATE INDEX "Product_manufacturerId_createdAt_idx" ON "Product"("manufacturerId", "createdAt");
CREATE UNIQUE INDEX "Batch_productId_batchCode_key" ON "Batch"("productId", "batchCode");
CREATE INDEX "Batch_productId_idx" ON "Batch"("productId");
CREATE UNIQUE INDEX "ProductIdentity_publicCode_key" ON "ProductIdentity"("publicCode");
CREATE UNIQUE INDEX "ProductIdentity_tokenHash_key" ON "ProductIdentity"("tokenHash");
CREATE INDEX "ProductIdentity_batchId_status_idx" ON "ProductIdentity"("batchId", "status");
CREATE INDEX "VerificationEvent_identityId_createdAt_idx" ON "VerificationEvent"("identityId", "createdAt");

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductIdentity" ADD CONSTRAINT "ProductIdentity_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerificationEvent" ADD CONSTRAINT "VerificationEvent_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "ProductIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
