import 'server-only';

import path from 'node:path';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import * as schema from './schema';

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export class DatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseConfigError';
  }
}

type Holder = {
  promise?: Promise<Database>;
  close?: () => Promise<void>;
  // Só no `next dev` com PGlite: versão do journal de migrações já aplicada
  // e a conferência em andamento (uma por vez).
  journalMtime?: number;
  checking?: Promise<Database>;
};

// Sobrevive ao hot reload do `next dev` (evita abrir o PGlite duas vezes).
const globalRef = globalThis as typeof globalThis & { __gasparDb?: Holder };

export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

export function databaseKind() {
  return databaseUrl() ? 'postgres' : 'pglite';
}

// Pasta das migrações SQL geradas pelo drizzle-kit.
const MIGRATIONS = path.join(process.cwd(), 'drizzle');
const JOURNAL = path.join(MIGRATIONS, 'meta', '_journal.json');

// O `next dev` fica aberto enquanto chegam migrações novas (git pull,
// pnpm db:generate). O banco é aberto uma vez só, então sem isto a coluna nova
// só existia depois de reiniciar, e as páginas que a usam davam erro 500.
const watchesMigrations = () => process.env.NODE_ENV === 'development' && !databaseUrl();

async function journalMtime() {
  const { stat } = await import('node:fs/promises');
  return (await stat(JOURNAL)).mtimeMs;
}

async function connectPostgres(url: string, holder: Holder) {
  const { default: postgres } = await import('postgres');
  const { drizzle } = await import('drizzle-orm/postgres-js');

  const client = postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idle_timeout: 20,
    connect_timeout: 10,
    // Compatível com poolers em modo transação (Neon, Supabase, PgBouncer).
    prepare: false,
  });
  holder.close = () => client.end();
  return drizzle(client, { schema }) as unknown as Database;
}

// Sem DATABASE_URL: Postgres embutido (PGlite). Em dev os dados ficam em
// .data/pglite; no build e nos testes, em memória.
async function connectPglite(holder: Holder) {
  if (process.env.VERCEL) {
    throw new DatabaseConfigError(
      'Defina DATABASE_URL (Postgres) nas variáveis de ambiente da Vercel. Recomendado: integração Neon.',
    );
  }

  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');

  const dataDir =
    process.env.PGLITE_DIR ??
    (process.env.NODE_ENV === 'production'
      ? 'memory://'
      : path.join(/*turbopackIgnore: true*/ process.cwd(), '.data', 'pglite'));

  // O PGlite só cria a última pasta do caminho: num clone novo, .data/ ainda
  // não existe e a primeira execução falhava com ENOENT.
  if (!dataDir.includes('://')) {
    const { mkdir } = await import('node:fs/promises');
    await mkdir(dataDir, { recursive: true });
  }

  // Banco em memória fora do build: tudo o que for criado no painel some quando
  // o processo reinicia. Num servidor próprio, defina DATABASE_URL ou PGLITE_DIR.
  if (
    dataDir === 'memory://' &&
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PHASE !== 'phase-production-build' &&
    !process.env.JEST_WORKER_ID
  ) {
    console.warn(
      '[db] ATENÇÃO: banco em memória em produção. Posts, usuários e configurações criados no painel ' +
        'somem quando o servidor reinicia. Defina DATABASE_URL (Postgres) ou PGLITE_DIR (pasta persistente).',
    );
  }

  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  const version = watchesMigrations() ? await journalMtime() : undefined;
  await migrate(db, { migrationsFolder: MIGRATIONS });
  holder.journalMtime = version;

  holder.close = () => client.close();
  return db as unknown as Database;
}

async function connect(holder: Holder) {
  const url = databaseUrl();
  const db = url ? await connectPostgres(url, holder) : await connectPglite(holder);

  const { bootstrap } = await import('./bootstrap');
  await bootstrap(db);

  return db;
}

// Em dev, aplica as migrações que chegaram depois de o banco ser aberto.
async function applyNewMigrations(holder: Holder, db: Database) {
  const version = await journalMtime();
  if (holder.journalMtime === version) return db;
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  await migrate(db as unknown as Parameters<typeof migrate>[0], { migrationsFolder: MIGRATIONS });
  holder.journalMtime = version;
  console.info('[db] migrações novas aplicadas sem reiniciar o servidor.');
  return db;
}

export function getDb(): Promise<Database> {
  const holder = (globalRef.__gasparDb ??= {});
  holder.promise ??= connect(holder).catch((error) => {
    holder.promise = undefined;
    throw error;
  });
  if (!watchesMigrations()) return holder.promise;

  holder.checking ??= holder.promise
    .then((db) => applyNewMigrations(holder, db))
    .finally(() => {
      holder.checking = undefined;
    });
  return holder.checking;
}

// Para scripts e testes.
export async function closeDb() {
  const holder = globalRef.__gasparDb;
  if (!holder?.promise) return;
  await holder.promise.catch(() => undefined);
  await holder.close?.();
  globalRef.__gasparDb = undefined;
}

export { schema };
