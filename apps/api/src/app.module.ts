import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { AppController } from "./app.controller";
import { AuthGuard } from "./auth";
import { PrismaService } from "./prisma.service";

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET!, signOptions: { expiresIn: "12h" } })],
  controllers: [AppController],
  providers: [PrismaService, { provide: APP_GUARD, useClass: AuthGuard }]
})
export class AppModule {}