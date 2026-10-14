import 'server-only';

import { and, eq, gt, lte, sql } from 'drizzle-orm';

import { getDb } from '@/lib/db';
import { kv } from '@/lib/db/schema';

// Armazenamento chave-valor com expiração para o estado de segurança:
// codes já usados, refresh tokens trocados, sessões revogadas e contadores
// de rate limit. Fica no Postgres, então vale para todas as instâncias.

interface KeyValueStore {
  readonly kind: 'postgres';
  get(key: string): Promise<string | null>;
  // Retorna false quando nx=true e a chave (não expirada) já existe.
  set(key: string, value: string, ttlSeconds: number, options?: { nx?: boolean }): Promise<boolean>;
  // Incrementa e aplica o TTL apenas na criação da chave.
  incr(key: string, ttlSeconds: number): Promise<number>;
  del(key: string): Promise<void>;
}

const expiresIn = (ttlSeconds: number) =>
  sql`now() + make_interval(secs => ${Math.max(1, Math.ceil(ttlSeconds))})`;

// Limpeza preguiçosa das chaves vencidas (~1% das gravações).
async function maybeSweep() {
  if (Math.random() > 0.01) return;
  const db = await getDb();
  await db.delete(kv).where(lte(kv.expiresAt, sql`now()`));
}

class PostgresStore implements KeyValueStore {
  readonly kind = 'postgres';

  async get(key: string) {
    const db = await getDb();
    const [row] = await db
      .select({ value: kv.value })
      .from(kv)
      .where(and(eq(kv.key, key), gt(kv.expiresAt, sql`now()`)))
      .limit(1);
    return row?.value ?? null;
  }

  async set(key: string, value: string, ttlSeconds: number, options?: { nx?: boolean }) {
    const db = await getDb();
    const expiresAt = expiresIn(ttlSeconds);

    const rows = await db
      .insert(kv)
      .values({ key, value, expiresAt })
      .onConflictDoUpdate({
        target: kv.key,
        set: { value, expiresAt },
        // Com NX só sobrescreve chave vencida.
        setWhere: options?.nx ? lte(kv.expiresAt, sql`now()`) : undefined,
      })
      .returning({ key: kv.key });

    void maybeSweep();
    return rows.length > 0;
  }

  async incr(key: string, ttlSeconds: number) {
    const db = await getDb();
    const expiresAt = expiresIn(ttlSeconds);
    const expired = sql`${kv.expiresAt} <= now()`;

    const [row] = await db
      .insert(kv)
      .values({ key, value: '1', expiresAt })
      .onConflictDoUpdate({
        target: kv.key,
        set: {
          value: sql`case when ${expired} then '1' else (${kv.value}::bigint + 1)::text end`,
          expiresAt: sql`case when ${expired} then excluded.expires_at else ${kv.expiresAt} end`,
        },
      })
      .returning({ value: kv.value });

    void maybeSweep();
    return Number(row.value);
  }

  async del(key: string) {
    const db = await getDb();
    await db.delete(kv).where(eq(kv.key, key));
  }
}

let store: KeyValueStore | null = null;

export function getStore(): KeyValueStore {
  store ??= new PostgresStore();
  return store;
}
