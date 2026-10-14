import { stat } from 'node:fs/promises';
import { migrate } from 'drizzle-orm/pglite/migrator';

import { closeDb, getDb } from '../index';

// PGlite, Drizzle, migrações e bootstrap mockados: aqui só interessa quando o
// getDb confere o journal e reaplica as migrações no `next dev`.
jest.mock('@electric-sql/pglite', () => ({
  PGlite: jest.fn().mockImplementation(() => ({ close: jest.fn(async () => undefined) })),
}));
jest.mock('drizzle-orm/pglite', () => ({ drizzle: jest.fn(() => ({ fake: 'db' })) }));
jest.mock('drizzle-orm/pglite/migrator', () => ({ migrate: jest.fn() }));
jest.mock('../bootstrap', () => ({ bootstrap: jest.fn() }));
jest.mock('node:fs/promises', () => ({ stat: jest.fn(), mkdir: jest.fn() }));

const mockStat = stat as unknown as jest.Mock;
const mockMigrate = migrate as unknown as jest.Mock;
const globalRef = globalThis as typeof globalThis & { __gasparDb?: unknown };

let mtime = 1000;

function env(nodeEnv: 'development' | 'production' | 'test', databaseUrl = '') {
  jest.replaceProperty(process, 'env', {
    ...process.env,
    NODE_ENV: nodeEnv,
    PGLITE_DIR: 'memory://',
    DATABASE_URL: databaseUrl,
    POSTGRES_URL: '',
  });
}

beforeEach(async () => {
  await closeDb();
  globalRef.__gasparDb = undefined;
  mtime = 1000;
  mockStat.mockImplementation(async () => ({ mtimeMs: mtime }));
  mockMigrate.mockResolvedValue(undefined);
  jest.spyOn(console, 'info').mockImplementation(() => {});
});

describe('getDb no next dev (PGlite)', () => {
  it('migra ao abrir e não repete enquanto o journal não muda', async () => {
    env('development');
    await getDb();
    await getDb();
    await getDb();
    expect(mockMigrate).toHaveBeenCalledTimes(1);
  });

  it('migração nova (journal alterado) é aplicada sem reiniciar, uma vez só', async () => {
    env('development');
    await getDb();

    mtime = 2000;
    await Promise.all([getDb(), getDb(), getDb()]);
    expect(mockMigrate).toHaveBeenCalledTimes(2);
    expect(console.info).toHaveBeenCalledWith(
      '[db] migrações novas aplicadas sem reiniciar o servidor.',
    );

    await getDb();
    expect(mockMigrate).toHaveBeenCalledTimes(2);
  });

  it('banco aberto por uma versão anterior do código (sem versão salva) é atualizado', async () => {
    env('development');
    const db = { fake: 'aberto antes' };
    globalRef.__gasparDb = { promise: Promise.resolve(db) };

    await expect(getDb()).resolves.toBe(db);
    expect(mockMigrate).toHaveBeenCalledTimes(1);
    expect(mockMigrate).toHaveBeenCalledWith(db, expect.anything());
  });

  it('se a migração falha, o erro aparece e a próxima chamada tenta de novo', async () => {
    env('development');
    await getDb();

    mtime = 3000;
    mockMigrate.mockRejectedValueOnce(new Error('sql inválido'));
    await expect(getDb()).rejects.toThrow('sql inválido');

    await getDb();
    expect(mockMigrate).toHaveBeenCalledTimes(3);
  });
});

describe('fora do next dev', () => {
  it('em produção e nos testes não confere o journal a cada chamada', async () => {
    for (const nodeEnv of ['production', 'test'] as const) {
      await closeDb();
      globalRef.__gasparDb = undefined;
      env(nodeEnv);
      await getDb();
      mtime += 1000;
      await getDb();
    }
    expect(mockStat).not.toHaveBeenCalled();
    expect(mockMigrate).toHaveBeenCalledTimes(2);
  });

  it('com Postgres (DATABASE_URL) as migrações são do pnpm db:migrate', async () => {
    env('development', 'postgres://localhost/gaspar');
    const db = { fake: 'postgres' };
    globalRef.__gasparDb = { promise: Promise.resolve(db) };

    await expect(getDb()).resolves.toBe(db);
    expect(mockStat).not.toHaveBeenCalled();
    expect(mockMigrate).not.toHaveBeenCalled();
  });
});
