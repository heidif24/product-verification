import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { PrismaService } from "./prisma.service";

export const IS_PUBLIC = "pan:is-public";
export const Public = () => SetMetadata(IS_PUBLIC, true);
export type AuthRequest = Request & { user: { sub: string; manufacturerId: string; role: string; tokenVersion?: number } };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private db: PrismaService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const isPublic = Reflect.getMetadata(IS_PUBLIC, context.getHandler());
    if (isPublic) return true;
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new UnauthorizedException("Sign in to continue");
    try {
      req.user = await this.jwt.verifyAsync(header.slice(7));
      if (req.user.role === "SUPER_ADMIN") return Boolean(req.user.sub);
      if (!req.user.sub || !req.user.manufacturerId) throw new UnauthorizedException("Your session is invalid.");
      const user = await this.db.user.findUnique({ where: { id: req.user.sub }, select: { tokenVersion: true, emailVerifiedAt: true } });
      const membership = await this.db.membership.findUnique({ where: { userId_manufacturerId: { userId: req.user.sub, manufacturerId: req.user.manufacturerId } } });
      if (!user || !user.emailVerifiedAt || user.tokenVersion !== (req.user.tokenVersion ?? -1) || !membership) throw new UnauthorizedException("Your session is no longer active. Please sign in again.");
      req.user.role = membership.role;
      return true;
    } catch { throw new UnauthorizedException("Your session has expired. Please sign in again."); }
  }
}