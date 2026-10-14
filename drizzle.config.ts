import { defineConfig } from 'drizzle-kit';

// `pnpm db:generate` cria migrações SQL em ./drizzle a partir do schema.
export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? '',
  },
  strict: true,
});
