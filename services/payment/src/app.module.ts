import { Controller, Get, Module, NotFoundException, Param, ParseIntPipe, Req, Res } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { Request, Response } from 'express';
import { PrismaService } from './prisma.service';
import { PaymentsService } from './payments.service';
import { EventBus } from './event-bus';
import { InternalGuard } from './internal.guard';

@Controller('payments')
class PaymentsController {
  constructor(private readonly prisma: PrismaService, private readonly bus: EventBus) {}
  @Get('health') async health(@Res({ passthrough: true }) res: Response) {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      if (process.env.KAFKA_BROKERS && !this.bus.ready) throw new Error();
      return { service: 'payment', status: 'ok', database: 'up', kafka: this.bus.ready ? 'up' : 'disabled' };
    } catch { res.status(503); return { service: 'payment', status: 'degraded' }; }
  }
  @Get(':orderId') async get(@Param('orderId', ParseIntPipe) orderId: number, @Req() req: Request) {
    const userId = typeof req.headers['x-user-id'] === 'string' ? req.headers['x-user-id'] : '';
    const payment = await this.prisma.payment.findFirst({ where: { orderId, ...(req.headers['x-user-role'] === 'admin' ? {} : { userId }) } });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }
}

@Module({ controllers: [PaymentsController], providers: [PrismaService, EventBus, PaymentsService, { provide: APP_GUARD, useClass: InternalGuard }] })
export class AppModule {}
