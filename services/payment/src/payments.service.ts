import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DomainEvent, EventBus } from './event-bus';
import { PrismaService } from './prisma.service';

@Injectable()
export class PaymentsService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private busy = false;
  private readonly logger = new Logger(PaymentsService.name);
  constructor(private readonly prisma: PrismaService, private readonly bus: EventBus) {}
  async onModuleInit() {
    await this.bus.start('payment-processing', ['order.created'], event => this.process(event));
    if (process.env.KAFKA_BROKERS) {
      this.timer = setInterval(() => void this.flush(), 500);
      this.timer.unref();
    }
  }
  onModuleDestroy() { clearInterval(this.timer); }

  async process(event: DomainEvent) {
    const data = event.data;
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${data.orderId})::text`;
      if (await tx.payment.findUnique({ where: { orderId: data.orderId } })) return;
      const success = data.paymentMethod !== 'demo_failure';
      // Simulation only. A real provider needs its own idempotency key and
      // reconciliation; a database transaction cannot wrap a remote charge.
      await tx.payment.create({ data: { orderId: data.orderId, userId: data.userId, amountVnd: data.totalVnd!, status: success ? 'SUCCEEDED' : 'FAILED' } });
      await tx.outbox.create({ data: {
        topic: success ? 'payment.succeeded' : 'payment.failed', aggregateId: String(data.orderId),
        payload: { orderId: data.orderId, userId: data.userId, restaurantId: data.restaurantId, totalVnd: data.totalVnd },
      } });
    });
  }

  private async flush() {
    if (this.busy) return;
    this.busy = true;
    try {
      const rows = await this.prisma.outbox.findMany({ where: { sentAt: null }, take: 50, orderBy: { createdAt: 'asc' } });
      for (const row of rows) {
        await this.bus.publish(row.id, row.topic, row.aggregateId, row.payload);
        await this.prisma.outbox.update({ where: { id: row.id }, data: { sentAt: new Date() } });
      }
    } catch { this.logger.warn('Payment outbox delivery failed; retrying'); }
    finally { this.busy = false; }
  }
}
