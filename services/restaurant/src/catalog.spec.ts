import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma.service';
import { CatalogService } from './catalog.service';
import { randomUUID } from 'node:crypto';

let app: INestApplication;
let prisma: PrismaService;
let catalog: CatalogService;
let restaurantId: number;
const reservationKeys: string[] = [];

beforeAll(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  await app.listen(0);
  prisma = app.get(PrismaService);
  catalog = app.get(CatalogService);
  restaurantId = (await prisma.restaurant.create({ data: { name: 'Catalog integration test' } })).id;
});
afterAll(async () => {
  await prisma?.reservation.deleteMany({ where: { id: { in: reservationKeys } } });
  if (restaurantId) await prisma.restaurant.delete({ where: { id: restaurantId } });
  await app?.close();
});
function key() { const id = randomUUID(); reservationKeys.push(id); return id; }

it('reserves exactly one of 100 requests for the last portion', async () => {
  const dish = await catalog.addDish(restaurantId, { name: 'Last portion', priceVnd: 45000, stock: 1 });
  const results = await Promise.allSettled(Array.from({ length: 100 }, () => catalog.reserve(key(), { restaurantId, items: [{ dishId: dish.id, quantity: 1 }] })));
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect((await prisma.dish.findUniqueOrThrow({ where: { id: dish.id } })).stock).toBe(0);
}, 30000);

it('retries preserve the original price and release stock exactly once', async () => {
  const dish = await catalog.addDish(restaurantId, { name: 'Snapshot', priceVnd: 45000, stock: 3 });
  const id = key();
  const request = { restaurantId, items: [{ dishId: dish.id, quantity: 2 }] };
  const first = await catalog.reserve(id, request);
  await catalog.updateDish(restaurantId, dish.id, { priceVnd: 99000 });
  expect(await catalog.reserve(id, request)).toEqual(first);
  expect((await prisma.dish.findUniqueOrThrow({ where: { id: dish.id } })).stock).toBe(1);
  await Promise.all([catalog.release(id), catalog.release(id)]);
  expect((await prisma.dish.findUniqueOrThrow({ where: { id: dish.id } })).stock).toBe(3);
  await expect(catalog.reserve(id, request)).rejects.toThrow('released');
});

it('rolls back every stock change when any item is unavailable', async () => {
  const first = await catalog.addDish(restaurantId, { name: 'Available', priceVnd: 20000, stock: 2 });
  const second = await catalog.addDish(restaurantId, { name: 'Sold out', priceVnd: 20000, stock: 0 });
  await expect(catalog.reserve(key(), { restaurantId, items: [{ dishId: first.id, quantity: 1 }, { dishId: second.id, quantity: 1 }] })).rejects.toThrow();
  expect((await prisma.dish.findUniqueOrThrow({ where: { id: first.id } })).stock).toBe(2);
});

it('rejects negative stock and extra fields through HTTP validation', async () => {
  const res = await fetch(`${await app.getUrl()}/api/restaurants/${restaurantId}/dishes`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-user-role': 'admin' },
    body: JSON.stringify({ name: 'Invalid', stock: -1, priceVnd: 1, injected: true }),
  });
  expect(res.status).toBe(400);
});
