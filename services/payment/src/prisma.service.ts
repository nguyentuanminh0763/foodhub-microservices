import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Prisma 7 has no Rust engine: the adapter is a plain `pg` connection pool.
    super({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  }

  async onModuleInit() {
    // Eager: an unreachable database should kill boot, not the first request.
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
