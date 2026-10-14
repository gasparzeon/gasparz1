// Aplica as migrações SQL de ./drizzle no Postgres de DATABASE_URL.
// Roda antes do build na Vercel (script vercel-build). Sem DATABASE_URL não
// há nada a fazer: o PGlite local aplica as migrações sozinho.
import path from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

// Migrações vão melhor sem o pooler (Neon expõe DATABASE_URL_UNPOOLED).
const url =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!url) {
  console.log('[db] DATABASE_URL não definida: nada a migrar (o PGlite local migra sozinho).');
  process.exit(0);
}

const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

try {
  await migrate(drizzle(client), { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  console.log('[db] migrações aplicadas.');
} finally {
  await client.end();
}
