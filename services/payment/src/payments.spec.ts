import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppModule } from './app.module';
import { PrismaService } from './prisma.service';
import { PaymentsService } from './payments.service';
import type { DomainEvent } from './event-bus';

let app: INestApplication;
let prisma: PrismaService;
let payments: PaymentsService;
const userId = `payment-test-${randomUUID()}`;
const orderId = Math.floor(Math.random() * 1_000_000_000) + 1;
beforeAll(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
  prisma = app.get(PrismaService);
  payments = app.get(PaymentsService);
});
afterAll(async () => {
  await prisma?.payment.deleteMany({ where: { userId } });
  await prisma?.outbox.deleteMany({ where: { aggregateId: { in: [String(orderId), String(orderId + 1)] } } });
  await app?.close();
});
it('handles concurrent delivery of one event without duplicate payments or outbox records', async () => {
  const event: DomainEvent = { eventId: randomUUID(), version: 1, type: 'order.created', data: { orderId, userId, totalVnd: 110000, paymentMethod: 'demo_success' } };
  await Promise.all(Array.from({ length: 10 }, () => payments.process(event)));
  expect(await prisma.payment.count({ where: { orderId } })).toBe(1);
  expect(await prisma.outbox.count({ where: { aggregateId: String(orderId) } })).toBe(1);
  expect((await prisma.payment.findUniqueOrThrow({ where: { orderId } })).status).toBe('SUCCEEDED');
});
it('persists a decline and the failure event together', async () => {
  await payments.process({ eventId: randomUUID(), version: 1, type: 'order.created', data: { orderId: orderId + 1, userId, totalVnd: 50000, paymentMethod: 'demo_failure' } });
  expect((await prisma.payment.findUniqueOrThrow({ where: { orderId: orderId + 1 } })).status).toBe('FAILED');
  expect((await prisma.outbox.findFirstOrThrow({ where: { aggregateId: String(orderId + 1) } })).topic).toBe('payment.failed');
});
