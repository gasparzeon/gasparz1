import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SLUG_RE } from '@/lib/cms/schema';
import { databaseKind } from '@/lib/db';
import { markdownToHast } from '@/lib/markdown/pipeline';
import { getPublishedPage, listPublishedPages } from '@/lib/site/pages';
import type { PageBlock } from '@/lib/site/pages-schema';
import { getSiteSettings } from '@/lib/site/service';
import { PageView } from '@/components/site/page-blocks';

// Páginas criadas no painel (/admin/paginas): Sobre, Apoie e as novas. Rotas
// fixas (/posts, /admin…) e arquivos de public/ têm prioridade sobre esta.
export const revalidate = 300;

type Params = Promise<{ slug: string }>;

async function loadPage(slug: string) {
  if (!SLUG_RE.test(slug)) return null;
  return getPublishedPage(slug);
}

export async function generateStaticParams() {
  // Como nos posts: o PGlite só aceita um processo por diretório, e o Next
  // roda isto em outro processo. Sem Postgres, gera na primeira visita.
  if (databaseKind() === 'pglite') return [];
  return (await listPublishedPages()).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const page = await loadPage((await params).slug).catch(() => null);
  if (!page) return {};
  return {
    title: page.title,
    description: page.description || undefined,
    alternates: { canonical: `/${page.slug}` },
  };
}

export default async function SitePage({ params }: { params: Params }) {
  const page = await loadPage((await params).slug);
  if (!page) notFound();

  const settings = await getSiteSettings();
  const trees = Object.fromEntries(
    await Promise.all(
      page.blocks
        .filter(
          (block): block is Extract<PageBlock, { type: 'markdown' }> => block.type === 'markdown',
        )
        .map(async (block) => [block.id, await markdownToHast(block.content)] as const),
    ),
  );

  return <PageView page={page} settings={settings} trees={trees} />;
}
