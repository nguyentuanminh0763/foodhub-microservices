import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // Node 22 stdlib, so no dotenv. Guarded: in a container the variable comes
  // from compose and no .env exists.
  if (existsSync('.env')) process.loadEnvFile();

  const app = await NestFactory.create(AppModule);
  // Every route is /api/... so the gateway can forward the path unchanged.
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 3001);
}

bootstrap();
