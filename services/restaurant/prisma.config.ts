import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma 7 no longer loads .env by itself. Node 22 can, and does it from the
// standard library — no dotenv dependency. Guarded because CI sets DATABASE_URL
// as a real environment variable and ships no .env file at all.
if (existsSync('.env')) process.loadEnvFile();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  // `migrate dev` needs a plain URL: it opens a second, temporary "shadow"
  // database to work out what changed, and that happens outside the adapter.
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  // Used by the CLI for everything that is not migrate dev. Runtime builds its
  // own adapter in prisma.service.ts, so a migration and a request can never
  // silently disagree about which database they mean.
  adapter: () => Promise.resolve(new PrismaPg({ connectionString: process.env.DATABASE_URL })),
});
