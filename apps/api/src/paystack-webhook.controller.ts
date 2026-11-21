import { Controller, Headers, Post, Req, UnauthorizedException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { Public } from "./auth";
import { PrismaService } from "./prisma.service";
import { appendAudit } from "./audit";

type PaystackWebhookRequest = Request & { rawBody?: Buffer };

@Controller("v1/webhooks/paystack")
export class PaystackWebhookController {
  constructor(private readonly db: PrismaService) {}

  @Post()
  @Public()
  async receive(
    @Req() req: PaystackWebhookRequest,
    @Headers("x-paystack-signature") signature?: string
  ) {
    const secret = process.env.PAYSTACK_SECRET_KEY || "";
    const raw = req.rawBody;
    if (!secret || !raw || !signature || !/^[a-f0-9]{64}$/i.test(signature)) {
      throw new UnauthorizedException("Invalid payment webhook signature.");
    }
    const expected = createHmac("sha512", secret).update(raw).digest();
    let supplied: Buffer;
    try { supplied = Buffer.from(signature, "hex"); } catch { throw new UnauthorizedException("Invalid payment webhook signature."); }
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new UnauthorizedException("Invalid payment webhook signature.");
    }

    let event: any;
    try { event = JSON.parse(raw.toString("utf8")); } catch {
      return { received: true, ignored: true };
    }
    if (event?.event !== "charge.success" || !event?.data?.reference) {
      return { received: true, ignored: true };
    }

    const data = event.data;
    const payment = await this.db.payment.findUnique({ where: { reference: String(data.reference) } });
    if (!payment) return { received: true, ignored: true };
    if (payment.status === "PAID") return { received: true, duplicate: true };
    if (data.status !== "success" || Number(data.amount) !== payment.amountMinor || data.currency !== payment.currency) {
      await this.db.$transaction(async tx => {
        await appendAudit(tx, {
          actor: "PAYSTACK_WEBHOOK",
          action: "PAYMENT_WEBHOOK_MISMATCH",
          targetType: "PAYMENT",
          targetId: payment.id,
          reason: "Signed Paystack success event did not match the expected payment amount, currency or status.",
          metadata: { reference: payment.reference, receivedAmount: data.amount ?? null, receivedCurrency: data.currency ?? null, receivedStatus: data.status ?? null }
        });
      });
      return { received: true, mismatch: true };
    }

    await this.db.$transaction(async tx => {
      const changed = await tx.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: { status: "PAID", providerReference: String(data.id), paidAt: new Date(Number(data.paid_at) || Date.now()) }
      });
      if (!changed.count) return;
      await tx.walletEntry.create({
        data: {
          manufacturerId: payment.manufacturerId,
          amountCredits: payment.credits,
          type: "PAYMENT_CREDIT",
          idempotencyKey: "payment:" + payment.id,
          actorId: "PAYSTACK_WEBHOOK",
          reason: "Signed Paystack webhook settlement for " + payment.reference
        }
      });
      await appendAudit(tx, {
        actor: "PAYSTACK_WEBHOOK",
        action: "WALLET_PAYMENT_CREDITED",
        targetType: "PAYMENT",
        targetId: payment.id,
        reason: payment.credits + " credits settled from signed Paystack webhook.",
        metadata: { reference: payment.reference, providerReference: String(data.id), amountMinor: payment.amountMinor, currency: payment.currency, credits: payment.credits }
      });
    }, { isolationLevel: "Serializable" });
    return { received: true };
  }
}
