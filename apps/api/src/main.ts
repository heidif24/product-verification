import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const origins = (process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:3001").split(",").map(x => x.trim());
  app.enableCors({ origin: origins, credentials: true });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }));
  await app.listen(Number(process.env.PORT || 4000), "0.0.0.0");
}
bootstrap();