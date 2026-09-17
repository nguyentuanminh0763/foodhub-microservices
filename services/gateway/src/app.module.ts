import { Module, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { AccessGuard, AuthController, AuthService } from './auth';
import { ProxyController } from './proxy.controller';

@Module({
  controllers: [AuthController, ProxyController],
  providers: [AuthService,
    { provide: APP_GUARD, useClass: AccessGuard },
    { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }) },
  ],
})
export class AppModule {}
