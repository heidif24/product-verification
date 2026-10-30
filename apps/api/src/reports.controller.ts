import { Body, Controller, Param, Post, BadRequestException } from "@nestjs/common";
import { Public } from "./auth";
import { BadRequestException } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { createHmac } from "node:crypto";
import { PrismaService } from "./prisma.service";

const digest = (token: string) => createHmac("sha256", process.env.TOKEN_PEPPER!).update(token).digest("hex");
const reasons = ["SUSPECTED_COUNTERFEIT", "PRODUCT_MISMATCH", "DAMAGED_PACKAGING", "DUPLICATE_OR_UNEXPECTED_SCAN", "OTHER"];

@Controller()
export class ConsumerReportController {
  constructor(private db: PrismaService) {}
  private async save(identityId: string | null, publicCode: string | null, body: { reason?: string; details?: string; contactEmail?: string }) {
    const details = body.details?.trim() || "";
    const contactEmail = body.contactEmail?.trim().toLowerCase() || null;
    if (!reasons.includes(body.reason || "") || details.length < 10 || details.length > 1500 || (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))) {
      throw new BadRequestException("Choose a report reason, provide 10 to 1,500 characters of detail and enter a valid optional email.");
    }
    const report = await this.db.consumerReport.create({ data: { identityId, publicCode, reason: body.reason!, details, contactEmail } });
    return { received: true, reference: report.id, message: "Thank you. Your concern has been sent to PAN's review team." };
  }
  @Post("v1/verify/code/:code/report")
  @Public()
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  async byCode(@Param("code") code: string, @Body() body: { reason?: string; details?: string; contactEmail?: string }) {
    const normalized = code.trim().toUpperCase().slice(0, 64);
    if (!normalized) throw new BadRequestException("A PAN product code is required.");
    const identity = await this.db.productIdentity.findUnique({ where: { publicCode: normalized }, select: { id: true, publicCode: true } });
    return this.save(identity?.id || null, normalized, body);
  }
  @Post("v1/verify/:token/report")
  @Public()
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  async byToken(@Param("token") token: string, @Body() body: { reason?: string; details?: string; contactEmail?: string }) {
    if (!token || token.length > 128) throw new BadRequestException("Invalid verification reference.");
    const identity = await this.db.productIdentity.findUnique({ where: { tokenHash: digest(token) }, select: { id: true, publicCode: true } });
    const safeReference = identity?.publicCode || "UNRECOGNISED-" + digest(token).slice(0, 20).toUpperCase();
    return this.save(identity?.id || null, safeReference, body);
  }
}

@Controller()
export class PrivacyRequestController {
  constructor(private db: PrismaService) {}
  @Post("v1/privacy/requests")
  @Public()
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  async create(@Body() body: { email?: string; requestType?: string; details?: string }) {
    const email = body.email?.trim().toLowerCase() || "";
    const details = body.details?.trim() || "";
    const allowed = ["ACCESS", "CORRECTION", "DELETION", "RESTRICTION", "OBJECTION", "PORTABILITY"];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !allowed.includes(body.requestType || "") || details.length < 10 || details.length > 1500) {
      throw new BadRequestException("Enter a valid email, choose a request type and provide 10 to 1,500 characters of detail.");
    }
    const request = await this.db.privacyRequest.create({ data: { email, requestType: body.requestType!, details } });
    return { received: true, reference: request.id, status: request.status, message: "Your privacy request has been received. PAN may contact you to verify your identity before acting on it." };
  }
}
