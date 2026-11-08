import { Body, Controller, Get, Post, Put, Delete, Param, Query, Req, UseGuards, Injectable, Inject, BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtService } from "@nestjs/jwt";
import { createHmac, randomBytes } from "node:crypto";
import * as bcrypt from "bcryptjs";
import type { Request } from "express";
import { PrismaService } from "./prisma.service";
import { appendAudit, verifyAuditChain } from "./audit";
import { PAYMENT_PROVIDER, PaymentProvider } from "./payments.service";
import { AuthRequest, Public } from "./auth";
import { sendPanEmail } from "./mailer";
import { confirmPrivateUpload, createPrivateDownloadUrl, createPrivateUploadUrl, privateDocumentKey } from "./storage";

const hash = (value: string) => createHmac("sha256", process.env.TOKEN_PEPPER!).update(value).digest("hex");
const roles = ["OWNER", "ADMIN", "OPERATOR", "ANALYST"] as const;
type Role = typeof roles[number] | "FINANCE" | "SUPPORT";

async function workspaceRole(db: PrismaService, req: AuthRequest, allowed: Role[]) {
  const membership = await db.membership.findUnique({ where: { userId_manufacturerId: { userId: req.user.sub, manufacturerId: req.user.manufacturerId } } });
  if (!membership || !allowed.includes(membership.role as Role)) throw new ForbiddenException("Your workspace role does not permit this action.");
  return membership;
}

@Injectable()
export class SuperAdminGuard {
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest() as AuthRequest;
    if (req.user?.role !== "SUPER_ADMIN" || !req.user?.sub) throw new ForbiddenException("Super administrator access is required.");
    return true;
  }
}

@Controller()
export class SuperAdminAuthController {
  constructor(private jwt: JwtService) {}
  @Post("v1/super-admin/auth/login")
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() body: { email?: string; password?: string }) {
    const email = body.email?.trim().toLowerCase() || "";
    const configuredEmail = (process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
    const passwordHash = process.env.SUPER_ADMIN_PASSWORD_HASH || "";
    if (!configuredEmail || !passwordHash || email !== configuredEmail || !body.password || !(await bcrypt.compare(body.password, passwordHash))) {
      throw new UnauthorizedException("Administrator email or password is incorrect.");
    }
    const accessToken = this.jwt.sign({ sub: "pan-super-admin", manufacturerId: "", role: "SUPER_ADMIN", superAdmin: true }, { expiresIn: "30m" });
    return { accessToken, expiresIn: 1800, role: "SUPER_ADMIN" };
  }
}

@Controller("v1/super-admin")
@UseGuards(SuperAdminGuard)
export class SuperAdminController {
  constructor(private db: PrismaService) {}
  @Get("overview")
  async overview() {
    const [companies, pending, products, batches, identities, scans, quarantined] = await Promise.all([
      this.db.manufacturer.count(), this.db.manufacturer.count({ where: { status: "PENDING" } }),
      this.db.product.count(), this.db.batch.count(), this.db.productIdentity.count(),
      this.db.verificationEvent.count(), this.db.productIdentity.count({ where: { status: "QUARANTINED" } })
    ]);
    return { companies, pending, products, batches, identities, scans, quarantined };
  }
  @Get("scan-risk")
  scanRisk() {
    return this.db.verificationEvent.findMany({
      where: { riskLevel: "HIGH", identityId: { not: null } },
      select: { id: true, outcome: true, riskLevel: true, createdAt: true, identity: { select: { publicCode: true, verificationCount: true, batch: { select: { batchCode: true, product: { select: { name: true, manufacturer: { select: { legalName: true } } } } } } } },
      orderBy: { createdAt: "desc" },
      take: 200
    });
  }
  @Get("companies")
  async companies(@Query("status") status = "PENDING", @Query("q") q = "") {
    const where: any = {};
    if (["PENDING", "APPROVED", "SUSPENDED"].includes(status)) where.status = status;
    if (q.trim()) where.OR = [{ legalName: { contains: q.trim(), mode: "insensitive" } }, { registrationNumber: { contains: q.trim(), mode: "insensitive" } }];
    return this.db.manufacturer.findMany({ where, include: { _count: { select: { products: true, memberships: true, facilities: true, documents: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  }
  @Get("companies/:id")
  async company(@Param("id") id: string) {
    const company = await this.db.manufacturer.findUnique({ where: { id }, include: {
      facilities: { orderBy: { createdAt: "asc" } },
      documents: { orderBy: { uploadedAt: "desc" } },
      memberships: { include: { user: { select: { id: true, fullName: true, email: true, emailVerifiedAt: true } } } },
      products: { include: { _count: { select: { batches: true } } }, orderBy: { createdAt: "desc" } },
      _count: { select: { products: true, memberships: true, facilities: true, documents: true } }
    } });
    if (!company) throw new NotFoundException("Company workspace not found.");
    return { ...company, documents: await Promise.all(company.documents.map(async d => ({ ...d, downloadUrl: await createPrivateDownloadUrl(d.storageKey) }))) };
  }
  @Post("companies/:id/status")
  async companyStatus(@Param("id") id: string, @Body() body: { status?: string; reason?: string }) {
    const status = body.status, reason = body.reason?.trim();
    if (!["APPROVED", "SUSPENDED", "PENDING"].includes(status || "") || !reason || reason.length < 10) throw new BadRequestException("Choose a valid status and provide a review reason of at least 10 characters.");
    return this.db.$transaction(async tx => {
      const previous = await tx.manufacturer.findUnique({ where: { id }, select: { status: true } });
      const row = await tx.manufacturer.update({ where: { id }, data: { status: status as any } });
      await appendAudit(tx, { actor: "SUPER_ADMIN", action: "COMPANY_STATUS_" + status, targetType: "MANUFACTURER", targetId: id, reason, metadata: { before: { status: previous?.status ?? null }, after: { status: row.status } } });
      return { id: row.id, legalName: row.legalName, status: row.status };
    });
  }
  @Get("credit-packages")
  creditPackages() {
    return this.db.creditPackage.findMany({ orderBy: [{ active: "desc" }, { credits: "asc" }] });
  }
  @Post("credit-packages")
  async createCreditPackage(@Body() body: { name?: string; credits?: number; amountMinor?: number; reason?: string }) {
    const name = body.name?.trim(), credits = Number(body.credits), amountMinor = Number(body.amountMinor), reason = body.reason?.trim();
    if (!name || name.length > 80 || !Number.isInteger(credits) || credits < 1 || credits > 10000000 || !Number.isInteger(amountMinor) || amountMinor < 100 || amountMinor > 1000000000 || !reason || reason.length < 10) throw new BadRequestException("Enter a package name, positive credit and NGN amounts, and a reason of at least 10 characters.");
    return this.db.$transaction(async tx => {
      const pack = await tx.creditPackage.create({ data: { name, credits, amountMinor, currency: "NGN" } });
      await appendAudit(tx, { actor: "SUPER_ADMIN", action: "CREDIT_PACKAGE_CREATED", targetType: "CREDIT_PACKAGE", targetId: pack.id, reason });
      return pack;
    });
  }
  @Put("credit-packages/:id")
  async updateCreditPackage(@Param("id") id: string, @Body() body: { name?: string; credits?: number; amountMinor?: number; active?: boolean; reason?: string }) {
    const reason = body.reason?.trim();
    if (!reason || reason.length < 10 || (body.name !== undefined && (!body.name.trim() || body.name.trim().length > 80)) || (body.credits !== undefined && (!Number.isInteger(body.credits) || body.credits < 1 || body.credits > 10000000)) || (body.amountMinor !== undefined && (!Number.isInteger(body.amountMinor) || body.amountMinor < 100 || body.amountMinor > 1000000000)) || (body.active !== undefined && typeof body.active !== "boolean")) throw new BadRequestException("Provide valid package values and a reason of at least 10 characters.");
    return this.db.$transaction(async tx => {
      const pack = await tx.creditPackage.update({ where: { id }, data: { ...(body.name !== undefined ? { name: body.name.trim() } : {}), ...(body.credits !== undefined ? { credits: body.credits } : {}), ...(body.amountMinor !== undefined ? { amountMinor: body.amountMinor } : {}), ...(body.active !== undefined ? { active: body.active } : {}) } });
      await appendAudit(tx, { actor: "SUPER_ADMIN", action: "CREDIT_PACKAGE_UPDATED", targetType: "CREDIT_PACKAGE", targetId: id, reason });
      return pack;
    });
  }
  @Post("companies/:id/promotional-credit")
  async grantPromotionalCredit(@Param("id") id: string, @Body() body: { amountCredits?: number; reason?: string }) {
    const amountCredits = Number(body.amountCredits ?? 100000), reason = body.reason?.trim();
    if (!Number.isInteger(amountCredits) || amountCredits < 1 || amountCredits > 1000000 || !reason || reason.length < 10) throw new BadRequestException("Provide a promotional allocation up to 1,000,000 credits and an audit reason.");
    try {
      return await this.db.$transaction(async tx => {
        const company = await tx.manufacturer.findUnique({ where: { id }, select: { id: true, status: true } });
        if (!company) throw new NotFoundException("Company workspace not found.");
        if (company.status !== "APPROVED") throw new BadRequestException("Promotional credits are available only to approved manufacturers.");
        const entry = await tx.walletEntry.create({ data: { manufacturerId: id, amountCredits, type: "PROMOTION_CREDIT", idempotencyKey: "promotion:first-allocation:" + id, actorId: "SUPER_ADMIN", reason } });
        await appendAudit(tx, { actor: "SUPER_ADMIN", action: "PROMOTIONAL_CREDIT_GRANTED", targetType: "MANUFACTURER", targetId: id, reason: `${amountCredits} credits: ${reason}` });
        return { granted: entry.amountCredits, entryId: entry.id };
      }, { isolationLevel: "Serializable" });
    } catch (error: any) {
      if (error?.code === "P2002") throw new BadRequestException("This manufacturer has already received its promotional credit allocation.");
      throw error;
    }
  }
  @Post("companies/:id/wallet-adjustments")
  async adjustCompanyWallet(@Param("id") id: string, @Body() body: { amountCredits?: number; idempotencyKey?: string; reason?: string }) {
    const amountCredits = Number(body.amountCredits), reason = body.reason?.trim(), idempotencyKey = body.idempotencyKey?.trim();
    if (!Number.isInteger(amountCredits) || amountCredits === 0 || Math.abs(amountCredits) > 10000000 || !idempotencyKey || !/^[A-Za-z0-9._:-]{8,100}$/.test(idempotencyKey) || !reason || reason.length < 10) throw new BadRequestException("Provide a nonzero adjustment up to 10,000,000 credits, unique reference and reason.");
    return this.db.$transaction(async tx => {
      const company = await tx.manufacturer.findUnique({ where: { id }, select: { id: true } });
      if (!company) throw new NotFoundException("Company workspace not found.");
      const current = await tx.walletEntry.aggregate({ where: { manufacturerId: id }, _sum: { amountCredits: true } });
      if ((current._sum.amountCredits || 0) + amountCredits < 0) throw new BadRequestException("This adjustment would make the wallet balance negative.");
      const entry = await tx.walletEntry.create({ data: { manufacturerId: id, amountCredits, type: "ADMIN_ADJUSTMENT", idempotencyKey: "admin-adjustment:" + idempotencyKey, actorId: "SUPER_ADMIN", reason } });
      await appendAudit(tx, { actor: "SUPER_ADMIN", action: "WALLET_ADJUSTED", targetType: "MANUFACTURER", targetId: id, reason: `${amountCredits} credits: ${reason}`, metadata: { beforeBalance: current._sum.amountCredits || 0, amountCredits, afterBalance: (current._sum.amountCredits || 0) + amountCredits, idempotencyKey } });
      return { amountCredits: entry.amountCredits, entryId: entry.id };
    }, { isolationLevel: "Serializable" });
  }
  @Post("documents/:id/review")
  async reviewDocument(@Param("id") id: string, @Body() body: { status?: string; note?: string }) {
    if (!["UNDER_REVIEW", "ACCEPTED", "REJECTED"].includes(body.status || "")) throw new BadRequestException("Choose a valid document review status.");
    return this.db.$transaction(async tx => {
      const document = await tx.manufacturerDocument.update({ where: { id }, data: { reviewStatus: body.status as any, reviewNote: body.note?.trim() || null, reviewedAt: new Date() } });
      await appendAudit(tx, { actor: "SUPER_ADMIN", action: "DOCUMENT_" + body.status, targetType: "MANUFACTURER_DOCUMENT", targetId: id, reason: body.note?.trim() || "Document review status updated." });
      return document;
    });
  }
  @Get("identities")
  async identities(@Query("q") q = "", @Query("status") status = "") {
    const where: any = {};
    if (q.trim()) where.publicCode = { contains: q.trim().toUpperCase(), mode: "insensitive" };
    if (["ACTIVE", "QUARANTINED", "REVOKED"].includes(status)) where.status = status;
    return this.db.productIdentity.findMany({ where, select: { id: true, publicCode: true, level: true, status: true, verificationCount: true, issuedAt: true, batch: { select: { batchCode: true, product: { select: { name: true, manufacturer: { select: { id: true, legalName: true } } } } } }, carton: { select: { publicCode: true } }, _count: { select: { containedUnits: true } } }, orderBy: { issuedAt: "desc" }, take: 100 });
  }
  @Post("identities/:id/:action")
  async identityAction(@Param("id") id: string, @Param("action") action: string, @Body() body: { reason?: string }) {
    const state: Record<string, "ACTIVE" | "QUARANTINED" | "REVOKED"> = { release: "ACTIVE", quarantine: "QUARANTINED", revoke: "REVOKED" };
    const status = state[action], reason = body.reason?.trim();
    if (!status || !reason || reason.length < 10) throw new BadRequestException("Choose release, quarantine or revoke and provide a reason.");
    return this.db.$transaction(async tx => {
      const previous = await tx.productIdentity.findUnique({ where: { id }, select: { status: true } });
      const identity = await tx.productIdentity.update({ where: { id }, data: { status }, select: { id: true, publicCode: true, level: true, status: true } });
      await appendAudit(tx, { actor: "SUPER_ADMIN", action: "IDENTITY_" + action.toUpperCase(), targetType: "PRODUCT_IDENTITY", targetId: id, reason, metadata: { before: { status: previous?.status ?? null }, after: { status: identity.status } } });
      return identity;
    });
  }
  @Get("reports")
  async reports(@Query("status") status = "") {
    const where = status ? { status } : {};
    return this.db.consumerReport.findMany({
      where,
      include: {
        identity: {
          select: {
            publicCode: true,
            batch: { select: { batchCode: true, product: { select: { name: true, manufacturer: { select: { legalName: true } } } } } }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 150
    });
  }
  @Post("reports/:id/status")
  async updateReport(@Param("id") id: string, @Body() body: { status?: string; note?: string }) {
    if (!["IN_REVIEW", "CONFIRMED_ISSUE", "RESOLVED", "FALSE_REPORT", "DISMISSED"].includes(body.status || "")) throw new BadRequestException("Choose a valid report status.");
    return this.db.$transaction(async tx => {
      const previous = await tx.consumerReport.findUnique({ where: { id }, select: { status: true } });
      const report = await tx.consumerReport.update({ where: { id }, data: { status: body.status!, adminNote: body.note?.trim() || null } });
      await appendAudit(tx, { actor: "SUPER_ADMIN", action: "CONSUMER_REPORT_" + body.status, targetType: "CONSUMER_REPORT", targetId: id, reason: body.note?.trim() || "Consumer report status updated.", metadata: { before: { status: previous?.status ?? null }, after: { status: report.status } } });
      return report;
    });
  }
  @Get("privacy-requests")
  privacyRequests(@Query("status") status = "") {
    const where = status ? { status } : {};
    return this.db.privacyRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  }
  @Post("privacy-requests/:id/status")
  async updatePrivacyRequest(@Param("id") id: string, @Body() body: { status?: string; note?: string }) {
    if (!["IN_REVIEW", "COMPLETED", "REJECTED"].includes(body.status || "")) throw new BadRequestException("Choose a valid privacy request status.");
    return this.db.$transaction(async tx => {
      const previous = await tx.privacyRequest.findUnique({ where: { id }, select: { status: true } });
      const request = await tx.privacyRequest.update({ where: { id }, data: { status: body.status!, adminNote: body.note?.trim() || null } });
      await appendAudit(tx, { actor: "SUPER_ADMIN", action: "PRIVACY_REQUEST_" + body.status, targetType: "PRIVACY_REQUEST", targetId: id, reason: body.note?.trim() || "Privacy request status updated.", metadata: { before: { status: previous?.status ?? null }, after: { status: request.status } } });
      return request;
    });
  }
  @Get("audit")
  async audit(@Query("limit") limit = "100") {
    const entries = await this.db.auditLog.findMany({ orderBy: { sequence: "desc" }, take: Math.min(250, Math.max(1, Number(limit) || 100)) });
    return entries.map(entry => ({ ...entry, sequence: entry.sequence.toString() }));
  }
  @Get("audit/integrity")
  async auditIntegrity() {
    const [entries, legacyEntries, head] = await Promise.all([
      this.db.auditLog.findMany({ where: { entryHash: { not: null } }, orderBy: { sequence: "asc" } }),
      this.db.auditLog.count({ where: { entryHash: null } }),
      this.db.auditChainHead.findUnique({ where: { id: 1 } })
    ]);
    const last = entries[entries.length - 1];
    const headMatches = last ? head?.lastHash === last.entryHash && head.lastSequence === last.sequence : !head?.lastHash;
    return { valid: verifyAuditChain(entries as any) && headMatches, chainedEntries: entries.length, legacyEntries, headSequence: head?.lastSequence.toString() || "0" };
  }
}

@Controller("v1/manufacturer")
export class ManufacturerOperationsController {
  constructor(private db: PrismaService, @Inject(PAYMENT_PROVIDER) private payments: PaymentProvider) {}
  @Get("profile")
  async profile(@Req() req: AuthRequest) {
    await workspaceRole(this.db, req, [...roles]);
    return this.db.manufacturer.findUnique({ where: { id: req.user.manufacturerId }, include: { _count: { select: { facilities: true, documents: true, memberships: true } } } });
  }
  @Put("profile")
  async updateProfile(@Req() req: AuthRequest, @Body() body: { legalName?: string; registrationNumber?: string; registeredAddress?: string; phone?: string; website?: string; industry?: string }) {
    await workspaceRole(this.db, req, ["OWNER", "ADMIN"]);
    if (body.legalName !== undefined && body.legalName.trim().length < 2) throw new BadRequestException("Enter the registered company name.");
    const current = await this.db.manufacturer.findUnique({ where: { id: req.user.manufacturerId } });
    if (!current) throw new NotFoundException("Company workspace not found.");
    const identityChanged = (body.legalName !== undefined && body.legalName.trim() !== current.legalName) || (body.registrationNumber !== undefined && body.registrationNumber.trim() !== (current.registrationNumber || ""));
    return this.db.$transaction(async tx => {
      const updated = await tx.manufacturer.update({ where: { id: req.user.manufacturerId }, data: {
        ...(body.legalName !== undefined ? { legalName: body.legalName.trim() } : {}),
        ...(body.registrationNumber !== undefined ? { registrationNumber: body.registrationNumber.trim() || null } : {}),
        ...(body.registeredAddress !== undefined ? { registeredAddress: body.registeredAddress.trim() || null } : {}),
        ...(body.phone !== undefined ? { phone: body.phone.trim() || null } : {}),
        ...(body.website !== undefined ? { website: body.website.trim() || null } : {}),
        ...(body.industry !== undefined ? { industry: body.industry.trim() || null } : {}),
        ...(identityChanged ? { status: "PENDING" } : {})
      } });
      if (identityChanged) await appendAudit(tx, { actor: req.user.sub, action: "PRODUCER_IDENTITY_DETAILS_CHANGED", targetType: "MANUFACTURER", targetId: current.id, reason: "Legal company name or registration reference changed; workspace returned to PAN review." });
      return updated;
    });
  }
  @Get("facilities")
  async facilities(@Req() req: AuthRequest) {
    await workspaceRole(this.db, req, [...roles]);
    return this.db.facility.findMany({ where: { manufacturerId: req.user.manufacturerId }, orderBy: { createdAt: "asc" } });
  }
  @Post("facilities")
  async createFacility(@Req() req: AuthRequest, @Body() body: { name?: string; facilityType?: string; address?: string; city?: string; state?: string; country?: string; isPrimary?: boolean }) {
    await workspaceRole(this.db, req, ["OWNER", "ADMIN"]);
    const required = [body.name, body.facilityType, body.address, body.city, body.state].map(x => x?.trim());
    if (required.some(x => !x)) throw new BadRequestException("Facility name, type, address, city and state are required.");
    return this.db.$transaction(async tx => {
      if (body.isPrimary) await tx.facility.updateMany({ where: { manufacturerId: req.user.manufacturerId }, data: { isPrimary: false } });
      return tx.facility.create({ data: { manufacturerId: req.user.manufacturerId, name: required[0]!, facilityType: required[1]!, address: required[2]!, city: required[3]!, state: required[4]!, country: body.country?.trim() || "Nigeria", isPrimary: Boolean(body.isPrimary) } });
    });
  }
  @Delete("facilities/:id")
  async deleteFacility(@Req() req: AuthRequest, @Param("id") id: string) {
    await workspaceRole(this.db, req, ["OWNER", "ADMIN"]);
    const result = await this.db.facility.deleteMany({ where: { id, manufacturerId: req.user.manufacturerId } });
    if (!result.count) throw new NotFoundException("Facility not found.");
    return { deleted: true };
  }
  @Get("documents")
  async documents(@Req() req: AuthRequest) {
    await workspaceRole(this.db, req, [...roles]);
    const docs = await this.db.manufacturerDocument.findMany({ where: { manufacturerId: req.user.manufacturerId }, orderBy: { uploadedAt: "desc" } });
    return Promise.all(docs.map(async d => ({ ...d, downloadUrl: await createPrivateDownloadUrl(d.storageKey) })));
  }
  @Post("documents/upload-url")
  async documentUploadUrl(@Req() req: AuthRequest, @Body() body: { kind?: string; fileName?: string; mimeType?: string; sizeBytes?: number }) {
    await workspaceRole(this.db, req, ["OWNER", "ADMIN"]);
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    const kinds = ["CAC_CERTIFICATE", "ADDRESS_PROOF", "NAFDAC_REFERENCE", "SON_REFERENCE", "OTHER"];
    if (!kinds.includes(body.kind || "") || !body.fileName?.trim() || !allowedTypes.includes(body.mimeType || "") || !Number.isInteger(body.sizeBytes) || Number(body.sizeBytes) < 1 || Number(body.sizeBytes) > 10 * 1024 * 1024) throw new BadRequestException("Upload a PDF, JPG or PNG document up to 10 MB and select its document type.");
    const key = privateDocumentKey(req.user.manufacturerId, body.fileName);
    const uploadUrl = await createPrivateUploadUrl(key, body.mimeType!, Number(body.sizeBytes));
    return { key, uploadUrl, expiresIn: 600, requiredHeaders: { "Content-Type": body.mimeType, "x-amz-server-side-encryption": "AES256" } };
  }
  @Post("documents/confirm")
  async confirmDocument(@Req() req: AuthRequest, @Body() body: { key?: string; kind?: string; fileName?: string; mimeType?: string; sizeBytes?: number }) {
    await workspaceRole(this.db, req, ["OWNER", "ADMIN"]);
    const prefix = "manufacturers/" + req.user.manufacturerId + "/documents/";
    if (!body.key?.startsWith(prefix) || !body.kind || !body.fileName || !body.mimeType || !Number.isInteger(body.sizeBytes)) throw new BadRequestException("Invalid document upload confirmation.");
    await confirmPrivateUpload(body.key, Number(body.sizeBytes), body.mimeType);
    return this.db.manufacturerDocument.create({ data: { manufacturerId: req.user.manufacturerId, storageKey: body.key, kind: body.kind, fileName: body.fileName, mimeType: body.mimeType, sizeBytes: Number(body.sizeBytes) } });
  }
  @Get("team")
  async team(@Req() req: AuthRequest) {
    await workspaceRole(this.db, req, [...roles]);
    const [members, invitations] = await Promise.all([
      this.db.membership.findMany({ where: { manufacturerId: req.user.manufacturerId }, include: { user: { select: { id: true, fullName: true, email: true, emailVerifiedAt: true } } }, orderBy: { createdAt: "asc" } }),
      this.db.invitation.findMany({ where: { manufacturerId: req.user.manufacturerId, status: "PENDING" }, select: { id: true, email: true, role: true, expiresAt: true, createdAt: true } })
    ]);
    return { members, invitations };
  }
  @Post("team/invitations")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async invite(@Req() req: AuthRequest, @Body() body: { email?: string; role?: string }) {
    const actor = await workspaceRole(this.db, req, ["OWNER", "ADMIN"]);
    const email = body.email?.trim().toLowerCase(), role = body.role as Role;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !["ADMIN", "OPERATOR", "ANALYST", "FINANCE", "SUPPORT"].includes(role)) throw new BadRequestException("Enter a valid email and choose a supported workspace role.");
    if (role === "ADMIN" && actor.role !== "OWNER") throw new ForbiddenException("Only the workspace owner can invite another administrator.");
    const existing = await this.db.user.findUnique({ where: { email }, include: { memberships: true } });
    if (existing?.memberships.some(m => m.manufacturerId === req.user.manufacturerId)) throw new BadRequestException("This person is already a workspace member.");
    const raw = randomBytes(32).toString("base64url");
    const invitation = await this.db.$transaction(async tx => {
      const created = await tx.invitation.create({ data: { manufacturerId: req.user.manufacturerId, email, role, tokenHash: hash(raw), expiresAt: new Date(Date.now() + 7 * 86400000) } });
      await appendAudit(tx, { actor: req.user.sub, action: "TEAM_INVITATION_CREATED", targetType: "INVITATION", targetId: created.id, reason: `Invitation created for the ${role} workspace role.`, metadata: { role, expiresAt: created.expiresAt.toISOString() } });
      return created;
    });
    const link = (process.env.MANUFACTURER_APP_URL || "http://localhost:3000") + "/accept-invite?token=" + encodeURIComponent(raw);
    await sendPanEmail(email, "You have been invited to a PAN workspace", "<p>You have been invited to join a manufacturer workspace on PAN.</p><p><a href=\"" + link + "\">Accept invitation</a></p><p>This invitation expires in seven days.</p>");
    return { id: invitation.id, email, role, expiresAt: invitation.expiresAt, sent: true, ...(process.env.NODE_ENV === "test" ? { testInvitationToken: raw } : {}) };
  }
  @Post("team/invitations/:id/revoke")
  async revokeInvite(@Req() req: AuthRequest, @Param("id") id: string) {
    await workspaceRole(this.db, req, ["OWNER", "ADMIN"]);
    return this.db.$transaction(async tx => {
      const result = await tx.invitation.updateMany({ where: { id, manufacturerId: req.user.manufacturerId, status: "PENDING" }, data: { status: "REVOKED" } });
      if (!result.count) throw new NotFoundException("Pending invitation not found.");
      await appendAudit(tx, { actor: req.user.sub, action: "TEAM_INVITATION_REVOKED", targetType: "INVITATION", targetId: id, reason: "Pending workspace invitation revoked by a company administrator." });
      return { revoked: true };
    });
  }
  @Post("team/:userId/role")
  async changeRole(@Req() req: AuthRequest, @Param("userId") userId: string, @Body() body: { role?: string }) {
    const actor = await workspaceRole(this.db, req, ["OWNER", "ADMIN"]);
    if (!["ADMIN", "OPERATOR", "ANALYST", "FINANCE", "SUPPORT"].includes(body.role || "")) throw new BadRequestException("Choose a supported workspace role.");
    const target = await this.db.membership.findUnique({ where: { userId_manufacturerId: { userId, manufacturerId: req.user.manufacturerId } } });
    if (!target || target.role === "OWNER") throw new ForbiddenException("The workspace owner cannot be changed here.");
    if (actor.role !== "OWNER" && (target.role === "ADMIN" || body.role === "ADMIN")) throw new ForbiddenException("Only the workspace owner can manage administrator roles.");
    return this.db.$transaction(async tx => {
      const updated = await tx.membership.update({ where: { id: target.id }, data: { role: body.role as Role }, select: { id: true, role: true, userId: true } });
      await appendAudit(tx, { actor: req.user.sub, action: "TEAM_ROLE_CHANGED", targetType: "MEMBERSHIP", targetId: target.id, reason: `Workspace role changed from ${target.role} to ${updated.role}.`, metadata: { before: { role: target.role }, after: { role: updated.role }, userId } });
      return updated;
    });
  }
  @Delete("team/:userId")
  async removeMember(@Req() req: AuthRequest, @Param("userId") userId: string) {
    const actor = await workspaceRole(this.db, req, ["OWNER", "ADMIN"]);
    return this.db.$transaction(async tx => {
      const target = await tx.membership.findUnique({ where: { userId_manufacturerId: { userId, manufacturerId: req.user.manufacturerId } } });
      if (!target || target.role === "OWNER" || (actor.role !== "OWNER" && target.role === "ADMIN")) throw new ForbiddenException("This member cannot be removed by your role.");
      await tx.membership.delete({ where: { id: target.id } });
      await appendAudit(tx, { actor: req.user.sub, action: "TEAM_MEMBER_REMOVED", targetType: "MEMBERSHIP", targetId: target.id, reason: `Workspace member with role ${target.role} was removed.`, metadata: { before: { role: target.role }, userId } });
      return { removed: true };
    });
  }
  @Get("wallet")
  async wallet(@Req() req: AuthRequest) {
    await workspaceRole(this.db, req, ["OWNER", "ADMIN", "FINANCE"]);
    const manufacturerId = req.user.manufacturerId;
    const [balance, entries, payments, packages] = await Promise.all([
      this.db.walletEntry.aggregate({ where: { manufacturerId }, _sum: { amountCredits: true } }),
      this.db.walletEntry.findMany({ where: { manufacturerId }, orderBy: { createdAt: "desc" }, take: 100 }),
      this.db.payment.findMany({ where: { manufacturerId }, orderBy: { createdAt: "desc" }, take: 25, select: { reference: true, provider: true, status: true, amountMinor: true, currency: true, credits: true, createdAt: true, paidAt: true } }),
      this.db.creditPackage.findMany({ where: { active: true }, orderBy: { credits: "asc" }, select: { id: true, name: true, credits: true, amountMinor: true, currency: true } })
    ]);
    return { balance: balance._sum.amountCredits || 0, entries, payments, packages };
  }
  @Post("wallet/payments")
  async createWalletPayment(@Req() req: AuthRequest, @Body() body: { packageId?: string }) {
    await workspaceRole(this.db, req, ["OWNER", "ADMIN", "FINANCE"]);
    const pack = await this.db.creditPackage.findFirst({ where: { id: body.packageId || "", active: true } });
    if (!pack || pack.currency !== "NGN") throw new NotFoundException("Credit package not found or unavailable.");
    const [user, company] = await Promise.all([
      this.db.user.findUnique({ where: { id: req.user.sub }, select: { email: true } }),
      this.db.manufacturer.findUnique({ where: { id: req.user.manufacturerId }, select: { status: true } })
    ]);
    if (!user) throw new UnauthorizedException("Your account is no longer available.");
    if (company?.status !== "APPROVED") throw new ForbiddenException("Only approved manufacturer workspaces can purchase code credits.");
    const reference = "PAN_" + randomBytes(18).toString("hex");
    const payment = await this.db.payment.create({ data: { manufacturerId: req.user.manufacturerId, packageId: pack.id, reference, amountMinor: pack.amountMinor, currency: pack.currency, credits: pack.credits } });
    try {
      const callbackUrl = (process.env.MANUFACTURER_APP_URL || "http://localhost:3000").replace(/\/$/, "") + "/portal/wallet?reference=" + encodeURIComponent(reference);
      const checkout = await this.payments.initialize({ reference, email: user.email, amountMinor: payment.amountMinor, currency: payment.currency, callbackUrl });
      return { reference, authorizationUrl: checkout.authorizationUrl, amountMinor: payment.amountMinor, currency: payment.currency, credits: payment.credits };
    } catch (error) {
      await this.db.$transaction(async tx => {
        const failed = await tx.payment.updateMany({ where: { id: payment.id, status: "PENDING" }, data: { status: "FAILED" } });
        if (failed.count) await appendAudit(tx, { actor: req.user.sub, action: "WALLET_PAYMENT_INITIALIZATION_FAILED", targetType: "PAYMENT", targetId: payment.id, reason: "Payment checkout initialization failed before customer redirection.", metadata: { reference, amountMinor: payment.amountMinor, currency: payment.currency } });
      });
      throw error;
    }
  }
  @Post("wallet/payments/:reference/verify")
  async verifyWalletPayment(@Req() req: AuthRequest, @Param("reference") reference: string) {
    await workspaceRole(this.db, req, ["OWNER", "ADMIN", "FINANCE"]);
    const payment = await this.db.payment.findFirst({ where: { reference, manufacturerId: req.user.manufacturerId } });
    if (!payment) throw new NotFoundException("Wallet payment not found.");
    if (payment.status === "PAID") return { status: payment.status, credits: payment.credits };
    const verified = await this.payments.verify(payment.reference);
    if (verified.reference !== payment.reference || verified.amountMinor !== payment.amountMinor || verified.currency !== payment.currency) throw new BadRequestException("The payment provider response does not match this wallet transaction.");
    if (verified.status !== "success") {
      if (verified.status === "failed") await this.db.payment.updateMany({ where: { id: payment.id, status: "PENDING" }, data: { status: "FAILED", providerReference: verified.providerReference } });
      return { status: verified.status === "failed" ? "FAILED" : "PENDING", credits: 0 };
    }
    const paidAt = new Date();
    await this.db.$transaction(async tx => {
      const updated = await tx.payment.updateMany({ where: { id: payment.id, status: "PENDING" }, data: { status: "PAID", providerReference: verified.providerReference, paidAt } });
      if (!updated.count) return;
      await tx.walletEntry.create({ data: { manufacturerId: payment.manufacturerId, amountCredits: payment.credits, type: "PAYMENT_CREDIT", idempotencyKey: "payment:" + payment.id, actorId: "PAYSTACK", reason: "Verified Paystack payment " + payment.reference } });
      await appendAudit(tx, { actor: req.user.sub, action: "WALLET_PAYMENT_CREDITED", targetType: "PAYMENT", targetId: payment.id, reason: `${payment.credits} credits from provider-verified payment ${payment.reference}.`, metadata: { reference: payment.reference, credits: payment.credits, amountMinor: payment.amountMinor, currency: payment.currency, providerReference: verified.providerReference } });
    }, { isolationLevel: "Serializable" });
    const finalPayment = await this.db.payment.findUnique({ where: { id: payment.id }, select: { status: true, credits: true } });
    return { status: finalPayment?.status || "PENDING", credits: finalPayment?.status === "PAID" ? finalPayment.credits : 0 };
  }
  @Get("reports")
  async manufacturerReports(@Req() req: AuthRequest, @Query("status") status = "") {
    await workspaceRole(this.db, req, ["OWNER", "ADMIN", "ANALYST", "SUPPORT"]);
    const allowed = ["OPEN", "IN_REVIEW", "CONFIRMED_ISSUE", "RESOLVED", "FALSE_REPORT", "DISMISSED"];
    if (status && !allowed.includes(status)) throw new BadRequestException("Unknown report status.");
    return this.db.consumerReport.findMany({
      where: {
        ...(status ? { status } : {}),
        identity: { is: { batch: { product: { manufacturerId: req.user.manufacturerId } } } }
      },
      include: { identity: { select: { publicCode: true, verificationCount: true, events: { orderBy: { createdAt: "desc" }, take: 50, select: { outcome: true, createdAt: true, isIndependent: true } }, batch: { select: { batchCode: true, product: { select: { name: true, brand: true } } } } } },
      orderBy: { createdAt: "desc" },
      take: 200
    });
  }
  @Get("scan-risk")
  async manufacturerScanRisk(@Req() req: AuthRequest) {
    await workspaceRole(this.db, req, ["OWNER", "ADMIN", "ANALYST", "SUPPORT"]);
    return this.db.verificationEvent.findMany({
      where: { riskLevel: "HIGH", identity: { is: { batch: { product: { manufacturerId: req.user.manufacturerId } } } } },
      select: { id: true, outcome: true, riskLevel: true, createdAt: true, identity: { select: { publicCode: true, verificationCount: true, batch: { select: { batchCode: true, product: { select: { name: true } } } } } },
      orderBy: { createdAt: "desc" },
      take: 100
    });
  }
  @Post("reports/:id/status")
  async updateManufacturerReport(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: { status?: string; note?: string }) {
    await workspaceRole(this.db, req, ["OWNER", "ADMIN", "SUPPORT"]);
    const statuses = ["IN_REVIEW", "CONFIRMED_ISSUE", "RESOLVED", "FALSE_REPORT"];
    const note = body.note?.trim() || "";
    if (!statuses.includes(body.status || "") || note.length < 10 || note.length > 1000) throw new BadRequestException("Choose a valid report state and provide a review note of 10 to 1,000 characters.");
    return this.db.$transaction(async tx => {
      const report = await tx.consumerReport.findFirst({ where: { id, identity: { is: { batch: { product: { manufacturerId: req.user.manufacturerId } } } } }, select: { id: true } });
      if (!report) throw new NotFoundException("Consumer report not found in this manufacturer workspace.");
      const previous = await tx.consumerReport.findUnique({ where: { id }, select: { status: true } });
      const updated = await tx.consumerReport.update({ where: { id }, data: { status: body.status!, adminNote: note } });
      await appendAudit(tx, { actor: req.user.sub, action: "MANUFACTURER_REPORT_" + body.status, targetType: "CONSUMER_REPORT", targetId: id, reason: note, metadata: { before: { status: previous?.status ?? null }, after: { status: updated.status } } });
      return updated;
    });
  }
  @Get("batches")
  async allBatches(@Req() req: AuthRequest) {
    await workspaceRole(this.db, req, [...roles]);
    return this.db.batch.findMany({ where: { product: { manufacturerId: req.user.manufacturerId } }, include: { product: { select: { id: true, name: true, brand: true } }, _count: { select: { identities: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  }
  @Post("batches/:id/issuance-jobs")
  async createIssuanceJob(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: { unitQuantity?: number; cartonQuantity?: number }) {
    await workspaceRole(this.db, req, ["OWNER", "ADMIN", "OPERATOR"]);
    const producer = await this.db.manufacturer.findUnique({ where: { id: req.user.manufacturerId }, select: { status: true } });
    if (producer?.status !== "APPROVED") throw new ForbiddenException("Your PAN producer workspace must be approved before issuing product identities.");
    const batch = await this.db.batch.findFirst({ where: { id, product: { manufacturerId: req.user.manufacturerId } }, include: { product: true } });
    if (!batch) throw new NotFoundException("Production batch not found.");
    const unitQuantity = Number(body.unitQuantity || 0), cartonQuantity = Number(body.cartonQuantity || 0);
    if (!Number.isInteger(unitQuantity) || !Number.isInteger(cartonQuantity) || unitQuantity < 0 || cartonQuantity < 0 || unitQuantity + cartonQuantity < 1 || unitQuantity > 10000 || cartonQuantity > 1000) throw new BadRequestException("Request up to 10,000 individual-unit codes and 1,000 carton codes per job.");
    if (cartonQuantity > 0 && !batch.unitsPerCarton) throw new BadRequestException("Configure units per carton on the production batch before issuing carton identities.");
    if (cartonQuantity > 0 && unitQuantity > 0 && unitQuantity !== cartonQuantity * batch.unitsPerCarton!) throw new BadRequestException("When issuing new units and cartons together, unit quantity must equal cartons multiplied by units per carton.");
    return this.db.$transaction(async tx => {
      const [currentUnits, currentCartons, pending, pendingCartonOnly] = await Promise.all([
        tx.productIdentity.count({ where: { batchId: id, level: "UNIT" } }),
        tx.productIdentity.count({ where: { batchId: id, level: "CARTON" } }),
        tx.issuanceJob.aggregate({ where: { batchId: id, status: { in: ["QUEUED", "PROCESSING"] } }, _sum: { unitQuantity: true, cartonQuantity: true } }),
        tx.issuanceJob.aggregate({ where: { batchId: id, status: { in: ["QUEUED", "PROCESSING"] }, unitQuantity: 0, cartonQuantity: { gt: 0 } }, _sum: { cartonQuantity: true } })
      ]);
      if (currentUnits + (pending._sum.unitQuantity || 0) + unitQuantity > batch.quantity) throw new BadRequestException("The requested unit identities exceed the production quantity remaining, including queued jobs.");
      if (cartonQuantity > 0 && (batch.cartonCount === null || currentCartons + (pending._sum.cartonQuantity || 0) + cartonQuantity > batch.cartonCount)) throw new BadRequestException("The requested carton identities exceed the number of cartons recorded for this batch.");
      if (cartonQuantity > 0 && unitQuantity === 0) {
        const unassignedUnits = await tx.productIdentity.count({ where: { batchId: id, level: "UNIT", parentId: null } });
        const unitsReservedByPendingCartons = (pendingCartonOnly._sum.cartonQuantity || 0) * batch.unitsPerCarton!;
        const unitsRequired = unitsReservedByPendingCartons + cartonQuantity * batch.unitsPerCarton!;
        if (unassignedUnits < unitsRequired) throw new BadRequestException("There are not enough unassigned individual-unit identities remaining after accounting for queued carton jobs. Wait for pending carton jobs to finish or issue more unit identities.");
      }
      const creditsRequired = unitQuantity + cartonQuantity;
      const wallet = await tx.walletEntry.aggregate({ where: { manufacturerId: req.user.manufacturerId }, _sum: { amountCredits: true } });
      if ((wallet._sum.amountCredits || 0) < creditsRequired) throw new BadRequestException(`Insufficient code credits. ${creditsRequired} credits are required for this issuance job.`);
      const job = await tx.issuanceJob.create({ data: { manufacturerId: req.user.manufacturerId, batchId: id, createdById: req.user.sub, unitQuantity, cartonQuantity } });
      await tx.walletEntry.create({ data: { manufacturerId: req.user.manufacturerId, amountCredits: -creditsRequired, type: "ISSUANCE_DEBIT", idempotencyKey: "issuance:" + job.id, actorId: req.user.sub, reason: `${creditsRequired} credits reserved for issuance job ${job.id}.` } });
      await appendAudit(tx, { actor: req.user.sub, action: "CODE_CREDITS_DEBITED", targetType: "ISSUANCE_JOB", targetId: job.id, reason: `${creditsRequired} credits charged for ${unitQuantity} unit and ${cartonQuantity} carton identities.`, metadata: { unitQuantity, cartonQuantity, creditsRequired, balanceBefore: wallet._sum.amountCredits || 0, balanceAfter: (wallet._sum.amountCredits || 0) - creditsRequired } });
      return job;
    }, { isolationLevel: "Serializable" });
  }
  @Get("issuance-jobs/:id")
  async issuanceJob(@Req() req: AuthRequest, @Param("id") id: string) {
    await workspaceRole(this.db, req, [...roles]);
    const member = await workspaceRole(this.db, req, ["OWNER", "ADMIN", "OPERATOR"]);
    const job = await this.db.issuanceJob.findFirst({ where: { id, manufacturerId: req.user.manufacturerId } });
    if (!job) throw new NotFoundException("Issuance job not found.");
    if (job.createdById !== req.user.sub && member.role !== "OWNER" && member.role !== "ADMIN") throw new ForbiddenException("Only the job creator or a workspace administrator can download identity exports.");
    if (job.expiresAt && job.expiresAt < new Date()) {
      await this.db.issuanceJob.update({ where: { id }, data: { status: "EXPIRED", resultCiphertext: null } });
      return { id, status: "EXPIRED", progress: 100, assets: [] };
    }
    let assets: any[] = [];
    if (job.status === "COMPLETED" && job.resultCiphertext) {
      const key = process.env.EXPORT_ENCRYPTION_KEY || "";
      if (!/^[a-f0-9]{64}$/i.test(key)) throw new ForbiddenException("Secure export delivery is not configured.");
      const [iv, tag, ciphertext] = job.resultCiphertext.split(".");
      const { createDecipheriv } = await import("node:crypto");
      const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), Buffer.from(iv, "base64url"));
      decipher.setAuthTag(Buffer.from(tag, "base64url"));
      const plain = Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
      assets = JSON.parse(plain).assets;
      await this.db.$transaction(async tx => {
        const exported = await tx.productIdentity.updateMany({ where: { issuanceJobId: job.id, status: "GENERATED" }, data: { status: "EXPORTED" } });
        if (exported.count) await appendAudit(tx, { actor: req.user.sub, action: "IDENTITY_EXPORT_RETRIEVED", targetType: "ISSUANCE_JOB", targetId: job.id, reason: `${exported.count} product identities were retrieved for export.`, metadata: { from: "GENERATED", to: "EXPORTED", identities: exported.count } });
      });
    }
    return { id: job.id, status: job.status, progress: job.progress, errorMessage: job.errorMessage, expiresAt: job.expiresAt, assets };
  }
  @Post("batches/:id/activate")
  async activateBatch(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: { qualityChecked?: boolean; reason?: string }) {
    await workspaceRole(this.db, req, ["OWNER", "ADMIN", "OPERATOR"]);
    if (body.qualityChecked !== true || !body.reason?.trim() || body.reason.trim().length < 10) throw new BadRequestException("Confirm print quality and provide a reason of at least 10 characters before activation.");
    const producer = await this.db.manufacturer.findUnique({ where: { id: req.user.manufacturerId }, select: { status: true } });
    if (producer?.status !== "APPROVED") throw new ForbiddenException("Your PAN producer workspace must be approved before activating product identities.");
    const batch = await this.db.batch.findFirst({ where: { id, product: { manufacturerId: req.user.manufacturerId } }, select: { id: true } });
    if (!batch) throw new NotFoundException("Production batch not found.");
    return this.db.$transaction(async tx => {
      const activated = await tx.productIdentity.updateMany({ where: { batchId: id, status: "EXPORTED" }, data: { status: "ACTIVE" } });
      if (!activated.count) throw new BadRequestException("This batch has no exported identities awaiting activation.");
      await appendAudit(tx, { actor: req.user.sub, action: "IDENTITIES_ACTIVATED", targetType: "BATCH", targetId: id, reason: body.reason!.trim(), metadata: { from: "EXPORTED", to: "ACTIVE", identities: activated.count } });
      return { activated: activated.count, status: "ACTIVE" };
    });
  }
  @Post("invitations/accept")
  @Public()
  async acceptInvitation(@Body() body: { token?: string; fullName?: string; password?: string }) {
    const token = body.token || "", invitation = await this.db.invitation.findUnique({ where: { tokenHash: hash(token) } });
    if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt < new Date()) throw new BadRequestException("This invitation is invalid or has expired.");
    let user = await this.db.user.findUnique({ where: { email: invitation.email } });
    if (!user) {
      if (!body.fullName?.trim() || !body.password || body.password.length < 10 || Buffer.byteLength(body.password, "utf8") > 72) throw new BadRequestException("Enter your name and a password between 10 characters and 72 UTF-8 bytes.");
      user = await this.db.user.create({ data: { fullName: body.fullName.trim(), email: invitation.email, passwordHash: await bcrypt.hash(body.password, 12), emailVerifiedAt: new Date() } });
    } else if (!user.emailVerifiedAt) {
      user = await this.db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    }
    await this.db.$transaction(async tx => {
      await tx.membership.create({ data: { userId: user!.id, manufacturerId: invitation.manufacturerId, role: invitation.role } });
      await tx.invitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED", acceptedAt: new Date() } });
      await appendAudit(tx, { actor: user!.id, action: "TEAM_INVITATION_ACCEPTED", targetType: "MANUFACTURER", targetId: invitation.manufacturerId, reason: `Invitation accepted for the ${invitation.role} workspace role.`, metadata: { role: invitation.role, userId: user!.id } });
    });
    return { accepted: true, email: user.email };
  }
}

@Controller()
export class PrivacyRequestController {
  constructor(private db: PrismaService) {}
  @Post("v1/privacy/requests")
  @Public()
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  async create(@Body() body: { email?: string; requestType?: string; details?: string }) {
    const email = body.email?.trim().toLowerCase();
    const allowed = ["ACCESS", "CORRECT", "DELETE", "RESTRICT", "OBJECT", "COMPLAINT"];
    const details = body.details?.trim() || "";
    if (!email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || !allowed.includes(body.requestType || "") || details.length < 10 || details.length > 2000) {
      throw new BadRequestException("Enter a valid email, choose a request type and provide 10 to 2,000 characters of context.");
    }
    const request = await this.db.privacyRequest.create({ data: { email, requestType: body.requestType!, details } });
    const contact = process.env.PRIVACY_CONTACT_EMAIL;
    if (contact) await sendPanEmail(contact, "New PAN privacy request " + request.id, "<p>A new privacy request has been submitted.</p><p>Reference: " + request.id + "</p><p>Type: " + request.requestType + "</p><p>Requester: " + email + "</p><p>Verify the requester's identity before disclosing or changing any personal information.</p>");
    await sendPanEmail(email, "PAN privacy request received", "<p>Your privacy request has been received.</p><p>Reference: " + request.id + "</p><p>PAN may contact you to verify your identity before processing the request.</p>");
    return { received: true, reference: request.id, message: "Your request has been received. Keep the reference number for follow-up." };
  }
}

