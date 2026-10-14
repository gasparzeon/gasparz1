// Store chave-valor em memória com TTL controlado por Date.now(), usado
// como mock de `@/lib/auth/store` nos testes.
export function createFakeStore() {
  const data = new Map<string, { value: string; expiresAt: number }>();

  const read = (key: string) => {
    const entry = data.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      data.delete(key);
      return null;
    }
    return entry;
  };

  return {
    kind: 'memory' as const,
    data,
    get: jest.fn(async (key: string) => read(key)?.value ?? null),
    set: jest.fn(
      async (key: string, value: string, ttlSeconds: number, options?: { nx?: boolean }) => {
        if (options?.nx && read(key)) return false;
        data.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
        return true;
      },
    ),
    incr: jest.fn(async (key: string, ttlSeconds: number) => {
      const entry = read(key);
      const next = (entry ? Number(entry.value) : 0) + 1;
      data.set(key, {
        value: String(next),
        expiresAt: entry?.expiresAt ?? Date.now() + ttlSeconds * 1000,
      });
      return next;
    }),
    del: jest.fn(async (key: string) => {
      data.delete(key);
    }),
  };
}

export type FakeStore = ReturnType<typeof createFakeStore>;
