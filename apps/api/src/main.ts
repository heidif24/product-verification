import "dotenv/config";
import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  for (const key of ["JWT_SECRET", "TOKEN_PEPPER", "ADMIN_API_KEY"] as const) {
    const value = process.env[key];
    if (!value || value.length < 32 || value.startsWith("replace-with-")) {
      throw new Error(`${key} must be configured with an independent random secret of at least 32 characters.`);
    }
  }
  const app = await NestFactory.create(AppModule);
  const origins = (process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:3001").split(",").map(x => x.trim());
  app.enableCors({ origin: origins, credentials: true });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
  await app.listen(Number(process.env.PORT || 4000), "0.0.0.0");
}
bootstrap();
