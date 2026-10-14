import { closeDb, expireKey, resetDb } from '@/test/helpers/db';

import { getStore } from '../store';

// Store real no Postgres (PGlite em memória), sem mocks.
beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeDb();
});

describe('store chave-valor no Postgres', () => {
  it('grava, lê e apaga', async () => {
    const store = getStore();
    await expect(store.set('a', '1', 60)).resolves.toBe(true);
    await expect(store.get('a')).resolves.toBe('1');
    await store.del('a');
    await expect(store.get('a')).resolves.toBeNull();
  });

  it('NX não sobrescreve chave viva, mas reaproveita chave vencida', async () => {
    const store = getStore();
    await expect(store.set('code', 'sessao-1', 60, { nx: true })).resolves.toBe(true);
    await expect(store.set('code', 'sessao-2', 60, { nx: true })).resolves.toBe(false);
    await expect(store.get('code')).resolves.toBe('sessao-1');

    await expireKey('code');
    await expect(store.get('code')).resolves.toBeNull();
    await expect(store.set('code', 'sessao-3', 60, { nx: true })).resolves.toBe(true);
    await expect(store.get('code')).resolves.toBe('sessao-3');
  });

  it('INCR conta dentro da janela e recomeça depois que vence', async () => {
    const store = getStore();
    await expect(store.incr('rl', 60)).resolves.toBe(1);
    await expect(store.incr('rl', 60)).resolves.toBe(2);
    await expect(store.incr('rl', 60)).resolves.toBe(3);

    await expireKey('rl');
    await expect(store.incr('rl', 60)).resolves.toBe(1);
  });

  it('é seguro com incrementos concorrentes', async () => {
    const store = getStore();
    const results = await Promise.all(Array.from({ length: 20 }, () => store.incr('par', 60)));
    expect(new Set(results).size).toBe(20);
    expect(Math.max(...results)).toBe(20);
  });
});
