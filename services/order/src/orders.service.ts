import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateOrderDto } from './orders.dto';

interface PricedItem { dishId: number; dishName: string; priceVnd: number; quantity: number }

@Injectable()
export class OrdersService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private recovering = false;
  private readonly logger = new Logger(OrdersService.name);
  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Resume requests interrupted between the HTTP reservation and the local
    // commit. The durable request and reservation key survive process restarts.
    if (process.env.RESTAURANT_SERVICE_URL) {
      this.timer = setInterval(() => void this.recover(), 5000);
      this.timer.unref();
    }
  }
  onModuleDestroy() { clearInterval(this.timer); }

  private async recover() {
    if (this.recovering) return;
    this.recovering = true;
    try {
      const pending = await this.prisma.order.findMany({ where: { status: 'RESERVING' }, take: 50, orderBy: { id: 'asc' } });
      for (const order of pending) {
        try { await this.finish(order.id); } catch { /* persisted failure or retry on next tick */ }
      }
    } catch { this.logger.warn('Checkout recovery temporarily unavailable'); }
    finally { this.recovering = false; }
  }

  list(userId: string, admin: boolean, offset: number) {
    return this.prisma.order.findMany({ where: admin ? {} : { userId }, skip: offset, take: 50, include: { items: true }, orderBy: { id: 'desc' } });
  }

  async get(id: number, userId: string, admin: boolean) {
    const order = await this.prisma.order.findFirst({ where: { id, ...(admin ? {} : { userId }) }, include: { items: true } });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async create(userId: string, requestKey: string, input: CreateOrderDto) {
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(requestKey)) throw new BadRequestException('Idempotency-Key must contain 8-100 letters, digits, underscores or hyphens');
    const items = input.items.map(i => ({ dishId: i.dishId, quantity: i.quantity })).sort((a, b) => a.dishId - b.dishId);
    if (new Set(items.map(i => i.dishId)).size !== items.length) throw new BadRequestException('Duplicate dish');
    const request = { restaurantId: input.restaurantId, items, paymentMethod: input.paymentMethod ?? 'demo_success' };
    const order = await this.prisma.order.upsert({
      where: { userId_requestKey: { userId, requestKey } }, update: {},
      create: { userId, requestKey, restaurantId: input.restaurantId, request, status: 'RESERVING', totalVnd: 0 },
    });
    const old = order.request as unknown as typeof request;
    if (old.restaurantId !== request.restaurantId || old.paymentMethod !== request.paymentMethod ||
        old.items.length !== items.length || old.items.some((i, n) => i.dishId !== items[n].dishId || i.quantity !== items[n].quantity)) {
      throw new ConflictException('Idempotency-Key was already used for another cart');
    }
    if (order.failure) throw new ConflictException(order.failure);
    return this.finish(order.id);
  }

  async finish(id: number) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
    if (order.status !== 'RESERVING') return order;
    const request = order.request as unknown as CreateOrderDto;
    let response: Response;
    try {
      response = await fetch(`${process.env.RESTAURANT_SERVICE_URL ?? 'http://localhost:3001'}/api/internal/reservations/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-token': process.env.INTERNAL_TOKEN ?? '' },
        body: JSON.stringify({ restaurantId: request.restaurantId, items: request.items }),
        signal: AbortSignal.timeout(4000),
      });
    } catch { throw new ServiceUnavailableException('Checkout is being retried; retry with the same Idempotency-Key'); }
    if (!response.ok) {
      if ([400, 404, 409].includes(response.status)) {
        const failure = 'One or more dishes are unavailable, out of stock, or the cart is invalid';
        await this.prisma.order.updateMany({ where: { id, status: 'RESERVING' }, data: { status: 'CANCELLED', failure } });
        throw new ConflictException(failure);
      }
      throw new ServiceUnavailableException('Restaurant service unavailable; retry with the same Idempotency-Key');
    }
    const items = await response.json() as PricedItem[];
    return this.prisma.$transaction(async tx => {
      const totalVnd = items.reduce((sum, i) => sum + i.priceVnd * i.quantity, 0);
      const changed = await tx.order.updateMany({ where: { id, status: 'RESERVING' }, data: { status: 'PENDING', totalVnd } });
      if (changed.count) {
        await tx.orderItem.createMany({ data: items.map(i => ({ ...i, orderId: id })) });
        await tx.outbox.create({ data: { topic: 'order.created', aggregateId: String(id), payload: {
          orderId: id, userId: order.userId, restaurantId: order.restaurantId, totalVnd, paymentMethod: request.paymentMethod ?? 'demo_success',
        } } });
      }
      return tx.order.findUniqueOrThrow({ where: { id }, include: { items: true } });
    });
  }

  async transition(id: number, status: 'CONFIRMED' | 'READY') {
    return this.prisma.$transaction(async tx => {
      const expected = status === 'CONFIRMED' ? 'PAID' : 'CONFIRMED';
      const changed = await tx.order.updateMany({ where: { id, status: expected }, data: { status } });
      const order = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!order) throw new NotFoundException('Order not found');
      if (!changed.count && order.status !== status) throw new ConflictException(`Order must be ${expected}`);
      if (changed.count) await tx.outbox.create({ data: { topic: status === 'READY' ? 'order.ready' : 'order.confirmed', aggregateId: String(id), payload: {
        orderId: id, userId: order.userId, restaurantId: order.restaurantId, totalVnd: order.totalVnd,
      } } });
      return order;
    });
  }

  async paymentResult(orderId: number, succeeded: boolean) {
    await this.prisma.$transaction(async tx => {
      const changed = await tx.order.updateMany({ where: { id: orderId, status: 'PENDING' }, data: { status: succeeded ? 'PAID' : 'CANCELLED' } });
      if (!changed.count || succeeded) return;
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      await tx.outbox.create({ data: { topic: 'order.cancelled', aggregateId: String(orderId), payload: {
        orderId, userId: order.userId, restaurantId: order.restaurantId, reason: 'Payment declined',
      } } });
    });
  }
}
