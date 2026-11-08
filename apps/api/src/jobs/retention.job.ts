/**
 * Retention & deletion job skeleton.
 *
 * Run on a schedule (cron, system timer, or queue worker) against production.
 * Policies below are engineering defaults and MUST be confirmed with privacy counsel
 * under NDPA 2023 / NDPC guidance before enabling destructive deletes.
 *
 * Recommended schedule: daily off-peak (e.g. 02:00 WAT).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Days after which verification events may be anonymised / deleted (draft policy). */
const VERIFICATION_EVENT_RETENTION_DAYS = 365;

/** Days after which expired issuance export ciphertexts may be purged. */
const EXPORT_PAYLOAD_RETENTION_DAYS = 7; // exports already expire at 48h; keep a short buffer

/** Days after a privacy request is marked COMPLETED before the request row itself is purged. */
const PRIVACY_REQUEST_RETENTION_DAYS = 730;

export async function runRetentionJob(now = new Date()) {
  const results = {
    verificationEventsDeleted: 0,
    exportPayloadsCleared: 0,
    privacyRequestsPurged: 0,
    ranAt: now.toISOString(),
  };

  const verificationCutoff = new Date(now);
  verificationCutoff.setDate(verificationCutoff.getDate() - VERIFICATION_EVENT_RETENTION_DAYS);

  // Soft policy: delete old verification events that are no longer needed for risk analysis.
  // Prefer anonymisation (null identityId + scrub sessionHash) if counsel requires longer audit trails.
  const deletedEvents = await prisma.verificationEvent.deleteMany({
    where: {
      createdAt: { lt: verificationCutoff },
      // Keep high-risk events longer if desired — adjust filter after legal review.
      riskLevel: "NORMAL",
    },
  });
  results.verificationEventsDeleted = deletedEvents.count;

  const exportCutoff = new Date(now);
  exportCutoff.setDate(exportCutoff.getDate() - EXPORT_PAYLOAD_RETENTION_DAYS);

  const clearedExports = await prisma.issuanceJob.updateMany({
    where: {
      status: { in: ["COMPLETED", "FAILED", "EXPIRED"] },
      expiresAt: { lt: exportCutoff },
      resultCiphertext: { not: null },
    },
    data: {
      resultCiphertext: null,
    },
  });
  results.exportPayloadsCleared = clearedExports.count;

  const privacyCutoff = new Date(now);
  privacyCutoff.setDate(privacyCutoff.getDate() - PRIVACY_REQUEST_RETENTION_DAYS);

  const purgedPrivacy = await prisma.privacyRequest.deleteMany({
    where: {
      status: "COMPLETED",
      updatedAt: { lt: privacyCutoff },
    },
  });
  results.privacyRequestsPurged = purgedPrivacy.count;

  // Always record that the job ran (use existing audit machinery in production wiring).
  // await writeAudit({ actor: "system:retention", action: "RETENTION_JOB_RAN", ... });

  return results;
}

// Allow direct execution for manual / cron use:
//   node -r ts-node/register src/jobs/retention.job.ts
if (require.main === module) {
  runRetentionJob()
    .then((r) => {
      console.log(JSON.stringify(r, null, 2));
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
