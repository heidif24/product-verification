import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { AuthGuard } from "./auth";
import { PrismaService } from "./prisma.service";
import { IssuanceWorker } from "./issuance.worker";
import { ManufacturerOperationsController, SuperAdminAuthController, SuperAdminController, SuperAdminGuard } from "./operations.controller";

@Module({
  imports: [
    JwtModule.register({ secret: process.env.JWT_SECRET!, signOptions: { expiresIn: "12h" } }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }])
  ],
  controllers: [AppController, ManufacturerOperationsController, SuperAdminAuthController, SuperAdminController],
  providers: [
    PrismaService, IssuanceWorker, SuperAdminGuard,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard }
  ]
})
export class AppModule {}
