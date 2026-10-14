import 'server-only';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import matter from 'gray-matter';

import { DEFAULT_PAGES } from '@/lib/site/default-pages';
import { isSectionKey } from '@/lib/sections';

import type { Database } from './index';
import { pages, posts, settings, users } from './schema';

const LEGACY_IMPORT_KEY = 'legacy_posts_import';
const DEFAULT_PAGES_KEY = 'default_pages_seed';
const SLUG_RE = /^[a-z0-9-]+$/;

// O dono do blog nasce das variáveis ADMIN_USERNAME / ADMIN_PASSWORD_HASH
// (as mesmas do painel de usuário único), sem passo manual.
export async function ensureOwner(db: Database) {
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'owner'))
    .limit(1);
  if (owner) return owner.id;

  const username = process.env.ADMIN_USERNAME?.trim();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  if (!username || !passwordHash?.startsWith('scrypt:')) return null;

  const [created] = await db
    .insert(users)
    .values({
      username,
      name: username,
      passwordHash,
      role: 'owner',
      status: 'active',
      approvedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: users.id });

  if (created) return created.id;

  // Outra instância criou ao mesmo tempo.
  const [again] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, 'owner'))
    .limit(1);
  return again?.id ?? null;
}

function normalizeDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return null;
}

// Traz os posts .mdx do repositório (de antes do banco) uma única vez.
export async function importLegacyPosts(db: Database, authorId: string) {
  const dir = path.join(process.cwd(), 'content/posts');
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  const files = names.filter((name) => name.endsWith('.mdx') || name.endsWith('.md'));

  const rows = await Promise.all(
    files.map(async (name) => {
      const slug = name.replace(/\.mdx?$/, '');
      if (!SLUG_RE.test(slug)) return null;
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- nome vindo do readdir de content/posts e validado acima
      const raw = await fs.readFile(path.join(dir, name), 'utf8');
      const { data, content } = matter(raw, {});

      return {
        slug,
        title: typeof data.title === 'string' ? data.title : slug,
        excerpt: typeof data.excerpt === 'string' ? data.excerpt : '',
        content: content.replace(/^\n+/, ''),
        coverImage: typeof data.coverImage === 'string' ? data.coverImage : '',
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        section: isSectionKey(data.section) ? data.section : null,
        status: data.draft === true ? ('draft' as const) : ('published' as const),
        authorId,
        publishedAt: normalizeDate(data.publishedAt) ?? new Date().toISOString().slice(0, 10),
        contentUpdatedAt: normalizeDate(data.updatedAt),
      };
    }),
  );

  const values = rows.filter((row) => row !== null);
  if (values.length === 0) return 0;

  const inserted = await db
    .insert(posts)
    .values(values)
    .onConflictDoNothing({ target: posts.slug })
    .returning({ id: posts.id });
  return inserted.length;
}

// Sobre e Apoie, que antes eram fixas no código, viram páginas editáveis.
export async function seedDefaultPages(db: Database, ownerId: string) {
  const inserted = await db
    .insert(pages)
    .values(
      DEFAULT_PAGES.map((page) => ({
        ...page,
        status: 'published' as const,
        updatedBy: ownerId,
      })),
    )
    .onConflictDoNothing({ target: pages.slug })
    .returning({ id: pages.id });
  return inserted.length;
}

// Executa a tarefa uma única vez por banco. A marca e o trabalho entram na
// mesma transação: se falhar, tenta de novo na próxima inicialização; se outra
// instância já fez, não duplica.
async function runOnce(
  db: Database,
  key: string,
  task: (tx: Database) => Promise<Record<string, unknown>>,
) {
  const [done] = await db
    .select({ key: settings.key })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  if (done) return;

  await db.transaction(async (tx) => {
    const [claimed] = await tx
      .insert(settings)
      .values({ key, value: { at: new Date().toISOString() } })
      .onConflictDoNothing()
      .returning({ key: settings.key });
    if (!claimed) return;

    const result = await task(tx as unknown as Database);
    await tx
      .update(settings)
      .set({ value: { at: new Date().toISOString(), ...result } })
      .where(eq(settings.key, key));
  });
}

export async function bootstrap(db: Database) {
  const ownerId = await ensureOwner(db);
  if (!ownerId || process.env.SKIP_LEGACY_IMPORT === '1') return;

  await runOnce(db, LEGACY_IMPORT_KEY, async (tx) => ({
    count: await importLegacyPosts(tx, ownerId),
  }));
  await runOnce(db, DEFAULT_PAGES_KEY, async (tx) => ({
    count: await seedDefaultPages(tx, ownerId),
  }));
}
