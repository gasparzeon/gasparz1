import type { Metadata } from 'next';

import { getAllPosts } from '@/lib/content';
import { getSiteSettings } from '@/lib/site/service';
import { isSectionKey } from '@/lib/sections';
import { registryNumbers } from '@/lib/posts-view';
import { ArchiveBrowser } from '@/components/site/archive-browser';

export async function generateMetadata(): Promise<Metadata> {
  const { postsPage } = await getSiteSettings();
  return { title: postsPage.title, description: postsPage.description || undefined };
}

type Param = string | string[] | undefined;

interface PostsPageProps {
  // ?q= busca, ?secao= seção, ?tag= etiqueta, ?ordem=antigos
  searchParams: Promise<{ q?: Param; secao?: Param; tag?: Param; ordem?: Param }>;
}

const single = (value: Param) => (typeof value === 'string' ? value : '');

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const params = await searchParams;
  const [posts, settings] = await Promise.all([getAllPosts(), getSiteSettings()]);
  const numbers = registryNumbers(posts);
  const section = single(params.secao);
  const initial = {
    q: single(params.q).slice(0, 100),
    section: isSectionKey(section) ? section : ('all' as const),
    tag: single(params.tag).slice(0, 40),
    order: single(params.ordem) === 'antigos' ? ('asc' as const) : ('desc' as const),
  };

  return (
    <ArchiveBrowser
      // Um link do menu para outra seção remonta a busca com os novos filtros.
      key={JSON.stringify(initial)}
      posts={posts.map((post) => ({
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        publishedAt: post.publishedAt,
        readingTime: post.readingTime,
        section: post.section,
        coverImage: post.coverImage,
        tags: post.tags,
        number: numbers.get(post.slug) ?? '',
      }))}
      initial={initial}
      title={settings.postsPage.title}
      description={settings.postsPage.description}
    />
  );
}
