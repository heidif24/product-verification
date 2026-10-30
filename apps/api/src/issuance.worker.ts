import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { createCipheriv, createHmac, randomBytes, randomUUID } from "node:crypto";
import { PrismaService } from "./prisma.service";
import * as QRCode from "qrcode";

type ExportAsset = { code: string; level: "UNIT" | "CARTON"; verifyUrl: string; parentCode: string | null };
const digest = (token: string) => createHmac("sha256", process.env.TOKEN_PEPPER!).update(token).digest("hex");
function encrypt(value: unknown) {
  const raw = process.env.EXPORT_ENCRYPTION_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(raw)) throw new Error("EXPORT_ENCRYPTION_KEY must be 32 random bytes encoded as 64 hexadecimal characters.");
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", Buffer.from(raw, "hex"), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

@Injectable()
export class IssuanceWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IssuanceWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(private db: PrismaService) {}
  onModuleInit() { this.timer = setInterval(() => void this.processNext(), 1500); void this.processNext(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  private async processNext() {
    if (this.running) return;
    this.running = true;
    try {
      await this.db.issuanceJob.updateMany({ where: { status: "PROCESSING", updatedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } }, data: { status: "QUEUED" } });
      const candidate = await this.db.issuanceJob.findFirst({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" } });
      if (!candidate) return;
      const claimed = await this.db.issuanceJob.updateMany({ where: { id: candidate.id, status: "QUEUED" }, data: { status: "PROCESSING" } });
      if (!claimed.count) return;
      await this.processJob(candidate.id);
    } catch (error) {
      this.logger.error("Issuance worker cycle failed", error instanceof Error ? error.stack : String(error));
    } finally { this.running = false; }
  }
  private async processJob(jobId: string) {
    try {
      const job = await this.db.issuanceJob.findUnique({ where: { id: jobId }, include: { batch: { include: { product: true } } } });
      if (!job) return;
      const baseUrl = (process.env.PUBLIC_VERIFY_URL || "http://localhost:3001").replace(/\/$/, "");
      const cartons: Array<{ id: string; code: string; token: string }> = [];
      const assets: ExportAsset[] = [];
      for (let i = 0; i < job.cartonQuantity; i++) {
        const token = randomBytes(32).toString("base64url"), code = "PANC-" + randomBytes(10).toString("hex").toUpperCase();
        cartons.push({ id: randomUUID(), code, token });
      }
      if (cartons.length) {
        cartons.forEach(c => assets.push({ code: c.code, level: "CARTON", verifyUrl: baseUrl + "/v/" + c.token, parentCode: null }));
      }
      const unitRecords: Array<{ batchId: string; publicCode: string; tokenHash: string; level: "UNIT"; parentId: string | null }> = [];
      const unitAssets: ExportAsset[] = [];
      for (let i = 0; i < job.unitQuantity; i++) {
        const token = randomBytes(32).toString("base64url"), code = "PANU-" + randomBytes(10).toString("hex").toUpperCase();
        const cartonIndex = job.cartonQuantity > 0 ? Math.floor(i / Math.max(1, job.batch.unitsPerCarton || 1)) : -1;
        const carton = cartonIndex >= 0 ? cartons[Math.min(cartonIndex, cartons.length - 1)] : undefined;
        unitRecords.push({ batchId: job.batchId, publicCode: code, tokenHash: digest(token), level: "UNIT", parentId: carton?.id || null });
        unitAssets.push({ code, level: "UNIT", verifyUrl: baseUrl + "/v/" + token, parentCode: carton?.code || null });
      }
      await this.db.issuanceJob.update({ where: { id: jobId }, data: { progress: 25 } });
      await this.db.$transaction(async tx => {
        if (cartons.length) await tx.productIdentity.createMany({ data: cartons.map(c => ({ id: c.id, batchId: job.batchId, publicCode: c.code, tokenHash: digest(c.token), level: "CARTON" })) });
        for (let offset = 0; offset < unitRecords.length; offset += 1000) await tx.productIdentity.createMany({ data: unitRecords.slice(offset, offset + 1000) });
        await tx.issuanceJob.update({ where: { id: jobId }, data: { progress: 90 } });
      }, { timeout: 120000 });
      assets.push(...unitAssets);
      const ciphertext = encrypt({ assets, product: job.batch.product.name, batchCode: job.batch.batchCode, expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() });
      await this.db.issuanceJob.update({ where: { id: jobId }, data: { status: "COMPLETED", progress: 100, resultCiphertext: ciphertext, expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) } });
    } catch (error) {
      this.logger.error("Issuance job failed: " + jobId, error instanceof Error ? error.stack : String(error));
      await this.db.issuanceJob.update({ where: { id: jobId }, data: { status: "FAILED", errorMessage: "Issuance could not be completed. Contact PAN support with the job reference." } }).catch(() => undefined);
    }
  }
}
