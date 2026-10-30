import "dotenv/config";
import "reflect-metadata";
import helmet from "helmet";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  for (const key of ["JWT_SECRET", "TOKEN_PEPPER", "ADMIN_API_KEY", "EXPORT_ENCRYPTION_KEY"] as const) {
    const value = process.env[key];
    const valid = key === "EXPORT_ENCRYPTION_KEY" ? /^[a-f0-9]{64}$/i.test(value || "") : Boolean(value && value.length >= 32 && !value.startsWith("replace-with-"));
    if (!valid) throw new Error(`${key} must be configured with a secure independent secret.`);
  }
  if (process.env.NODE_ENV === "production") {
    for (const key of ["SMTP_HOST", "SUPER_ADMIN_EMAIL", "SUPER_ADMIN_PASSWORD_HASH", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) {
      if (!process.env[key]) throw new Error(`${key} is required in production.`);
    }
  }
  const app = await NestFactory.create(AppModule);
  const origins = (process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:3001").split(",").map(x => x.trim());
  app.enableCors({ origin: origins, credentials: true });
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
  await app.listen(Number(process.env.PORT || 4000), "0.0.0.0");
}
bootstrap();
