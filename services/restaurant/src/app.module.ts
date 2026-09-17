import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { EventBus } from './event-bus';
import { EventsService } from './events.service';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { InternalGuard } from './internal.guard';
import { CatalogController, ReservationController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [HealthController, CatalogController, ReservationController],
  providers: [PrismaService, CatalogService,
    EventBus, EventsService,
    { provide: APP_GUARD, useClass: InternalGuard },
    { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }) },
  ],
})
export class AppModule {}
