import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';

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
