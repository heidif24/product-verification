import "dotenv/config";
import "reflect-metadata";
import helmet from "helmet";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

function assertProductionConfiguration() {
  const required = [
    "DATABASE_URL", "JWT_SECRET", "TOKEN_PEPPER", "ADMIN_API_KEY", "EXPORT_ENCRYPTION_KEY",
    "SUPER_ADMIN_EMAIL", "SUPER_ADMIN_PASSWORD_HASH", "PUBLIC_VERIFY_URL", "MANUFACTURER_APP_URL",
    "CORS_ORIGINS", "SMTP_HOST", "MAIL_FROM", "PRIVACY_CONTACT_EMAIL",
    "S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"
  ] as const;
  for (const key of required) {
    if (!process.env[key]?.trim()) throw new Error(`${key} is required in production.`);
  }

  for (const key of ["JWT_SECRET", "TOKEN_PEPPER", "ADMIN_API_KEY"] as const) {
    const value = process.env[key]!;
    if (value.length < 32 || value.startsWith("replace-with-")) throw new Error(`${key} must be a secure secret of at least 32 characters.`);
  }
  if (new Set([process.env.JWT_SECRET, process.env.TOKEN_PEPPER, process.env.ADMIN_API_KEY]).size !== 3) {
    throw new Error("JWT_SECRET, TOKEN_PEPPER and ADMIN_API_KEY must be different secrets.");
  }
  if (!/^[a-f0-9]{64}$/i.test(process.env.EXPORT_ENCRYPTION_KEY || "")) {
    throw new Error("EXPORT_ENCRYPTION_KEY must be 32 random bytes encoded as 64 hexadecimal characters.");
  }
  if (!/^\$2[aby]\$/.test(process.env.SUPER_ADMIN_PASSWORD_HASH || "")) {
    throw new Error("SUPER_ADMIN_PASSWORD_HASH must be a bcrypt password hash.");
  }
  if (!/\bsslmode=require\b/i.test(process.env.DATABASE_URL || "")) {
    throw new Error("The production DATABASE_URL must require TLS with sslmode=require.");
  }

  for (const key of ["PUBLIC_VERIFY_URL", "MANUFACTURER_APP_URL"] as const) {
    let parsed: URL;
    try { parsed = new URL(process.env[key]!); } catch { throw new Error(`${key} must be a valid absolute URL.`); }
    if (parsed.protocol !== "https:") throw new Error(`${key} must use HTTPS in production.`);
  }
  const origins = process.env.CORS_ORIGINS!.split(",").map(value => value.trim()).filter(Boolean);
  if (!origins.length || origins.some(origin => {
    try { return new URL(origin).protocol !== "https:" || new URL(origin).origin !== origin; }
    catch { return true; }
  })) throw new Error("Production CORS_ORIGINS must contain exact HTTPS origins only (no paths or wildcards).");
  const requiredOrigins = [new URL(process.env.MANUFACTURER_APP_URL!).origin, new URL(process.env.PUBLIC_VERIFY_URL!).origin];
  if (requiredOrigins.some(origin => !origins.includes(origin))) {
    throw new Error("CORS_ORIGINS must include the manufacturer and public verification website origins.");
  }
  if (process.env.S3_ENDPOINT) {
    let endpoint: URL;
    try { endpoint = new URL(process.env.S3_ENDPOINT); } catch { throw new Error("S3_ENDPOINT must be a valid URL."); }
    if (endpoint.protocol !== "https:") throw new Error("S3_ENDPOINT must use HTTPS in production.");
  }
  if (process.env.SMTP_USER && !process.env.SMTP_PASSWORD) throw new Error("SMTP_PASSWORD is required when SMTP_USER is configured.");
}

async function bootstrap() {
  for (const key of ["JWT_SECRET", "TOKEN_PEPPER", "ADMIN_API_KEY"] as const) {
    const value = process.env[key];
    if (!value || value.length < 32 || value.startsWith("replace-with-")) throw new Error(`${key} must be configured with a secure independent secret.`);
  }
  if (!/^[a-f0-9]{64}$/i.test(process.env.EXPORT_ENCRYPTION_KEY || "")) {
    throw new Error("EXPORT_ENCRYPTION_KEY must be 32 random bytes encoded as 64 hexadecimal characters.");
  }
  if (process.env.NODE_ENV === "production") assertProductionConfiguration();

  const app = await NestFactory.create(AppModule);
  const origins = (process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:3001").split(",").map(x => x.trim());
  app.enableCors({ origin: origins, credentials: true });
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 4000), "0.0.0.0");
}
bootstrap();
