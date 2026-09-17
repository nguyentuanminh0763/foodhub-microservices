import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  // Node 22 stdlib, so no dotenv. Guarded: in a container the variable comes
  // from compose and no .env exists.
  if (existsSync('.env')) process.loadEnvFile();
  if (!process.env.INTERNAL_TOKEN) throw new Error('INTERNAL_TOKEN is required');

  const app = await NestFactory.create(AppModule);
  // Every route is /api/... so the gateway can forward the path unchanged.
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  SwaggerModule.setup('api/restaurants/docs', app, SwaggerModule.createDocument(app,
    new DocumentBuilder().setTitle('FoodHub Restaurant API').setVersion('1.0').addBearerAuth().build()));
  await app.listen(process.env.PORT ?? 3001);
}

bootstrap();
