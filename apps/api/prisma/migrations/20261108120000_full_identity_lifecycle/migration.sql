-- Expand IdentityStatus with full market lifecycle states.
-- Existing rows keep their current values; new values become available immediately.

ALTER TYPE "IdentityStatus" ADD VALUE IF NOT EXISTS 'PRINTED';
ALTER TYPE "IdentityStatus" ADD VALUE IF NOT EXISTS 'QUALITY_CHECKED';
ALTER TYPE "IdentityStatus" ADD VALUE IF NOT EXISTS 'RECALLED';
ALTER TYPE "IdentityStatus" ADD VALUE IF NOT EXISTS 'BLOCKED';
ALTER TYPE "IdentityStatus" ADD VALUE IF NOT EXISTS 'DESTROYED';
ALTER TYPE "IdentityStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
