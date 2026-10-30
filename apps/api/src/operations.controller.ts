import { Body, Controller, Get, Post, Put, Delete, Param, Query, Req, UseGuards, BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHmac, randomBytes } from "node:crypto";
import * as bcrypt from "bcryptjs";
import type { Request } from "express";
import { PrismaService } from "./prisma.service";
import { AuthRequest, Public } from "./auth";
import { sendPanEmail } from "./mailer";
import { confirmPrivateUpload, createPrivateDownloadUrl, createPrivateUploadUrl, privateDocumentKey } from "./storage";

const hash = (value: string) => createHmac("sha256", process.env.TOKEN_PEPPER!).update(value).digest("hex");
const roles = ["OWNER", "ADMIN", "OPERATOR", "ANALYST"] as const;
type Role = typeof roles[number];

async function workspaceRole(db: PrismaService, req: AuthRequest, allowed: Role[]) {
  const membership = await db.membership.findUnique({ where: { userId_manufacturerId: { userId: req.user.sub, manufacturerId: req.user.manufacturerId } } });
  if (!membership || !allowed.includes(membership.role as Role)) throw new ForbiddenException("Your workspace role does not permit this action.");
  return membership;
}

export class SuperAdminGuard {
  canActivate(context: any) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    if (req.user?.role !== "SUPER_ADMIN" || !req.user?.sub) throw new ForbiddenException("Super administrator access is required.");
    return true;
  }
}

@Controller()
export class SuperAdminAuthController {
  constructor(private jwt: JwtService) {}
  @Post("v1/super-admin/auth/login")
  @Public()
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
    return company;
  }
  @Post("companies/:id/status")
  async companyStatus(@Param("id") id: string, @Body() body: { status?: string; reason?: string }) {
    const status = body.status, reason = body.reason?.trim();
    if (!["APPROVED", "SUSPENDED", "PENDING"].includes(status || "") || !reason || reason.length < 10) throw new BadRequestException("Choose a valid status and provide a review reason of at least 10 characters.");
    return this.db.$transaction(async tx => {
      const row = await tx.manufacturer.update({ where: { id }, data: { status: status as any } });
      await tx.auditLog.create({ data: { actor: "SUPER_ADMIN", action: "COMPANY_STATUS_" + status, targetType: "MANUFACTURER", targetId: id, reason } });
      return { id: row.id, legalName: row.legalName, status: row.status };
    });
  }
  @Post("documents/:id/review")
  async reviewDocument(@Param("id") id: string, @Body() body: { status?: string; note?: string }) {
    if (!["UNDER_REVIEW", "ACCEPTED", "REJECTED"].includes(body.status || "")) throw new BadRequestException("Choose a valid document review status.");
    const document = await this.db.manufacturerDocument.update({ where: { id }, data: { reviewStatus: body.status as any, reviewNote: body.note?.trim() || null, reviewedAt: new Date() } });
    await this.db.auditLog.create({ data: { actor: "SUPER_ADMIN", action: "DOCUMENT_" + body.status, targetType: "MANUFACTURER_DOCUMENT", targetId: id, reason: body.note?.trim() || "Document review status updated." } });
    return document;
  }
  @Get("identities")
  async identities(@Query("q") q = "", @Query("status") status = "") {
    const where: any = {};
    if (q.trim()) where.publicCode = { contains: q.trim().toUpperCase(), mode: "insensitive" };
    if (["ACTIVE", "QUARANTINED", "REVOKED"].includes(status)) where.status = status;
    return this.db.productIdentity.findMany({ where, include: { batch: { include: { product: { include: { manufacturer: { select: { id: true, legalName: true } } } } } }, carton: { select: { publicCode: true } }, _count: { select: { containedUnits: true } } }, orderBy: { issuedAt: "desc" }, take: 100 });
  }
  @Post("identities/:id/:action")
  async identityAction(@Param("id") id: string, @Param("action") action: string, @Body() body: { reason?: string }) {
    const state: Record<string, "ACTIVE" | "QUARANTINED" | "REVOKED"> = { release: "ACTIVE", quarantine: "QUARANTINED", revoke: "REVOKED" };
    const status = state[action], reason = body.reason?.trim();
    if (!status || !reason || reason.length < 10) throw new BadRequestException("Choose release, quarantine or revoke and provide a reason.");
    return this.db.$transaction(async tx => {
      const identity = await tx.productIdentity.update({ where: { id }, data: { status }, select: { id: true, publicCode: true, level: true, status: true } });
      await tx.auditLog.create({ data: { actor: "SUPER_ADMIN", action: "IDENTITY_" + action.toUpperCase(), targetType: "PRODUCT_IDENTITY", targetId: id, reason } });
      return identity;
    });
  }
  @Get("audit")
  audit(@Query("limit") limit = "100") {
    return this.db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: Math.min(250, Math.max(1, Number(limit) || 100)) });
  }
}

@Controller("v1/manufacturer")
export class ManufacturerOperationsController {
  constructor(private db: PrismaService) {}
  @Get("profile")
  async profile(@Req() req: AuthRequest) {
    await workspaceRole(this.db, req, [...roles]);
    return this.db.manufacturer.findUnique({ where: { id: req.user.manufacturerId }, include: { _count: { select: { facilities: true, documents: true, memberships: true } } } });
  }
  @Put("profile")
  async updateProfile(@Req() req: AuthRequest, @Body() body: { legalName?: string; registrationNumber?: string; registeredAddress?: string; phone?: string; website?: string; industry?: string }) {
    await workspaceRole(this.db, req, ["OWNER", "ADMIN"]);
    if (body.legalName !== undefined && body.legalName.trim().length < 2) throw new BadRequestException("Enter the registered company name.");
    return this.db.manufacturer.update({ where: { id: req.user.manufacturerId }, data: {
      ...(body.legalName !== undefined ? { legalName: body.legalName.trim() } : {}),
      ...(body.registrationNumber !== undefined ? { registrationNumber: body.registrationNumber.trim() || null } : {}),
      ...(body.registeredAddress !== undefined ? { registeredAddress: body.registeredAddress.trim() || null } : {}),
      ...(body.phone !== undefined ? { phone: body.phone.trim() || null } : {}),
      ...(body.website !== undefined ? { website: body.website.trim() || null } : {}),
      ...(body.industry !== undefined ? { industry: body.industry.trim() || null } : {})
    } });
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
    return { key, uploadUrl, expiresIn: 600, requiredHeaders: { "Content-Type": body.mimeType } };
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
  async invite(@Req() req: AuthRequest, @Body() body: { email?: string; role?: string }) {
    const actor = await workspaceRole(this.db, req, ["OWNER", "ADMIN"]);
    const email = body.email?.trim().toLowerCase(), role = body.role as Role;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !["ADMIN", "OPERATOR", "ANALYST"].includes(role)) throw new BadRequestException("Enter a valid email and choose Admin, Operator or Analyst.");
    if (role === "ADMIN" && actor.role !== "OWNER") throw new ForbiddenException("Only the workspace owner can invite another administrator.");
    const existing = await this.db.user.findUnique({ where: { email }, include: { memberships: true } });
    if (existing?.memberships.some(m => m.manufacturerId === req.user.manufacturerId)) throw new BadRequestException("This person is already a workspace member.");
    const raw = randomBytes(32).toString("base64url");
    const invitation = await this.db.invitation.create({ data: { manufacturerId: req.user.manufacturerId, email, role, tokenHash: hash(raw), expiresAt: new Date(Date.now() + 7 * 86400000) } });
    const link = (process.env.MANUFACTURER_APP_URL || "http://localhost:3000") + "/accept-invite?token=" + encodeURIComponent(raw);
    await sendPanEmail(email, "You have been invited to a PAN workspace", "<p>You have been invited to join a manufacturer workspace on PAN.</p><p><a href=\"" + link + "\">Accept invitation</a></p><p>This invitation expires in seven days.</p>");
    return { id: invitation.id, email, role, expiresAt: invitation.expiresAt, sent: true };
  }
  @Post("team/invitations/:id/revoke")
  async revokeInvite(@Req() req: AuthRequest, @Param("id") id: string) {
    await workspaceRole(this.db, req, ["OWNER", "ADMIN"]);
    const result = await this.db.invitation.updateMany({ where: { id, manufacturerId: req.user.manufacturerId, status: "PENDING" }, data: { status: "REVOKED" } });
    if (!result.count) throw new NotFoundException("Pending invitation not found.");
    return { revoked: true };
  }
  @Post("team/:userId/role")
  async changeRole(@Req() req: AuthRequest, @Param("userId") userId: string, @Body() body: { role?: string }) {
    const actor = await workspaceRole(this.db, req, ["OWNER", "ADMIN"]);
    if (!["ADMIN", "OPERATOR", "ANALYST"].includes(body.role || "")) throw new BadRequestException("Choose Admin, Operator or Analyst.");
    const target = await this.db.membership.findUnique({ where: { userId_manufacturerId: { userId, manufacturerId: req.user.manufacturerId } } });
    if (!target || target.role === "OWNER") throw new ForbiddenException("The workspace owner cannot be changed here.");
    if (actor.role !== "OWNER" && (target.role === "ADMIN" || body.role === "ADMIN")) throw new ForbiddenException("Only the workspace owner can manage administrator roles.");
    return this.db.membership.update({ where: { id: target.id }, data: { role: body.role as Role }, select: { id: true, role: true, userId: true } });
  }
  @Delete("team/:userId")
  async removeMember(@Req() req: AuthRequest, @Param("userId") userId: string) {
    const actor = await workspaceRole(this.db, req, ["OWNER", "ADMIN"]);
    const target = await this.db.membership.findUnique({ where: { userId_manufacturerId: { userId, manufacturerId: req.user.manufacturerId } } });
    if (!target || target.role === "OWNER" || (actor.role !== "OWNER" && target.role === "ADMIN")) throw new ForbiddenException("This member cannot be removed by your role.");
    await this.db.membership.delete({ where: { id: target.id } });
    return { removed: true };
  }
  @Get("batches")
  async allBatches(@Req() req: AuthRequest) {
    await workspaceRole(this.db, req, [...roles]);
    return this.db.batch.findMany({ where: { product: { manufacturerId: req.user.manufacturerId } }, include: { product: { select: { id: true, name: true, brand: true } }, _count: { select: { identities: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  }
  @Post("batches/:id/issuance-jobs")
  async createIssuanceJob(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: { unitQuantity?: number; cartonQuantity?: number }) {
    await workspaceRole(this.db, req, ["OWNER", "ADMIN", "OPERATOR"]);
    const batch = await this.db.batch.findFirst({ where: { id, product: { manufacturerId: req.user.manufacturerId } }, include: { product: true } });
    if (!batch) throw new NotFoundException("Production batch not found.");
    const unitQuantity = Number(body.unitQuantity || 0), cartonQuantity = Number(body.cartonQuantity || 0);
    if (!Number.isInteger(unitQuantity) || !Number.isInteger(cartonQuantity) || unitQuantity < 0 || cartonQuantity < 0 || unitQuantity + cartonQuantity < 1 || unitQuantity > 10000 || cartonQuantity > 1000) throw new BadRequestException("Request up to 10,000 individual-unit codes and 1,000 carton codes per job.");
    if (cartonQuantity > 0 && (!batch.unitsPerCarton || unitQuantity !== cartonQuantity * batch.unitsPerCarton)) throw new BadRequestException("Carton issuance must include exactly the configured number of unit identities per carton. Issue loose units separately.");
    const currentUnits = await this.db.productIdentity.count({ where: { batchId: id, level: "UNIT" } });
    const currentCartons = await this.db.productIdentity.count({ where: { batchId: id, level: "CARTON" } });
    if (currentUnits + unitQuantity > batch.quantity) throw new BadRequestException("The requested unit identities exceed the production quantity remaining.");
    if (batch.cartonCount !== null && currentCartons + cartonQuantity > batch.cartonCount) throw new BadRequestException("The requested carton identities exceed the number of cartons recorded for this batch.");
    return this.db.issuanceJob.create({ data: { manufacturerId: req.user.manufacturerId, batchId: id, createdById: req.user.sub, unitQuantity, cartonQuantity } });
  }
  @Get("issuance-jobs/:id")
  async issuanceJob(@Req() req: AuthRequest, @Param("id") id: string) {
    await workspaceRole(this.db, req, [...roles]);
    const job = await this.db.issuanceJob.findFirst({ where: { id, manufacturerId: req.user.manufacturerId } });
    if (!job) throw new NotFoundException("Issuance job not found.");
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
    }
    return { id: job.id, status: job.status, progress: job.progress, errorMessage: job.errorMessage, expiresAt: job.expiresAt, assets };
  }
  @Post("invitations/accept")
  @Public()
  async acceptInvitation(@Body() body: { token?: string; fullName?: string; password?: string }) {
    const token = body.token || "", invitation = await this.db.invitation.findUnique({ where: { tokenHash: hash(token) } });
    if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt < new Date()) throw new BadRequestException("This invitation is invalid or has expired.");
    let user = await this.db.user.findUnique({ where: { email: invitation.email } });
    if (!user) {
      if (!body.fullName?.trim() || !body.password || body.password.length < 10) throw new BadRequestException("Enter your name and a password of at least 10 characters.");
      user = await this.db.user.create({ data: { fullName: body.fullName.trim(), email: invitation.email, passwordHash: await bcrypt.hash(body.password, 12), emailVerifiedAt: new Date() } });
    }
    await this.db.$transaction([
      this.db.membership.create({ data: { userId: user.id, manufacturerId: invitation.manufacturerId, role: invitation.role } }),
      this.db.invitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED", acceptedAt: new Date() } })
    ]);
    return { accepted: true, email: user.email };
  }
}
