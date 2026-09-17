import { Controller, Get, Module, Req, Res, UnauthorizedException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { Request, Response } from 'express';
import { InternalGuard } from './internal.guard';
import { EventBus } from './event-bus';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
class NotificationsController {
  constructor(private readonly notifications: NotificationsService, private readonly bus: EventBus) {}
  @Get('health') async health(@Res({ passthrough: true }) res: Response) {
    try {
      await this.notifications.redis.ping();
      if (process.env.KAFKA_BROKERS && !this.bus.ready) throw new Error();
      return { service: 'notification', status: 'ok', redis: 'up', kafka: this.bus.ready ? 'up' : 'disabled' };
    } catch { res.status(503); return { service: 'notification', status: 'degraded' }; }
  }
  @Get() list(@Req() req: Request) {
    const user = req.headers['x-user-id'];
    if (typeof user !== 'string' || !user) throw new UnauthorizedException();
    return this.notifications.list(user, req.headers['x-user-role'] === 'admin');
  }
}

@Module({ controllers: [NotificationsController], providers: [EventBus, NotificationsService, { provide: APP_GUARD, useClass: InternalGuard }] })
export class AppModule {}
