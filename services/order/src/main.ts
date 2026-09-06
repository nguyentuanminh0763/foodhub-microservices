import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Every route is /api/... so the gateway can forward the path unchanged.
  app.setGlobalPrefix('api');
  await app.listen(process.env.PORT ?? 3002);
}

bootstrap();
