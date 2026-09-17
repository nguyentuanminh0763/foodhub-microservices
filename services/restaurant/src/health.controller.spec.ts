import type { INestApplication } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Needs restaurants-db running:  docker compose up -d restaurants-db
//
// DATABASE_URL arrives via `node --env-file-if-exists=.env` in the test script.
// Not process.loadEnvFile(): Jest gives each spec a sandboxed copy of `process`,
// so a native env load lands somewhere the test cannot read.

let app: INestApplication;
let prisma: PrismaService;
let base: string;

// Only rows this file created get deleted. A blanket deleteMany() would wipe
// whatever the developer was looking at in the same dev database.
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
    // The money decision, pinned. Switch to Decimal and `45000 * 2` stops working.
    expect(typeof dish.priceVnd).toBe('number');
    expect(dish.priceVnd * 2).toBe(90_000);
    expect(dish.stock).toBe(0);
  });

  it('deletes dishes with their restaurant', async () => {
    const restaurant = await prisma.restaurant.create({
      data: { name: 'Temporary', dishes: { create: { name: 'Gone soon', priceVnd: 1_000 } } },
      include: { dishes: true },
    });
    const dishId = restaurant.dishes[0].id;

    await prisma.restaurant.delete({ where: { id: restaurant.id } });

    // onDelete: Cascade, enforced by Postgres rather than application code.
    expect(await prisma.dish.findUnique({ where: { id: dishId } })).toBeNull();
  });
});
