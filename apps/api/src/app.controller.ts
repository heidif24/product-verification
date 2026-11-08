import { Body, Controller, Get, Param, Post, Req, Headers, UseGuards, BadRequestException, NotFoundException, ConflictException, ForbiddenException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Throttle } from "@nestjs/throttler";
import { createHmac, randomBytes } from "node:crypto";
import * as bcrypt from "bcryptjs";
import * as QRCode from "qrcode";
import { PrismaService } from "./prisma.service";
import { AuthGuard, AuthRequest, Public } from "./auth";
import { sendPanEmail } from "./mailer";
import { appendAudit } from "./audit";

const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
const tokenDigest = (token: string) => createHmac("sha256", process.env.TOKEN_PEPPER!).update(token).digest("hex");
const scanSessionDigest = (sessionId?: string) => sessionId && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(sessionId) ? createHmac("sha256", process.env.TOKEN_PEPPER!).update("scan-session:" + sessionId).digest("hex") : null;

@Controller()
export class AppController {
  constructor(private db: PrismaService, private jwt: JwtService) {}

  private async assertWorkspaceRole(req: AuthRequest, allowed: string[]) {
    const membership = await this.db.membership.findUnique({ where: { userId_manufacturerId: { userId: req.user.sub, manufacturerId: req.user.manufacturerId } } });
    if (!membership || !allowed.includes(membership.role)) throw new ForbiddenException("Your workspace role does not permit this action.");
    return membership;
  }

  private async recordIdentityScan(identityId: string, initialOutcome: string, sessionId: string | undefined, now: Date, currentCount: number) {
    const sessionHash = scanSessionDigest(sessionId);
    const sessionDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return this.db.$transaction(async tx => {
      let independent = true;
      if (sessionHash) {
        const inserted = await tx.scanSession.createMany({ data: { identityId, sessionHash, sessionDate }, skipDuplicates: true });
        independent = inserted.count === 1;
      }

      let firstScan = false;
      let scansRecorded = currentCount;
      if (independent) {
        if (initialOutcome === "VERIFIED") {
          const claimedFirst = await tx.productIdentity.updateMany({ where: { id: identityId, firstVerifiedAt: null }, data: { verificationCount: { increment: 1 }, firstVerifiedAt: now, lastVerifiedAt: now } });
          firstScan = claimedFirst.count === 1;
          if (!firstScan) await tx.productIdentity.update({ where: { id: identityId }, data: { verificationCount: { increment: 1 }, lastVerifiedAt: now } });
        } else {
          await tx.productIdentity.update({ where: { id: identityId }, data: { verificationCount: { increment: 1 }, lastVerifiedAt: now } });
        }
        const updated = await tx.productIdentity.findUnique({ where: { id: identityId }, select: { verificationCount: true } });
        scansRecorded = updated?.verificationCount ?? currentCount + 1;
      }

      const sessionCount = sessionHash ? await tx.scanSession.count({ where: { identityId, sessionDate } }) : 0;
      let outcome = initialOutcome;
      if ((initialOutcome === "VERIFIED" || initialOutcome === "PREVIOUSLY_SCANNED") && !independent) outcome = "VERIFIED";
      else if (initialOutcome === "VERIFIED" && !firstScan) outcome = "PREVIOUSLY_SCANNED";
      if ((outcome === "VERIFIED" || outcome === "PREVIOUSLY_SCANNED") && sessionCount >= 10) outcome = "SUSPICIOUS_ACTIVITY";
      await tx.verificationEvent.create({ data: { identityId, outcome, sessionHash, sessionDate, isIndependent: independent, riskLevel: outcome === "SUSPICIOUS_ACTIVITY" && independent ? "HIGH" : "NORMAL" } });
      return { outcome, independent, duplicate: !independent, scansRecorded, sessionCount };
    });
  }

  @Get("health")
  @Public()
  health() { return { status: "ok", service: "pan-api", timestamp: new Date().toISOString() }; }

  @Get("health/ready")
  @Public()
  async readiness() {
    await this.db.$queryRawUnsafe("SELECT 1");
    return { status: "ready", database: "connected", timestamp: new Date().toISOString() };
  }

  @Post("v1/auth/register")
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(@Body() body: { fullName?: string; email?: string; password?: string; companyName?: string }) {
    const fullName = body.fullName?.trim(), email = body.email?.trim().toLowerCase(), password = body.password ?? "", companyName = body.companyName?.trim();
    if (!fullName || !email || !companyName || password.length < 10 || Buffer.byteLength(password, "utf8") > 72) throw new BadRequestException("Enter your name, company, valid email and a password between 10 characters and 72 UTF-8 bytes.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException("Enter a valid email address.");
    if (await this.db.user.findUnique({ where: { email } })) throw new ConflictException("An account with this email already exists.");
    const base = slugify(companyName) || "manufacturer";
    const slug = base + "-" + randomBytes(3).toString("hex");
    const passwordHash = await bcrypt.hash(password, 12);
    const created = await this.db.$transaction(async tx => {
      const manufacturer = await tx.manufacturer.create({ data: { legalName: companyName, slug } });
      const user = await tx.user.create({ data: { fullName, email, passwordHash } });
      await tx.membership.create({ data: { userId: user.id, manufacturerId: manufacturer.id, role: "OWNER" } });
      return { user, manufacturer };
    });
    const rawToken = randomBytes(32).toString("base64url");
    await this.db.verificationToken.create({ data: { userId: created.user.id, tokenHash: tokenDigest(rawToken), purpose: "EMAIL_VERIFICATION", expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
    const link = (process.env.MANUFACTURER_APP_URL || "http://localhost:3000") + "/verify-email?token=" + encodeURIComponent(rawToken);
    await sendPanEmail(email, "Verify your PAN manufacturer account", "<p>Welcome to PAN. Confirm your email address to activate your manufacturer login.</p><p><a href=\"" + link + "\">Verify email address</a></p><p>This link expires in 24 hours.</p>");
    return { verificationRequired: true, message: "Check your email for a verification link before signing in.", ...(process.env.NODE_ENV === "test" ? { testVerificationToken: rawToken } : {}) };
  }

  @Post("v1/auth/verify-email")
  @Public()
  async verifyEmail(@Body() body: { token?: string }) {
    if (!body.token) throw new BadRequestException("Verification token is required.");
    const token = await this.db.verificationToken.findUnique({ where: { tokenHash: tokenDigest(body.token) }, include: { user: true } });
    if (!token || token.purpose !== "EMAIL_VERIFICATION" || token.usedAt || token.expiresAt < new Date()) throw new BadRequestException("This email verification link is invalid or has expired.");
    await this.db.$transaction([
      this.db.user.update({ where: { id: token.userId }, data: { emailVerifiedAt: new Date() } }),
      this.db.verificationToken.update({ where: { id: token.id }, data: { usedAt: new Date() } })
    ]);
    return { verified: true, message: "Email address verified. You can now sign in." };
  }

  @Post("v1/auth/resend-verification")
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async resendVerification(@Body() body: { email?: string }) {
    const email = body.email?.trim().toLowerCase();
    if (email) {
      const user = await this.db.user.findUnique({ where: { email } });
      if (user && !user.emailVerifiedAt) {
        await this.db.verificationToken.updateMany({ where: { userId: user.id, purpose: "EMAIL_VERIFICATION", usedAt: null }, data: { usedAt: new Date() } });
        const raw = randomBytes(32).toString("base64url");
        await this.db.verificationToken.create({ data: { userId: user.id, tokenHash: tokenDigest(raw), purpose: "EMAIL_VERIFICATION", expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
        const link = (process.env.MANUFACTURER_APP_URL || "http://localhost:3000") + "/verify-email?token=" + encodeURIComponent(raw);
        await sendPanEmail(email, "Your PAN email verification link", "<p><a href=\"" + link + "\">Verify your PAN email address</a></p><p>This link expires in 24 hours.</p>");
      }
    }
    return { message: "If the address belongs to an unverified PAN account, a new verification link has been sent." };
  }

  @Post("v1/auth/forgot-password")
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async forgotPassword(@Body() body: { email?: string }) {
    const email = body.email?.trim().toLowerCase();
    if (email) {
      const user = await this.db.user.findUnique({ where: { email } });
      if (user && user.emailVerifiedAt) {
        await this.db.verificationToken.updateMany({ where: { userId: user.id, purpose: "PASSWORD_RESET", usedAt: null }, data: { usedAt: new Date() } });
        const raw = randomBytes(32).toString("base64url");
        await this.db.verificationToken.create({ data: { userId: user.id, tokenHash: tokenDigest(raw), purpose: "PASSWORD_RESET", expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
        const link = (process.env.MANUFACTURER_APP_URL || "http://localhost:3000") + "/reset-password?token=" + encodeURIComponent(raw);
        await sendPanEmail(email, "Reset your PAN password", "<p>We received a request to reset your PAN password.</p><p><a href=\"" + link + "\">Choose a new password</a></p><p>This link expires in one hour. If you did not request this, you can ignore this email.</p>");
        return { message: "If this address belongs to a PAN account, password reset instructions have been sent.", ...(process.env.NODE_ENV === "test" ? { testResetToken: raw } : {}) };
      }
    }
    return { message: "If this address belongs to a PAN account, password reset instructions have been sent." };
  }

  @Post("v1/auth/reset-password")
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async resetPassword(@Body() body: { token?: string; password?: string }) {
    if (!body.token || !body.password || body.password.length < 10 || Buffer.byteLength(body.password, "utf8") > 72) throw new BadRequestException("A valid reset token and a password between 10 characters and 72 UTF-8 bytes are required.");
    const token = await this.db.verificationToken.findUnique({ where: { tokenHash: tokenDigest(body.token) } });
    if (!token || token.purpose !== "PASSWORD_RESET" || token.usedAt || token.expiresAt < new Date()) throw new BadRequestException("This password reset link is invalid or has expired.");
    const passwordHash = await bcrypt.hash(body.password, 12);
    const now = new Date();
    await this.db.$transaction(async tx => {
      const consumed = await tx.verificationToken.updateMany({ where: { id: token.id, purpose: "PASSWORD_RESET", usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
      if (!consumed.count) throw new BadRequestException("This password reset link is invalid or has expired.");
      await tx.user.update({ where: { id: token.userId }, data: { passwordHash, tokenVersion: { increment: 1 } } });
    });
    return { reset: true, message: "Your password has been changed. Sign in with your new password." };
  }

  @Post("v1/auth/login")
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() body: { email?: string; password?: string }) {
    const email = body.email?.trim().toLowerCase();
    if (!email || !body.password) throw new BadRequestException("Email and password are required.");
    const user = await this.db.user.findUnique({ where: { email }, include: { memberships: { include: { manufacturer: true }, orderBy: { createdAt: "asc" } } } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) throw new BadRequestException("Email or password is incorrect.");
    if (!user.emailVerifiedAt) throw new ForbiddenException("Verify your email address before signing in. You can request a new verification link.");
    if (!user.memberships.length) throw new BadRequestException("This account has no manufacturer workspace.");
    if (user.memberships.length > 1) return {
      workspaceSelectionRequired: true,
      user: { id: user.id, fullName: user.fullName, email: user.email },
      workspaces: user.memberships.map(m => ({ id: m.manufacturerId, name: m.manufacturer.legalName, role: m.role }))
    };
    const membership = user.memberships[0];
    return this.session(user, membership.manufacturerId, membership.role);
  }

  @Post("v1/auth/select-workspace")
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async selectWorkspace(@Body() body: { email?: string; password?: string; manufacturerId?: string }) {
    const email = body.email?.trim().toLowerCase();
    if (!email || !body.password || !body.manufacturerId) throw new BadRequestException("Email, password and workspace selection are required.");
    const user = await this.db.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) throw new BadRequestException("Email or password is incorrect.");
    if (!user.emailVerifiedAt) throw new ForbiddenException("Verify your email address before signing in.");
    const membership = await this.db.membership.findUnique({ where: { userId_manufacturerId: { userId: user.id, manufacturerId: body.manufacturerId } } });
    if (!membership) throw new ForbiddenException("You do not have access to that manufacturer workspace.");
    return this.session(user, membership.manufacturerId, membership.role);
  }

  private session(user: { id: string; fullName: string; email: string; tokenVersion: number }, manufacturerId: string, role: string) {
    const accessToken = this.jwt.sign({ sub: user.id, manufacturerId, role, tokenVersion: user.tokenVersion });
    return { accessToken, user: { id: user.id, fullName: user.fullName, email: user.email }, workspace: { id: manufacturerId, role } };
  }

  @Get("v1/manufacturer/me")
  @UseGuards(AuthGuard)
  async me(@Req() req: AuthRequest) {
    await this.assertWorkspaceRole(req, ["OWNER", "ADMIN", "OPERATOR", "ANALYST", "FINANCE", "SUPPORT"]);
    const manufacturer = await this.db.manufacturer.findUnique({ where: { id: req.user.manufacturerId }, include: { _count: { select: { products: true, memberships: true } } } });
    if (!manufacturer) throw new NotFoundException("Workspace not found");
    return { ...manufacturer, counts: manufacturer._count };
  }

  @Get("v1/analytics/overview")
  async analytics(@Req() req: AuthRequest) {
    await this.assertWorkspaceRole(req, ["OWNER", "ADMIN", "OPERATOR", "ANALYST", "FINANCE", "SUPPORT"]);
    const manufacturerId = req.user.manufacturerId;
    const identityWhere = { batch: { product: { manufacturerId } } };
    const [products, batches, identities, scans, recent] = await Promise.all([
      this.db.product.count({ where: { manufacturerId } }),
      this.db.batch.count({ where: { product: { manufacturerId } } }),
      this.db.productIdentity.count({ where: identityWhere }),
      this.db.verificationEvent.count({ where: { identity: { is: { batch: { product: { manufacturerId } } } } } }),
      this.db.verificationEvent.findMany({ where: { identity: { is: { batch: { product: { manufacturerId } } } } }, include: { identity: { include: { batch: { include: { product: true } } } } }, orderBy: { createdAt: "desc" }, take: 8 })
    ]);
    return { products, batches, identities, scans, recent: recent.map(event => ({ id: event.id, outcome: event.outcome, createdAt: event.createdAt, code: event.identity?.publicCode ?? null, product: event.identity?.batch.product.name ?? null, batchCode: event.identity?.batch.batchCode ?? null })) };
  }

  @Get("v1/products")
  @UseGuards(AuthGuard)
  async products(@Req() req: AuthRequest) {
    await this.assertWorkspaceRole(req, ["OWNER", "ADMIN", "OPERATOR", "ANALYST", "FINANCE", "SUPPORT"]);
    return this.db.product.findMany({ where: { manufacturerId: req.user.manufacturerId }, include: { _count: { select: { batches: true } }, batches: { select: { _count: { select: { identities: true } } } } }, orderBy: { createdAt: "desc" } });
  }

  @Post("v1/products")
  @UseGuards(AuthGuard)
  async createProduct(@Req() req: AuthRequest, @Body() body: { name?: string; brand?: string; category?: string; description?: string; nafdacRegistrationNumber?: string; sonCertificateNumber?: string }) {
    await this.assertWorkspaceRole(req, ["OWNER", "ADMIN", "OPERATOR"]);
    const name = body.name?.trim();
    if (!name) throw new BadRequestException("Product name is required.");
    return this.db.$transaction(async tx => {
      const product = await tx.product.create({ data: { manufacturerId: req.user.manufacturerId, name, brand: body.brand?.trim() || null, category: body.category?.trim() || null, description: body.description?.trim() || null, nafdacRegistrationNumber: body.nafdacRegistrationNumber?.trim() || null, sonCertificateNumber: body.sonCertificateNumber?.trim() || null } });
      await appendAudit(tx, { actor: req.user.sub, action: "PRODUCT_CREATED", targetType: "PRODUCT", targetId: product.id, reason: "Manufacturer created a product record.", metadata: { productName: product.name, category: product.category } });
      return product;
    });
  }

  @Get("v1/products/:id/batches")
  @UseGuards(AuthGuard)
  async batches(@Req() req: AuthRequest, @Param("id") id: string) {
    await this.assertWorkspaceRole(req, ["OWNER", "ADMIN", "OPERATOR", "ANALYST", "FINANCE", "SUPPORT"]);
    const product = await this.db.product.findFirst({ where: { id, manufacturerId: req.user.manufacturerId } });
    if (!product) throw new NotFoundException("Product not found");
    return this.db.batch.findMany({ where: { productId: id }, include: { _count: { select: { identities: true } } }, orderBy: { createdAt: "desc" } });
  }

  @Post("v1/products/:id/batches")
  @UseGuards(AuthGuard)
  async createBatch(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: { batchCode?: string; productionDate?: string; expiryDate?: string; quantity?: number; cartonCount?: number; unitsPerCarton?: number }) {
    await this.assertWorkspaceRole(req, ["OWNER", "ADMIN", "OPERATOR"]);
    const product = await this.db.product.findFirst({ where: { id, manufacturerId: req.user.manufacturerId } });
    if (!product) throw new NotFoundException("Product not found");
    const batchCode = body.batchCode?.trim();
    if (!batchCode) throw new BadRequestException("Batch reference is required.");
    const quantity = Number(body.quantity ?? 0);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000000) throw new BadRequestException("Production quantity must be a whole number greater than zero.");
    const cartonCount = body.cartonCount === undefined || body.cartonCount === null ? null : Number(body.cartonCount);
    const unitsPerCarton = body.unitsPerCarton === undefined || body.unitsPerCarton === null ? null : Number(body.unitsPerCarton);
    if ((cartonCount === null) !== (unitsPerCarton === null) || (cartonCount !== null && (!Number.isInteger(cartonCount) || cartonCount < 1 || !Number.isInteger(unitsPerCarton) || unitsPerCarton! < 1 || cartonCount * unitsPerCarton! !== quantity))) throw new BadRequestException("Carton count and units per carton must both be provided, and their product must equal the production quantity.");
    try {
      return await this.db.$transaction(async tx => {
        const batch = await tx.batch.create({ data: { productId: id, batchCode, quantity, cartonCount, unitsPerCarton, productionDate: body.productionDate ? new Date(body.productionDate) : null, expiryDate: body.expiryDate ? new Date(body.expiryDate) : null } });
        await appendAudit(tx, { actor: req.user.sub, action: "BATCH_CREATED", targetType: "BATCH", targetId: batch.id, reason: "Manufacturer created a production batch.", metadata: { productId: id, batchCode, quantity, cartonCount, unitsPerCarton } });
        return batch;
      });
    } catch (error: any) {
      if (error?.code === "P2002") throw new ConflictException("That batch reference already exists for this product.");
      throw error;
    }
  }

  @Post("v1/batches/:id/identities")
  @UseGuards(AuthGuard)
  async issue(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: { quantity?: number }) {
    await this.assertWorkspaceRole(req, ["OWNER", "ADMIN", "OPERATOR"]);
    const producer = await this.db.manufacturer.findUnique({ where: { id: req.user.manufacturerId }, select: { status: true } });
    if (producer?.status !== "APPROVED") throw new ForbiddenException("Your PAN producer workspace must be approved before issuing product identities.");
    const batch = await this.db.batch.findFirst({ where: { id, product: { manufacturerId: req.user.manufacturerId } }, include: { product: true } });
    if (!batch) throw new NotFoundException("Batch not found");
    const quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 250) throw new BadRequestException("Issue between 1 and 250 identities per request.");
    const pepper = process.env.TOKEN_PEPPER;
    if (!pepper || pepper.length < 32) throw new Error("TOKEN_PEPPER must be set to at least 32 characters.");
    const baseUrl = (process.env.PUBLIC_VERIFY_URL || "http://localhost:3001").replace(/\/$/, "");
    const records = Array.from({ length: quantity }, () => {
      const token = randomBytes(32).toString("base64url");
      const publicCode = "PAN-" + randomBytes(10).toString("hex").toUpperCase();
      return { token, publicCode, tokenHash: tokenDigest(token) };
    });
    const assets = await Promise.all(records.map(async r => {
      const verifyUrl = baseUrl + "/v/" + r.token;
      return { code: r.publicCode, verifyUrl, qrDataUrl: await QRCode.toDataURL(verifyUrl, { errorCorrectionLevel: "H", margin: 2, width: 320, color: { dark: "#173B32", light: "#FFFFFF" } }) };
    }));
    const created = await this.db.$transaction(async tx => {
      const alreadyIssued = await tx.productIdentity.count({ where: { batchId: id } });
      if (alreadyIssued + quantity > batch.quantity) {
        throw new BadRequestException(`This batch contains ${batch.quantity} units; ${alreadyIssued} identities have already been issued.`);
      }
      const wallet = await tx.walletEntry.aggregate({ where: { manufacturerId: req.user.manufacturerId }, _sum: { amountCredits: true } });
      if ((wallet._sum.amountCredits || 0) < quantity) throw new BadRequestException(`Insufficient code credits. ${quantity} credits are required for this issuance.`);
      const result = await tx.productIdentity.createMany({ data: records.map(r => ({ batchId: id, publicCode: r.publicCode, tokenHash: r.tokenHash, status: "EXPORTED" })) });
      await tx.walletEntry.create({ data: { manufacturerId: req.user.manufacturerId, amountCredits: -quantity, type: "ISSUANCE_DEBIT", idempotencyKey: "direct-issuance:" + randomBytes(18).toString("hex"), actorId: req.user.sub, reason: `${quantity} credits charged for direct identity export.` } });
      await appendAudit(tx, { actor: req.user.sub, action: "DIRECT_IDENTITY_EXPORT", targetType: "BATCH", targetId: id, reason: `${quantity} identities exported and ${quantity} credits charged.` });
      return result;
    }, { isolationLevel: "Serializable" });
    return { issued: created.count, batch: { id: batch.id, batchCode: batch.batchCode }, product: { name: batch.product.name, brand: batch.product.brand }, identities: assets, notice: "Each QR identity is unique. Keep this export secure: verification URLs contain bearer tokens." };
  }

  @Get("v1/verify/code/:code")
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async verifyCode(@Param("code") code: string, @Headers("x-pan-scan-session") scanSession?: string) {
    const identity = await this.db.productIdentity.findUnique({ where: { publicCode: code.trim().toUpperCase() }, include: { batch: { include: { product: { include: { manufacturer: true } } } }, carton: { select: { publicCode: true } }, _count: { select: { containedUnits: true } } } });
    if (!identity) throw new NotFoundException("This product ID is not recognised.");
    const now = new Date();
    const initialOutcome = identity.status === "REVOKED" ? "REVOKED" : identity.status === "QUARANTINED" ? "UNDER_REVIEW" : identity.batch.product.manufacturer.status !== "APPROVED" ? "MANUFACTURER_PENDING" : identity.status !== "ACTIVE" ? "NOT_ACTIVATED" : identity.batch.expiryDate && identity.batch.expiryDate < now ? "EXPIRED" : identity.firstVerifiedAt !== null ? "PREVIOUSLY_SCANNED" : "VERIFIED";
    const scan = await this.recordIdentityScan(identity.id, initialOutcome, scanSession, now, identity.verificationCount);
    const outcome = scan.outcome;
    if (outcome === "NOT_ACTIVATED") return { status: outcome, title: "Product identifier not yet activated", message: "This product identifier exists but has not yet been activated for public verification.", duplicateScan: scan.duplicate, scansRecorded: scan.scansRecorded };
    if (outcome === "SUSPICIOUS_ACTIVITY") return { status: outcome, title: "Unusual verification activity", message: "This identity has been checked from many independent sessions in a short period. This pattern is not proof of counterfeiting; inspect the product and report concerns.", scansRecorded: scan.scansRecorded };
    if (scan.duplicate && (outcome === "VERIFIED" || outcome === "PREVIOUSLY_SCANNED")) return { status: "VERIFIED", title: "Already checked in this session", message: "This identity was already checked in this browser session. Refreshes do not count as additional independent scans.", duplicateScan: true, scansRecorded: scan.scansRecorded };
    const batch = identity.batch; const product = batch.product;
    return { status: outcome, title: outcome === "VERIFIED" ? "PAN identity matched" : outcome === "PREVIOUSLY_SCANNED" ? "This identity has been scanned before" : outcome === "UNDER_REVIEW" ? "Product under review" : outcome === "MANUFACTURER_PENDING" ? "Manufacturer review pending" : outcome === "EXPIRED" ? "Recorded expiry date has passed" : "Identity revoked", message: outcome === "EXPIRED" ? "The producer batch record shows that this product has passed its recorded expiry date. Do not use or consume it; check the packaging and contact the producer." : outcome === "VERIFIED" ? "This code matches an active identity issued under the named producer’s PAN workspace. It indicates that the code was issued under this producer account; it does not independently prove the physical item was made by that producer or validate its contents, quality or regulatory status." : outcome === "PREVIOUSLY_SCANNED" ? "This code has been checked before. This is not proof of counterfeiting; compare the product details and contact the manufacturer if anything looks unusual." : outcome === "UNDER_REVIEW" ? "This identity is temporarily under review. Contact the manufacturer before relying on this product." : outcome === "MANUFACTURER_PENDING" ? "This code matches an identity record, but the manufacturer has not yet completed PAN approval. This is not a PAN endorsement of the product." : "This identity is no longer active in the PAN network.", product: { name: product.name, brand: product.brand, category: product.category, manufacturer: product.manufacturer.legalName, batchCode: batch.batchCode, productionDate: batch.productionDate, expiryDate: batch.expiryDate, packaging: { identityLevel: identity.level, cartonCode: identity.carton?.publicCode ?? null, containedUnitCount: identity.level === "CARTON" ? identity._count.containedUnits : null }, regulatoryReferences: { nafdacRegistrationNumber: product.nafdacRegistrationNumber, sonCertificateNumber: product.sonCertificateNumber, source: "PRODUCER_PROVIDED_NOT_VERIFIED_BY_PAN" } }, checkedAt: now.toISOString(), scansRecorded: identity.verificationCount + 1 };
  }

  @Get("v1/verify/:token")
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async verify(@Param("token") token: string, @Headers("x-pan-scan-session") scanSession?: string) {
    if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) throw new NotFoundException("This product identity is not recognised.");
    const identity = await this.db.productIdentity.findUnique({ where: { tokenHash: tokenDigest(token) }, include: { batch: { include: { product: { include: { manufacturer: true } } } }, carton: { select: { publicCode: true } }, _count: { select: { containedUnits: true } } } });
    if (!identity) {
      await this.db.verificationEvent.create({ data: { outcome: "NOT_RECOGNISED" } });
      return { status: "NOT_RECOGNISED", title: "Identity not recognised", message: "We could not find this code in the PAN network. Check that you scanned the code on the product itself." };
    }
    const now = new Date();
    const initialOutcome = identity.status === "REVOKED" ? "REVOKED" : identity.status === "QUARANTINED" ? "UNDER_REVIEW" : identity.batch.product.manufacturer.status !== "APPROVED" ? "MANUFACTURER_PENDING" : identity.status !== "ACTIVE" ? "NOT_ACTIVATED" : identity.batch.expiryDate && identity.batch.expiryDate < now ? "EXPIRED" : identity.firstVerifiedAt !== null ? "PREVIOUSLY_SCANNED" : "VERIFIED";
    const scan = await this.recordIdentityScan(identity.id, initialOutcome, scanSession, now, identity.verificationCount);
    const outcome = scan.outcome;
    if (outcome === "NOT_ACTIVATED") return { status: outcome, title: "Product identifier not yet activated", message: "This product identifier exists but has not yet been activated for public verification.", duplicateScan: scan.duplicate, scansRecorded: scan.scansRecorded };
    if (outcome === "SUSPICIOUS_ACTIVITY") return { status: outcome, title: "Unusual verification activity", message: "This identity has been checked from many independent sessions in a short period. This pattern is not proof of counterfeiting; inspect the product and report concerns.", scansRecorded: scan.scansRecorded };
    if (scan.duplicate && (outcome === "VERIFIED" || outcome === "PREVIOUSLY_SCANNED")) return { status: "VERIFIED", title: "Already checked in this session", message: "This identity was already checked in this browser session. Refreshes do not count as additional independent scans.", duplicateScan: true, scansRecorded: scan.scansRecorded };
    const batch = identity.batch; const product = batch.product;
    return {
      status: outcome,
      title: outcome === "VERIFIED" ? "Product identity verified" : outcome === "PREVIOUSLY_SCANNED" ? "This identity has been scanned before" : outcome === "UNDER_REVIEW" ? "Product under review" : outcome === "MANUFACTURER_PENDING" ? "Manufacturer review pending" : outcome === "EXPIRED" ? "Recorded expiry date has passed" : "Identity revoked",
      message: outcome === "VERIFIED" ? "This code matches an active identity in the PAN network. No known issue has been recorded for this identity." : outcome === "PREVIOUSLY_SCANNED" ? "This code has been checked before. This is not proof of counterfeiting; compare the product details and contact the manufacturer if anything looks unusual." : outcome === "UNDER_REVIEW" ? "This identity is temporarily under review. Contact the manufacturer before relying on this product." : outcome === "MANUFACTURER_PENDING" ? "This code matches an identity record, but the manufacturer has not yet completed PAN approval. This is not a PAN endorsement of the product." : "This identity is no longer active in the PAN network.",
      product: { name: product.name, brand: product.brand, category: product.category, manufacturer: product.manufacturer.legalName, batchCode: batch.batchCode, productionDate: batch.productionDate, expiryDate: batch.expiryDate, packaging: { identityLevel: identity.level, cartonCode: identity.carton?.publicCode ?? null, containedUnitCount: identity.level === "CARTON" ? identity._count.containedUnits : null }, regulatoryReferences: { nafdacRegistrationNumber: product.nafdacRegistrationNumber, sonCertificateNumber: product.sonCertificateNumber, source: "PRODUCER_PROVIDED_NOT_VERIFIED_BY_PAN" } },
      checkedAt: now.toISOString(),
      scansRecorded: identity.verificationCount + 1
    };
  }
}