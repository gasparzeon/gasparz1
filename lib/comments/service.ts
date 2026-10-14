import 'server-only';

import { and, asc, desc, eq, lte, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { canModerateComments, type Actor } from '@/lib/auth/permissions';
import { consumeCommentAttempt } from '@/lib/auth/rate-limit';
import { BLOG_TIMEZONE } from '@/lib/content';
import { getDb, type Database } from '@/lib/db';
import { comments, posts, users } from '@/lib/db/schema';
import { alias } from 'drizzle-orm/pg-core';

export class CommentError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 403 | 404 | 409 | 429 = 400,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'CommentError';
  }
}

export const commentBodySchema = z
  .string()
  .trim()
  .min(1, 'Escreva um comentário.')
  .max(2000, 'Comentário muito longo (máximo de 2000 caracteres).');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CommentAuthor = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string;
} | null;

export type CommentView = {
  id: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  author: CommentAuthor;
};

export type ManagedComment = CommentView & {
  status: 'visible' | 'hidden';
  postSlug: string;
  postTitle: string;
  moderatedBy: string | null;
  moderatedAt: Date | null;
};

// Só post publicado (com data de hoje ou anterior, no fuso do blog) recebe
// comentário — igual à leitura pública do site.
async function findPublicPost(db: Database, slug: string) {
  const [post] = await db
    .select({ id: posts.id, slug: posts.slug, title: posts.title })
    .from(posts)
    .where(
      and(
        eq(posts.slug, slug),
        eq(posts.status, 'published'),
        lte(posts.publishedAt, sql`(now() at time zone ${BLOG_TIMEZONE})::date`),
      ),
    )
    .limit(1);
  return post ?? null;
}

function toView(row: {
  id: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  authorId: string | null;
  authorName: string | null;
  authorUsername: string | null;
  authorAvatar: string | null;
}): CommentView {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    author:
      row.authorId && row.authorName && row.authorUsername
        ? {
            id: row.authorId,
            name: row.authorName,
            username: row.authorUsername,
            avatarUrl: row.authorAvatar ?? '',
          }
        : null,
  };
}

const authorJoin = {
  authorId: users.id,
  authorName: users.name,
  authorUsername: users.username,
  authorAvatar: users.avatarUrl,
};

// Comentários visíveis de um post, do mais antigo ao mais novo.
export async function listComments(postSlug: string) {
  const db = await getDb();
  const post = await findPublicPost(db, postSlug);
  if (!post) throw new CommentError('Post não encontrado.', 404, 'not_found');

  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      ...authorJoin,
    })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorId))
    .where(and(eq(comments.postId, post.id), eq(comments.status, 'visible')))
    .orderBy(asc(comments.createdAt));

  return { post: { slug: post.slug, title: post.title }, comments: rows.map(toView) };
}

export async function createComment(userId: string, postSlug: string, body: string) {
  const text = commentBodySchema.parse(body);
  const db = await getDb();

  const post = await findPublicPost(db, postSlug);
  if (!post) throw new CommentError('Post não encontrado.', 404, 'not_found');

  const limit = await consumeCommentAttempt(userId);
  if (!limit.allowed) {
    throw new CommentError(
      'Muitos comentários em pouco tempo. Aguarde um pouco.',
      429,
      'rate_limited',
    );
  }

  const [created] = await db
    .insert(comments)
    .values({ postId: post.id, authorId: userId, body: text })
    .returning({ id: comments.id, createdAt: comments.createdAt, updatedAt: comments.updatedAt });

  const [author] = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  revalidatePath(`/posts/${post.slug}`);
  return {
    id: created.id,
    body: text,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
    author: author
      ? { id: author.id, name: author.name, username: author.username, avatarUrl: author.avatarUrl }
      : null,
  };
}

async function findComment(db: Database, id: string) {
  if (!UUID_RE.test(id)) return null;
  const [row] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
  return row ?? null;
}

async function postSlugOf(db: Database, postId: string) {
  const [post] = await db
    .select({ slug: posts.slug })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  return post?.slug ?? null;
}

// Só o autor edita o próprio texto. Moderação não reescreve texto de
// terceiros: esconde (visibilidade) ou apaga.
export async function updateComment(userId: string, id: string, body: string) {
  const text = commentBodySchema.parse(body);
  const db = await getDb();

  const comment = await findComment(db, id);
  if (!comment) throw new CommentError('Comentário não encontrado.', 404, 'not_found');
  if (comment.authorId !== userId) {
    throw new CommentError('Você só pode editar os seus comentários.', 403, 'forbidden');
  }

  await db.update(comments).set({ body: text, updatedAt: new Date() }).where(eq(comments.id, id));

  const slug = await postSlugOf(db, comment.postId);
  if (slug) revalidatePath(`/posts/${slug}`);
}

// Apagar remove de vez: o autor apaga o próprio; moderador (editor em
// diante), qualquer um.
export async function deleteComment(actor: Actor, id: string) {
  const db = await getDb();

  const comment = await findComment(db, id);
  if (!comment) throw new CommentError('Comentário não encontrado.', 404, 'not_found');
  if (comment.authorId !== actor.id && !canModerateComments(actor.role)) {
    throw new CommentError('Você só pode apagar os seus comentários.', 403, 'forbidden');
  }

  await db.delete(comments).where(eq(comments.id, id));

  const slug = await postSlugOf(db, comment.postId);
  if (slug) revalidatePath(`/posts/${slug}`);
  return { postSlug: slug };
}

export const visibilitySchema = z.object({ status: z.enum(['visible', 'hidden']) });

// Moderação (editores e acima): esconde do site sem apagar, ou mostra de novo.
export async function setCommentVisibility(actor: Actor, id: string, status: 'visible' | 'hidden') {
  if (!canModerateComments(actor.role)) {
    throw new CommentError('Só editores moderam comentários.', 403, 'forbidden');
  }
  const db = await getDb();

  const comment = await findComment(db, id);
  if (!comment) throw new CommentError('Comentário não encontrado.', 404, 'not_found');

  const now = new Date();
  await db
    .update(comments)
    .set({ status, moderatedBy: actor.id, moderatedAt: now, updatedAt: now })
    .where(eq(comments.id, id));

  const slug = await postSlugOf(db, comment.postId);
  if (slug) revalidatePath(`/posts/${slug}`);
  return { postSlug: slug };
}

const moderators = alias(users, 'moderators');

export async function listCommentsForAdmin(
  actor: Actor,
  filter: { status?: 'visible' | 'hidden' } = {},
): Promise<ManagedComment[]> {
  if (!canModerateComments(actor.role)) {
    throw new CommentError('Só editores moderam comentários.', 403, 'forbidden');
  }
  const db = await getDb();

  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      status: comments.status,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      moderatedAt: comments.moderatedAt,
      moderatedBy: moderators.username,
      postSlug: posts.slug,
      postTitle: posts.title,
      ...authorJoin,
    })
    .from(comments)
    .innerJoin(posts, eq(posts.id, comments.postId))
    .leftJoin(users, eq(users.id, comments.authorId))
    .leftJoin(moderators, eq(moderators.id, comments.moderatedBy))
    .where(filter.status ? eq(comments.status, filter.status) : undefined)
    .orderBy(desc(comments.createdAt))
    .limit(200);

  return rows.map((row) => ({
    ...toView(row),
    status: row.status,
    postSlug: row.postSlug,
    postTitle: row.postTitle,
    moderatedBy: row.moderatedBy,
    moderatedAt: row.moderatedAt,
  }));
}
