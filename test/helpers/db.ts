import { sql } from 'drizzle-orm';

import { closeDb, getDb } from '@/lib/db';
import { posts, users } from '@/lib/db/schema';

import { fastHash } from './password';

// Zera as tabelas entre testes (mantém o schema migrado).
export async function resetDb() {
  const db = await getDb();
  await db.execute(
    sql`truncate table kv, media, user_tokens, comments, posts, pages, settings, users restart identity cascade`,
  );
  return db;
}

// Força a expiração de uma chave do store sem esperar o relógio.
export async function expireKey(key: string) {
  const db = await getDb();
  await db.execute(sql`update kv set expires_at = now() - interval '1 second' where key = ${key}`);
}

type NewUser = Partial<typeof users.$inferInsert> & { password?: string };

export async function createUser({ password = 'senha-de-teste-123', ...values }: NewUser = {}) {
  const db = await getDb();
  const username = values.username ?? `user${Math.random().toString(36).slice(2, 8)}`;
  const [user] = await db
    .insert(users)
    .values({
      name: username,
      role: 'author',
      status: 'active',
      passwordHash: fastHash(password),
      ...values,
      username,
    })
    .returning();
  return user;
}

export async function createPost(
  authorId: string,
  values: Partial<typeof posts.$inferInsert> = {},
) {
  const db = await getDb();
  const slug = values.slug ?? `post-${Math.random().toString(36).slice(2, 8)}`;
  const [post] = await db
    .insert(posts)
    .values({
      title: slug,
      content: 'Conteúdo do post.',
      publishedAt: '2026-01-01',
      status: 'published',
      ...values,
      slug,
      authorId,
    })
    .returning();
  return post;
}

export { closeDb, getDb };
