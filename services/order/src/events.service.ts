import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventBus } from './event-bus';
import { OrdersService } from './orders.service';
import { PrismaService } from './prisma.service';

@Injectable()
export class EventsService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private busy = false;
  private readonly logger = new Logger(EventsService.name);
  constructor(private readonly bus: EventBus, private readonly orders: OrdersService, private readonly prisma: PrismaService) {}
  async onModuleInit() {
    await this.bus.start('order-payments', ['payment.succeeded', 'payment.failed'], async event => {
      await this.orders.paymentResult(event.data.orderId, event.type === 'payment.succeeded');
    });
    if (process.env.KAFKA_BROKERS) {
      this.timer = setInterval(() => void this.flush(), 500);
      this.timer.unref();
    }
  }
  onModuleDestroy() { clearInterval(this.timer); }
  private async flush() {
    if (this.busy) return;
    this.busy = true;
    try {
      const rows = await this.prisma.outbox.findMany({ where: { sentAt: null }, orderBy: { createdAt: 'asc' }, take: 50 });
      for (const row of rows) {
        await this.bus.publish(row.id, row.topic, row.aggregateId, row.payload);
        await this.prisma.outbox.update({ where: { id: row.id }, data: { sentAt: new Date() } });
      }
    } catch { this.logger.warn('Outbox delivery failed; retrying committed events'); }
    finally { this.busy = false; }
  }
}
