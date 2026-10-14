import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

import type { ProfileSocial } from '@/lib/users/socials';

// Papéis inspirados no Ghost. `owner` é o dono do blog (criado a partir das
// variáveis ADMIN_*) e não pode ser rebaixado nem removido. `reader` é a
// conta criada no próprio site: só comenta, não entra no painel.
export const userRole = pgEnum('user_role', [
  'owner',
  'admin',
  'editor',
  'author',
  'contributor',
  'reader',
]);

// pending:   criou a conta e aguarda aprovação (só vê o próprio pedido)
// rejected:  pedido recusado; pode pedir de novo
// invited:   convidado pelo admin, ainda não definiu a senha
// active:    pode entrar e escrever
// suspended: bloqueado (sessões são recusadas na hora)
export const userStatus = pgEnum('user_status', [
  'pending',
  'invited',
  'active',
  'suspended',
  'rejected',
]);

// review: enviado por um colaborador e aguardando um editor publicar.
export const postStatus = pgEnum('post_status', ['draft', 'review', 'published']);

export const tokenPurpose = pgEnum('token_purpose', ['invite', 'reset']);

export const mediaKind = pgEnum('media_kind', ['image', 'video']);

export const pageStatus = pgEnum('page_status', ['draft', 'published']);

// Comentários do próprio site (sem Giscus/GitHub). `hidden` é a moderação:
// sai do ar mas continua no banco; apagar remove de vez.
export const commentStatus = pgEnum('comment_status', ['visible', 'hidden']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    username: text('username').notNull(),
    email: text('email'),
    name: text('name').notNull(),
    bio: text('bio').notNull().default(''),
    avatarUrl: text('avatar_url').notNull().default(''),
    // Redes ligadas ao perfil (Spotify, X, Facebook, TikTok, Instagram), com o
    // link já remontado e conferido (lib/users/socials.ts).
    socials: jsonb('socials').$type<ProfileSocial[]>().notNull().default([]),
    // README do creator (Markdown curto, lib/users/readme.ts).
    readme: text('readme').notNull().default(''),
    // Nulo enquanto o convite não for aceito.
    passwordHash: text('password_hash'),
    role: userRole('role').notNull().default('contributor'),
    status: userStatus('status').notNull().default('pending'),
    requestNote: text('request_note').notNull().default(''),
    // Último pedido (refazer depois de recusado volta para o fim da fila).
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: uuid('approved_by').references((): AnyPgColumn => users.id, {
      onDelete: 'set null',
    }),
    // Última decisão sobre o pedido (aprovação ou recusa): quem e quando.
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: uuid('reviewed_by').references((): AnyPgColumn => users.id, {
      onDelete: 'set null',
    }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    // Tokens emitidos antes disso são recusados (suspensão, troca ou
    // redefinição de senha derrubam todas as sessões do usuário).
    sessionsValidAfter: timestamp('sessions_valid_after', { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('users_username_lower_idx').on(sql`lower(${table.username})`),
    uniqueIndex('users_email_lower_idx').on(sql`lower(${table.email})`),
    index('users_status_idx').on(table.status),
    // No máximo um dono.
    uniqueIndex('users_single_owner_idx')
      .on(table.role)
      .where(sql`${table.role} = 'owner'`),
  ],
);

// Links de uso único (convite e redefinição de senha). Só o hash SHA-256 do
// token fica no banco.
export const userTokens = pgTable(
  'user_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: tokenPurpose('purpose').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('user_tokens_user_idx').on(table.userId)],
);

export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    excerpt: text('excerpt').notNull().default(''),
    // Markdown (CommonMark + GFM).
    content: text('content').notNull().default(''),
    coverImage: text('cover_image').notNull().default(''),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    // Seção do arquivo (lib/sections.ts); opcional.
    section: text('section'),
    status: postStatus('status').notNull().default('draft'),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    // Data exibida no post. Publicado com data futura = agendado.
    publishedAt: date('published_at', { mode: 'string' }).notNull(),
    // "Atualizado em", opcional e controlado pelo autor.
    contentUpdatedAt: date('content_updated_at', { mode: 'string' }),
    // Concorrência otimista: cada gravação incrementa.
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  (table) => [
    index('posts_status_published_idx').on(table.status, table.publishedAt),
    index('posts_author_idx').on(table.authorId),
    index('posts_tags_idx').using('gin', table.tags),
  ],
);

export const media = pgTable(
  'media',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    url: text('url').notNull().unique(),
    pathname: text('pathname').notNull(),
    kind: mediaKind('kind').notNull(),
    size: integer('size').notNull(),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('media_created_idx').on(table.createdAt)],
);

// Páginas institucionais (Sobre, Apoie…), editadas no painel por blocos.
export const pages = pgTable('pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  // Lista de blocos validada por pageBlockSchema (lib/site/pages-schema.ts).
  blocks: jsonb('blocks')
    .notNull()
    .default(sql`'[]'::jsonb`),
  showBackLink: boolean('show_back_link').notNull().default(false),
  status: pageStatus('status').notNull().default('draft'),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  // Concorrência otimista: cada gravação incrementa.
  version: integer('version').notNull().default(1),
  ...timestamps,
});

// Estado de segurança do OAuth (codes usados, refresh trocados, sessões
// revogadas) e contadores de rate limit, com expiração.
export const kv = pgTable(
  'kv',
  {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('kv_expires_idx').on(table.expiresAt)],
);

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Comentários do próprio site. Apagar o post remove os comentários juntos
// (cascade); apagar a conta mantém o texto, sem o autor (set null).
export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    status: commentStatus('status').notNull().default('visible'),
    moderatedBy: uuid('moderated_by').references(() => users.id, { onDelete: 'set null' }),
    moderatedAt: timestamp('moderated_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('comments_post_idx').on(table.postId, table.createdAt),
    index('comments_author_idx').on(table.authorId),
  ],
);

export type User = typeof users.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Role = (typeof userRole.enumValues)[number];
export type UserStatus = (typeof userStatus.enumValues)[number];
export type PostStatus = (typeof postStatus.enumValues)[number];
