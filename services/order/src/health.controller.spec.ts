import type { INestApplication } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Needs orders-db running:  docker compose up -d orders-db
// DATABASE_URL arrives via `node --env-file-if-exists=.env` in the test script,
// because Jest gives each spec a sandboxed copy of `process`.

let app: INestApplication;
let prisma: PrismaService;
let base: string;

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
    await prisma.order.deleteMany({ where: { id: { in: created } } });
  }
  await app?.close();
});

describe('health', () => {
  it('reports the database as up when it is', async () => {
    const res = await fetch(`${base}/api/orders/health`);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ service: 'order', status: 'ok', database: 'up' });
  });
});

describe('schema', () => {
  it('stores order #123 from BUSINESS_OVERVIEW: 2x45k + 1x20k = 110k', async () => {
    const order = await prisma.order.create({
      data: {
        totalVnd: 110_000,
        items: {
          create: [
            { dishId: 7, dishName: 'Cơm tấm sườn', priceVnd: 45_000, quantity: 2 },
            { dishId: 12, dishName: 'Canh chua', priceVnd: 20_000, quantity: 1 },
          ],
        },
      },
      include: { items: true },
    });
    created.push(order.id);

    expect(order.status).toBe('PENDING'); // every order starts here
    const sum = order.items.reduce((t, i) => t + i.priceVnd * i.quantity, 0);
    expect(sum).toBe(order.totalVnd);
  });

  it('moves through the lifecycle', async () => {
    const order = await prisma.order.create({ data: { totalVnd: 45_000 } });
    created.push(order.id);

    for (const status of ['PAID', 'CONFIRMED', 'READY'] as const) {
      const updated = await prisma.order.update({ where: { id: order.id }, data: { status } });
      expect(updated.status).toBe(status);
    }
  });

  it('rejects a status outside the enum', async () => {
    // Postgres enforces this, not application code: the column is a real enum
    // type, so a typo cannot reach the table.
    await expect(
      prisma.$executeRaw`UPDATE orders SET status = 'DELIVERED' WHERE id = ${created[0]}`,
    ).rejects.toThrow();
  });
});
