import type { INestApplication } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// These tests need restaurants-db running:  docker compose up -d restaurants-db
// That is the point. Mocking Prisma would test the mock, not the schema — and
// the schema is what is new here.
//
// DATABASE_URL arrives via `node --env-file-if-exists=.env` in the test script,
// not process.loadEnvFile() in here: Jest gives each test file a sandboxed copy
// of `process`, so a native env load lands in the real process and the test
// never sees it. The flag runs before Jest starts, so the copy is made from an
// environment that already has the variable. --if-exists keeps CI working,
// where DATABASE_URL is a real variable and no .env file is shipped.

let app: INestApplication;
let prisma: PrismaService;
let base: string;

// Only rows this file created get deleted, by id. A blanket deleteMany() would
// wipe whatever the developer was looking at in the same dev database.
const created: number[] = [];

beforeAll(async () => {
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('./app.module');

  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api'); // main.ts does this; tests never load main.ts
  await app.listen(0);
  base = await app.getUrl();
  prisma = app.get(PrismaService);
});

afterAll(async () => {
  if (created.length) {
    await prisma.restaurant.deleteMany({ where: { id: { in: created } } });
  }
  await app?.close();
});

describe('health', () => {
  it('reports the database as up when it is', async () => {
    const res = await fetch(`${base}/api/restaurants/health`);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      service: 'restaurant',
      status: 'ok',
      database: 'up',
    });
  });
});

describe('schema', () => {
  it('round-trips a restaurant with dishes', async () => {
    const restaurant = await prisma.restaurant.create({
      data: {
        name: 'Cơm Tấm Ba Hưng',
        dishes: {
          create: [
            { name: 'Cơm tấm sườn', priceVnd: 45_000, stock: 10 },
            { name: 'Canh chua', priceVnd: 20_000, stock: 3 },
          ],
        },
      },
      include: { dishes: true },
    });
    created.push(restaurant.id);

    expect(restaurant.dishes).toHaveLength(2);
    expect(restaurant.dishes.map((d) => d.name)).toContain('Canh chua');
  });

  it('returns a price as a plain integer, not a Decimal object', async () => {
    const restaurant = await prisma.restaurant.create({
      data: { name: 'Bún Chả Hương Liên', dishes: { create: { name: 'Bún chả', priceVnd: 45_000 } } },
      include: { dishes: true },
    });
    created.push(restaurant.id);

    const [dish] = restaurant.dishes;
    // The money decision, pinned. Switch priceVnd to Decimal and this fails:
    // Prisma hands back an object, and `45000 * 2` silently stops working.
    expect(typeof dish.priceVnd).toBe('number');
    expect(dish.priceVnd * 2).toBe(90_000);
    // stock defaults to 0 — a dish nobody set stock on cannot be oversold.
    expect(dish.stock).toBe(0);
  });

  it('deletes dishes with their restaurant', async () => {
    const restaurant = await prisma.restaurant.create({
      data: { name: 'Temporary', dishes: { create: { name: 'Gone soon', priceVnd: 1_000 } } },
      include: { dishes: true },
    });
    const dishId = restaurant.dishes[0].id;

    await prisma.restaurant.delete({ where: { id: restaurant.id } });

    // onDelete: Cascade, enforced by Postgres rather than by application code.
    expect(await prisma.dish.findUnique({ where: { id: dishId } })).toBeNull();
  });
});
