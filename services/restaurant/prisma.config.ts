import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma 7 no longer loads .env itself. Node 22 does, from the standard library.
// Guarded: CI sets DATABASE_URL as a real variable and ships no .env.
if (existsSync('.env')) process.loadEnvFile();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  // migrate dev needs a plain URL: the temporary shadow database it diffs
  // against is opened outside the adapter.
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  adapter: () => Promise.resolve(new PrismaPg({ connectionString: process.env.DATABASE_URL })),
});
