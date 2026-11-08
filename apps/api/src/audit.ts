import { createHmac, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

export type AuditRecord = {
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  metadata?: Prisma.InputJsonValue;
};

type HashedAuditRecord = AuditRecord & {
  id: string;
  previousHash: string | null;
  entryHash: string;
  createdAt: Date;
};

function auditKey() {
  const key = process.env.AUDIT_HMAC_KEY || "";
  if (key.length < 32) throw new Error("AUDIT_HMAC_KEY must contain at least 32 characters.");
  return key;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([name, item]) => [name, stableValue(item)]));
  }
  return value;
}

function hashRecord(record: Omit<HashedAuditRecord, "entryHash">, key: string) {
  const canonical = JSON.stringify([
    record.id,
    record.actor,
    record.action,
    record.targetType,
    record.targetId,
    record.reason,
    record.createdAt.toISOString(),
    record.previousHash,
    stableValue(record.metadata ?? null)
  ]);
  return createHmac("sha256", key).update(canonical).digest("hex");
}

export async function appendAudit(tx: Prisma.TransactionClient, entry: AuditRecord) {
  const key = auditKey();
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(619847231)`;
  await tx.$queryRaw`SELECT "id" FROM "AuditChainHead" WHERE "id" = 1 FOR UPDATE`;
  const head = await tx.auditChainHead.findUnique({ where: { id: 1 }, select: { lastHash: true } });
  if (!head) throw new Error("Audit chain head is missing; refusing to append an unanchored record.");
  const record = {
    id: randomUUID(),
    ...entry,
    previousHash: head?.lastHash ?? null,
    createdAt: new Date()
  };
  const entryHash = hashRecord(record, key);
  const created = await tx.auditLog.create({ data: { ...record, entryHash } });
  await tx.auditChainHead.update({ where: { id: 1 }, data: { lastSequence: created.sequence, lastHash: entryHash } });
}

export function verifyAuditChain(entries: Array<Omit<HashedAuditRecord, "entryHash"> & { entryHash: string }>) {
  const key = auditKey();
  let previousHash: string | null = null;
  for (const entry of entries) {
    if (entry.previousHash !== previousHash || hashRecord(entry, key) !== entry.entryHash) return false;
    previousHash = entry.entryHash;
  }
  return true;
}