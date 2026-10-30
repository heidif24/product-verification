import { Body, Controller, Get, Param, Post, Req, UseGuards, BadRequestException, NotFoundException, ConflictException, ForbiddenException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import * as bcrypt from "bcryptjs";
import * as QRCode from "qrcode";
import { PrismaService } from "./prisma.service";
import { AuthGuard, AuthRequest, Public } from "./auth";

const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
const tokenDigest = (token: string) => createHmac("sha256", process.env.TOKEN_PEPPER!).update(token).digest("hex");

@Controller()
export class AppController {
  constructor(private db: PrismaService, private jwt: JwtService) {}

  @Get("health")
  @Public()
  health() { return { status: "ok", service: "pan-api", timestamp: new Date().toISOString() }; }

  @Post("v1/auth/register")
  @Public()
  async register(@Body() body: { fullName?: string; email?: string; password?: string; companyName?: string }) {
    const fullName = body.fullName?.trim(), email = body.email?.trim().toLowerCase(), password = body.password ?? "", companyName = body.companyName?.trim();
    if (!fullName || !email || !companyName || password.length < 10) throw new BadRequestException("Enter your name, company, valid email and a password of at least 10 characters.");
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
    return this.session(created.user, created.manufacturer.id, "OWNER");
  }

  @Post("v1/auth/login")
  @Public()
  async login(@Body() body: { email?: string; password?: string }) {
    const email = body.email?.trim().toLowerCase();
    if (!email || !body.password) throw new BadRequestException("Email and password are required.");
    const user = await this.db.user.findUnique({ where: { email }, include: { memberships: { include: { manufacturer: true }, orderBy: { createdAt: "asc" }, take: 1 } } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) throw new BadRequestException("Email or password is incorrect.");
    const membership = user.memberships[0];
    if (!membership) throw new BadRequestException("This account has no manufacturer workspace.");
    return this.session(user, membership.manufacturerId, membership.role);
  }

  private session(user: { id: string; fullName: string; email: string }, manufacturerId: string, role: string) {
    const accessToken = this.jwt.sign({ sub: user.id, manufacturerId, role });
    return { accessToken, user: { id: user.id, fullName: user.fullName, email: user.email }, workspace: { id: manufacturerId, role } };
  }

  @Post("v1/admin/manufacturers/:id/approve")
  @Public()
  async approveManufacturer(@Req() req: AuthRequest, @Param("id") id: string) {
    const provided = req.headers["x-pan-admin-key"];
    const expected = process.env.ADMIN_API_KEY || "";
    if (typeof provided !== "string" || !expected || provided.length !== expected.length || !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
      throw new ForbiddenException("Administrator credentials are invalid.");
    }
    return this.db.manufacturer.update({ where: { id }, data: { status: "APPROVED" }, select: { id: true, legalName: true, status: true, updatedAt: true } });
  }

  @Get("v1/manufacturer/me")
  @UseGuards(AuthGuard)
  async me(@Req() req: AuthRequest) {
    const manufacturer = await this.db.manufacturer.findUnique({ where: { id: req.user.manufacturerId }, include: { _count: { select: { products: true, memberships: true } } } });
    if (!manufacturer) throw new NotFoundException("Workspace not found");
    return { ...manufacturer, counts: manufacturer._count };
  }

  @Get("v1/products")
  @UseGuards(AuthGuard)
  async products(@Req() req: AuthRequest) {
    return this.db.product.findMany({ where: { manufacturerId: req.user.manufacturerId }, include: { _count: { select: { batches: true } }, batches: { select: { _count: { select: { identities: true } } } } }, orderBy: { createdAt: "desc" } });
  }

  @Post("v1/products")
  @UseGuards(AuthGuard)
  async createProduct(@Req() req: AuthRequest, @Body() body: { name?: string; brand?: string; category?: string; description?: string }) {
    const name = body.name?.trim();
    if (!name) throw new BadRequestException("Product name is required.");
    return this.db.product.create({ data: { manufacturerId: req.user.manufacturerId, name, brand: body.brand?.trim() || null, category: body.category?.trim() || null, description: body.description?.trim() || null } });
  }

  @Get("v1/products/:id/batches")
  @UseGuards(AuthGuard)
  async batches(@Req() req: AuthRequest, @Param("id") id: string) {
    const product = await this.db.product.findFirst({ where: { id, manufacturerId: req.user.manufacturerId } });
    if (!product) throw new NotFoundException("Product not found");
    return this.db.batch.findMany({ where: { productId: id }, include: { _count: { select: { identities: true } } }, orderBy: { createdAt: "desc" } });
  }

  @Post("v1/products/:id/batches")
  @UseGuards(AuthGuard)
  async createBatch(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: { batchCode?: string; productionDate?: string; expiryDate?: string; quantity?: number }) {
    const product = await this.db.product.findFirst({ where: { id, manufacturerId: req.user.manufacturerId } });
    if (!product) throw new NotFoundException("Product not found");
    const batchCode = body.batchCode?.trim();
    if (!batchCode) throw new BadRequestException("Batch reference is required.");
    const quantity = Number(body.quantity ?? 0);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000000) throw new BadRequestException("Production quantity must be a whole number greater than zero.");
    try {
      return await this.db.batch.create({ data: { productId: id, batchCode, quantity, productionDate: body.productionDate ? new Date(body.productionDate) : null, expiryDate: body.expiryDate ? new Date(body.expiryDate) : null } });
    } catch (error: any) {
      if (error?.code === "P2002") throw new ConflictException("That batch reference already exists for this product.");
      throw error;
    }
  }

  @Post("v1/batches/:id/identities")
  @UseGuards(AuthGuard)
  async issue(@Req() req: AuthRequest, @Param("id") id: string, @Body() body: { quantity?: number }) {
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
      return tx.productIdentity.createMany({ data: records.map(r => ({ batchId: id, publicCode: r.publicCode, tokenHash: r.tokenHash })) });
    }, { isolationLevel: "Serializable" });
    return { issued: created.count, batch: { id: batch.id, batchCode: batch.batchCode }, product: { name: batch.product.name, brand: batch.product.brand }, identities: assets, notice: "Each QR identity is unique. Keep this export secure: verification URLs contain bearer tokens." };
  }

  @Get("v1/verify/code/:code")
  @Public()
  async verifyCode(@Param("code") code: string) {
    const identity = await this.db.productIdentity.findUnique({ where: { publicCode: code.trim().toUpperCase() }, include: { batch: { include: { product: { include: { manufacturer: true } } } } } });
    if (!identity) throw new NotFoundException("This product ID is not recognised.");
    const now = new Date();
    const outcome = identity.status === "REVOKED" ? "REVOKED" : identity.status === "QUARANTINED" ? "UNDER_REVIEW" : identity.batch.product.manufacturer.status !== "APPROVED" ? "MANUFACTURER_PENDING" : identity.firstVerifiedAt !== null ? "PREVIOUSLY_SCANNED" : "VERIFIED";
    await this.db.$transaction([
      this.db.productIdentity.update({ where: { id: identity.id }, data: { verificationCount: { increment: 1 }, firstVerifiedAt: outcome === "VERIFIED" ? now : identity.firstVerifiedAt, lastVerifiedAt: now } }),
      this.db.verificationEvent.create({ data: { identityId: identity.id, outcome: "MANUAL_" + outcome } })
    ]);
    const { product, batch } = identity.batch;
    return { status: outcome, title: outcome === "VERIFIED" ? "Product identity verified" : outcome === "PREVIOUSLY_SCANNED" ? "This identity has been scanned before" : outcome === "UNDER_REVIEW" ? "Product under review" : outcome === "MANUFACTURER_PENDING" ? "Manufacturer review pending" : "Identity revoked", message: outcome === "VERIFIED" ? "This code matches an active identity in the PAN network. No known issue has been recorded for this identity." : outcome === "PREVIOUSLY_SCANNED" ? "This code has been checked before. This is not proof of counterfeiting; compare the product details and contact the manufacturer if anything looks unusual." : outcome === "UNDER_REVIEW" ? "This identity is temporarily under review. Contact the manufacturer before relying on this product." : outcome === "MANUFACTURER_PENDING" ? "This code matches an identity record, but the manufacturer has not yet completed PAN approval. This is not a PAN endorsement of the product." : "This identity is no longer active in the PAN network.", product: { name: product.name, brand: product.brand, category: product.category, manufacturer: product.manufacturer.legalName, batchCode: batch.batchCode, productionDate: batch.productionDate, expiryDate: batch.expiryDate }, checkedAt: now.toISOString(), scansRecorded: identity.verificationCount + 1 };
  }

  @Get("v1/verify/:token")
  @Public()
  async verify(@Param("token") token: string) {
    if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) throw new NotFoundException("This product identity is not recognised.");
    const identity = await this.db.productIdentity.findUnique({ where: { tokenHash: tokenDigest(token) }, include: { batch: { include: { product: { include: { manufacturer: true } } } } } });
    if (!identity) {
      await this.db.verificationEvent.create({ data: { outcome: "NOT_RECOGNISED" } });
      return { status: "NOT_RECOGNISED", title: "Identity not recognised", message: "We could not find this code in the PAN network. Check that you scanned the code on the product itself." };
    }
    const now = new Date();
    const outcome = identity.status === "REVOKED" ? "REVOKED" : identity.status === "QUARANTINED" ? "UNDER_REVIEW" : identity.batch.product.manufacturer.status !== "APPROVED" ? "MANUFACTURER_PENDING" : identity.firstVerifiedAt !== null ? "PREVIOUSLY_SCANNED" : "VERIFIED";
    await this.db.$transaction([
      this.db.productIdentity.update({ where: { id: identity.id }, data: { verificationCount: { increment: 1 }, firstVerifiedAt: outcome === "VERIFIED" ? now : identity.firstVerifiedAt, lastVerifiedAt: now } }),
      this.db.verificationEvent.create({ data: { identityId: identity.id, outcome } })
    ]);
    const { product, batch } = identity.batch;
    return {
      status: outcome,
      title: outcome === "VERIFIED" ? "Product identity verified" : outcome === "PREVIOUSLY_SCANNED" ? "This identity has been scanned before" : outcome === "UNDER_REVIEW" ? "Product under review" : outcome === "MANUFACTURER_PENDING" ? "Manufacturer review pending" : "Identity revoked",
      message: outcome === "VERIFIED" ? "This code matches an active identity in the PAN network. No known issue has been recorded for this identity." : outcome === "PREVIOUSLY_SCANNED" ? "This code has been checked before. This is not proof of counterfeiting; compare the product details and contact the manufacturer if anything looks unusual." : outcome === "UNDER_REVIEW" ? "This identity is temporarily under review. Contact the manufacturer before relying on this product." : outcome === "MANUFACTURER_PENDING" ? "This code matches an identity record, but the manufacturer has not yet completed PAN approval. This is not a PAN endorsement of the product." : "This identity is no longer active in the PAN network.",
      product: { name: product.name, brand: product.brand, category: product.category, manufacturer: product.manufacturer.legalName, batchCode: batch.batchCode, productionDate: batch.productionDate, expiryDate: batch.expiryDate },
      checkedAt: now.toISOString(),
      scansRecorded: identity.verificationCount + 1
    };
  }
}