import 'server-only';

import { cache } from 'react';
import { and, asc, desc, eq, lte, ne, sql } from 'drizzle-orm';

import { SLUG_RE } from '@/lib/cms/schema';
import { getDb } from '@/lib/db';
import { posts, users } from '@/lib/db/schema';
import { isSectionKey, type SectionKey } from '@/lib/sections';
import { readSocials, type ProfileSocial } from '@/lib/users/socials';

// Leitura pública: só posts publicados com data de hoje ou anterior (data
// futura = agendado). Memoizado por requisição com React cache().

export type PostAuthor = {
  name: string;
  username: string;
  avatarUrl: string;
  bio: string;
};

export type Post = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  updatedAt: string;
  tags: string[];
  section: SectionKey | null;
  draft: boolean;
  coverImage: string | null;
  readingTime: string;
  author: PostAuthor;
};

export type PostWithContent = Post & {
  content: string;
};

const WORDS_PER_MINUTE = 200;

const columns = {
  slug: posts.slug,
  title: posts.title,
  excerpt: posts.excerpt,
  publishedAt: posts.publishedAt,
  contentUpdatedAt: posts.contentUpdatedAt,
  tags: posts.tags,
  section: posts.section,
  coverImage: posts.coverImage,
  words: sql<number>`coalesce(array_length(regexp_split_to_array(btrim(${posts.content}), '\\s+'), 1), 0)::int`,
  author: {
    name: users.name,
    username: users.username,
    avatarUrl: users.avatarUrl,
    bio: users.bio,
  },
};

type Row = {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  contentUpdatedAt: string | null;
  tags: string[];
  section: string | null;
  coverImage: string;
  words: number;
  author: PostAuthor;
};

function toPost(row: Row): Post {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    publishedAt: row.publishedAt,
    updatedAt: row.contentUpdatedAt ?? '',
    tags: row.tags,
    section: isSectionKey(row.section) ? row.section : null,
    draft: false,
    coverImage: row.coverImage || null,
    readingTime: `${Math.max(1, Math.round(row.words / WORDS_PER_MINUTE))} min`,
    author: row.author,
  };
}

// "Hoje" no fuso do blog, e não no do servidor: o Neon roda em UTC e o PGlite
// no fuso da máquina. Com current_date, um post agendado para amanhã aparecia
// às 21h de hoje (meia-noite UTC).
export const BLOG_TIMEZONE = 'America/Sao_Paulo';

const isPublic = and(
  eq(posts.status, 'published'),
  lte(posts.publishedAt, sql`(now() at time zone ${BLOG_TIMEZONE})::date`),
);

export const getAllPosts = cache(async (): Promise<Post[]> => {
  const db = await getDb();
  const rows = await db
    .select(columns)
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(isPublic)
    .orderBy(desc(posts.publishedAt), desc(posts.createdAt));
  return rows.map(toPost);
});

export const getPostBySlug = cache(async (slug: string): Promise<PostWithContent | null> => {
  // O slug vem da URL.
  if (!SLUG_RE.test(slug)) return null;

  const db = await getDb();
  const [row] = await db
    .select({ ...columns, content: posts.content })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(and(isPublic, eq(posts.slug, slug)))
    .limit(1);

  return row ? { ...toPost(row), content: row.content } : null;
});

export async function getAllTags(): Promise<string[]> {
  const posts = await getAllPosts();
  return Array.from(new Set(posts.flatMap((post) => post.tags))).sort();
}

export async function getPostsByTag(tag: string): Promise<Post[]> {
  const posts = await getAllPosts();
  return posts.filter((post) => post.tags.includes(tag));
}

// Leitores não têm página de autor nem aparecem em /creators: só quem
// escreve no painel, com a conta ativa.
const isWriter = and(eq(users.status, 'active'), ne(users.role, 'reader'));

const authorColumns = {
  name: users.name,
  username: users.username,
  avatarUrl: users.avatarUrl,
  bio: users.bio,
  socials: users.socials,
  readme: users.readme,
};

export type PublicAuthor = PostAuthor & { socials: ProfileSocial[]; readme: string };

export const getAuthor = cache(async (username: string): Promise<PublicAuthor | null> => {
  const db = await getDb();
  const [author] = await db
    .select(authorColumns)
    .from(users)
    .where(and(eq(sql`lower(${users.username})`, username.toLowerCase()), isWriter))
    .limit(1);
  return author ? { ...author, socials: readSocials(author.socials) } : null;
});

export type Creator = PublicAuthor & {
  posts: number;
  latest: string | null;
  // Seções em que escreve, da mais frequente para a menos.
  sections: SectionKey[];
};

// Quem escreve no arquivo (/creators): mais posts publicados primeiro.
export const getCreators = cache(async (): Promise<Creator[]> => {
  const db = await getDb();
  const [rows, all] = await Promise.all([
    db.select(authorColumns).from(users).where(isWriter).orderBy(asc(users.name)),
    getAllPosts(),
  ]);

  return rows
    .map((row) => {
      const own = all.filter((post) => post.author.username === row.username);
      const bySection = new Map<SectionKey, number>();
      own.forEach((post) => {
        if (post.section) bySection.set(post.section, (bySection.get(post.section) ?? 0) + 1);
      });
      return {
        ...row,
        socials: readSocials(row.socials),
        posts: own.length,
        latest: own[0]?.publishedAt ?? null,
        sections: [...bySection.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key),
      };
    })
    .sort((a, b) => b.posts - a.posts || a.name.localeCompare(b.name, 'pt-BR'));
});

export async function getPostsByAuthor(username: string): Promise<Post[]> {
  const posts = await getAllPosts();
  return posts.filter((post) => post.author.username === username);
}
