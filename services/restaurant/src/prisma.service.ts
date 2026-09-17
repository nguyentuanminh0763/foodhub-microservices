import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Prisma 7 talks to Postgres through a driver adapter — node-postgres here,
    // holding a real connection pool. There is no Rust engine process any more,
    // so the pool is plain `pg` and behaves like any other Node pool.
    super({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  }

  async onModuleInit() {
    // Connect eagerly rather than on first query: if the database is unreachable
    // the service should fail at boot, loudly, not at 19:32 when a customer is
    // waiting for a price. compose's depends_on: service_healthy makes this safe.
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
