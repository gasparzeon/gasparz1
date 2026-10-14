import 'server-only';

import { and, desc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import {
  canEditAllPosts,
  canEditPost,
  canSetStatus,
  type Actor,
  type PostStatus,
} from '@/lib/auth/permissions';
import { getDb, type Database } from '@/lib/db';
import { posts, users } from '@/lib/db/schema';
import { isSectionKey } from '@/lib/sections';

import type { PostDocument, PostInput, PostSummary } from './schema';

export class PostError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 = 400,
    readonly code?: 'forbidden' | 'not_found' | 'conflict' | 'exists' | 'invalid_author',
  ) {
    super(message);
    this.name = 'PostError';
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const author = {
  id: users.id,
  name: users.name,
  username: users.username,
  avatarUrl: users.avatarUrl,
};

const summaryColumns = {
  id: posts.id,
  slug: posts.slug,
  title: posts.title,
  excerpt: posts.excerpt,
  coverImage: posts.coverImage,
  tags: posts.tags,
  section: posts.section,
  status: posts.status,
  publishedAt: posts.publishedAt,
  contentUpdatedAt: posts.contentUpdatedAt,
  version: posts.version,
  updatedAt: posts.updatedAt,
  authorId: posts.authorId,
};

type Row = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string;
  tags: string[];
  section: string | null;
  status: PostStatus;
  publishedAt: string;
  contentUpdatedAt: string | null;
  version: number;
  updatedAt: Date;
  author: PostDocument['author'];
};

function toSummaryBase(row: Row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    coverImage: row.coverImage,
    tags: row.tags,
    section: isSectionKey(row.section) ? row.section : ('' as const),
    status: row.status,
    publishedAt: row.publishedAt,
    updatedAt: row.contentUpdatedAt ?? '',
    version: row.version,
    author: row.author,
    modifiedAt: row.updatedAt.toISOString(),
  };
}

function isUniqueViolation(error: unknown) {
  const err = error as { code?: string; cause?: { code?: string } } | null;
  return err?.code === '23505' || err?.cause?.code === '23505';
}

// O site público é gerado estaticamente (ISR): qualquer mudança em post
// publicado marca as páginas para regeneração.
function revalidatePublicSite() {
  try {
    revalidatePath('/', 'layout');
  } catch {
    // Fora de uma requisição do Next (scripts, testes): nada a revalidar.
  }
}

async function loadForEdit(db: Database, actor: Actor, id: string) {
  if (!UUID_RE.test(id)) throw new PostError('Post não encontrado.', 404, 'not_found');

  const [row] = await db
    .select({ ...summaryColumns, content: posts.content, author })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(eq(posts.id, id))
    .limit(1);

  if (!row) throw new PostError('Post não encontrado.', 404, 'not_found');
  if (!canEditPost(actor, row)) {
    throw new PostError('Você não pode editar este post.', 403, 'forbidden');
  }
  return row;
}

async function resolveAuthor(db: Database, actor: Actor, requested: string | undefined) {
  if (!requested || requested === actor.id) return actor.id;
  if (!canEditAllPosts(actor.role)) {
    throw new PostError('Só editores podem escolher outro autor.', 403, 'forbidden');
  }
  const [row] = await db
    .select({ id: users.id, status: users.status, role: users.role })
    .from(users)
    .where(eq(users.id, requested))
    .limit(1);
  // Autor precisa escrever no painel: leitor não serve.
  if (!row || row.status !== 'active' || row.role === 'reader') {
    throw new PostError('Autor inválido.', 400, 'invalid_author');
  }
  return row.id;
}

function valuesFrom(input: PostInput) {
  return {
    slug: input.slug,
    title: input.title,
    excerpt: input.excerpt,
    content: input.content.replace(/\r\n/g, '\n'),
    coverImage: input.coverImage,
    tags: input.tags,
    section: input.section || null,
    publishedAt: input.publishedAt,
    contentUpdatedAt: input.updatedAt || null,
  };
}

export async function listPostsForAdmin(
  actor: Actor,
  options: { onlyMine?: boolean } = {},
): Promise<PostSummary[]> {
  const db = await getDb();
  // Autores e colaboradores veem só os próprios posts.
  const onlyMine = options.onlyMine || !canEditAllPosts(actor.role);

  const rows = await db
    .select({
      ...summaryColumns,
      author,
      wordCount: sql<number>`coalesce(array_length(regexp_split_to_array(btrim(${posts.content}), '\\s+'), 1), 0)::int`,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(onlyMine ? eq(posts.authorId, actor.id) : undefined)
    .orderBy(
      sql`case ${posts.status} when 'review' then 0 else 1 end`,
      desc(posts.publishedAt),
      desc(posts.updatedAt),
    );

  return rows.map((row) => ({ ...toSummaryBase(row), wordCount: row.wordCount }));
}

export async function getPostForEditor(actor: Actor, id: string): Promise<PostDocument> {
  const db = await getDb();
  const row = await loadForEdit(db, actor, id);
  return { ...toSummaryBase(row), content: row.content };
}

export async function createPost(
  actor: Actor,
  input: PostInput,
  status: PostStatus,
): Promise<PostDocument> {
  if (!canSetStatus(actor, null, status)) {
    throw new PostError('Você não pode publicar posts. Envie para revisão.', 403, 'forbidden');
  }

  const db = await getDb();
  const authorId = await resolveAuthor(db, actor, input.authorId);

  let id: string;
  try {
    const [row] = await db
      .insert(posts)
      .values({ ...valuesFrom(input), status, authorId })
      .returning({ id: posts.id });
    id = row.id;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new PostError('Já existe um post com esse endereço (slug).', 409, 'exists');
    }
    throw error;
  }

  if (status === 'published') revalidatePublicSite();
  return getPostForEditor(actor, id);
}

export async function updatePost(
  actor: Actor,
  id: string,
  input: PostInput,
  status: PostStatus,
  expectedVersion: number,
): Promise<PostDocument> {
  const db = await getDb();
  const current = await loadForEdit(db, actor, id);

  if (!canSetStatus(actor, current, status)) {
    throw new PostError('Você não pode publicar este post. Envie para revisão.', 403, 'forbidden');
  }

  const authorId =
    input.authorId && input.authorId !== current.authorId
      ? await resolveAuthor(db, actor, input.authorId)
      : current.authorId;

  let updated: { id: string }[];
  try {
    updated = await db
      .update(posts)
      .set({
        ...valuesFrom(input),
        status,
        authorId,
        version: sql`${posts.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(posts.id, id), eq(posts.version, expectedVersion)))
      .returning({ id: posts.id });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new PostError('Já existe um post com esse endereço (slug).', 409, 'exists');
    }
    throw error;
  }

  if (updated.length === 0) {
    throw new PostError('O post foi modificado em outro lugar.', 409, 'conflict');
  }

  if (current.status === 'published' || status === 'published') revalidatePublicSite();
  return getPostForEditor(actor, id);
}

export async function deletePost(actor: Actor, id: string, expectedVersion: number) {
  const db = await getDb();
  const current = await loadForEdit(db, actor, id);

  const deleted = await db
    .delete(posts)
    .where(and(eq(posts.id, id), eq(posts.version, expectedVersion)))
    .returning({ id: posts.id });

  if (deleted.length === 0) {
    throw new PostError('O post foi modificado em outro lugar.', 409, 'conflict');
  }
  if (current.status === 'published') revalidatePublicSite();
}

export async function listTags() {
  const db = await getDb();
  const rows = await db
    .selectDistinct({ tag: sql<string>`unnest(${posts.tags})` })
    .from(posts)
    .orderBy(sql`1`);
  return rows.map((row) => row.tag);
}
