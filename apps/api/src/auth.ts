import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";

export const IS_PUBLIC = "pan:is-public";
export const Public = () => SetMetadata(IS_PUBLIC, true);
export type AuthRequest = Request & { user: { sub: string; manufacturerId: string; role: string } };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const isPublic = Reflect.getMetadata(IS_PUBLIC, context.getHandler());
    if (isPublic) return true;
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new UnauthorizedException("Sign in to continue");
    try {
      req.user = await this.jwt.verifyAsync(header.slice(7));
      return Boolean(req.user.sub && req.user.manufacturerId);
    } catch { throw new UnauthorizedException("Your session has expired. Please sign in again."); }
  }
}