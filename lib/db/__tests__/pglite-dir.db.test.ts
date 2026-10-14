import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sql } from 'drizzle-orm';

import { closeDb, databaseKind, getDb } from '../index';

// Este teste cobre o driver PGlite (banco embutido). Com DATABASE_URL o
// getDb() usa Postgres real e a pasta do PGlite nunca é criada — pula
// nesse caso (a cobertura PGlite vem dos runs sem DATABASE_URL).
const itPglite = databaseKind() === 'pglite' ? it : it.skip;

// Clone novo do repositório: a pasta do banco embutido (e a pasta-mãe .data/)
// ainda não existem. O PGlite só cria a última pasta do caminho.
const base = mkdtempSync(path.join(tmpdir(), 'gaspar-pglite-'));
const dataDir = path.join(base, 'clone-novo', '.data', 'pglite');
const previous = process.env.PGLITE_DIR;

beforeAll(() => {
  process.env.PGLITE_DIR = dataDir;
});

afterAll(async () => {
  await closeDb();
  process.env.PGLITE_DIR = previous;
  rmSync(base, { recursive: true, force: true });
});

itPglite('cria as pastas do banco na primeira execução e aplica as migrações', async () => {
  expect(existsSync(path.dirname(dataDir))).toBe(false);

  const db = await getDb();

  expect(existsSync(dataDir)).toBe(true);
  const result = await db.execute(sql`select count(*)::int as total from posts`);
  expect(result).toBeDefined();
});
