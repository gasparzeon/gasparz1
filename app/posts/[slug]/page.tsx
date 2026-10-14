import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';

import { getAllPosts, getAuthor, getPostBySlug } from '@/lib/content';
import { getSiteSettings } from '@/lib/site/service';
import { resolveSiteUrl } from '@/lib/site/schema';
import { databaseKind } from '@/lib/db';
import { getSection } from '@/lib/sections';
import { longDate, minutesOf, registryNumbers } from '@/lib/posts-view';

import { PostContent } from '@/components/post-content';
import { ShareButtons } from '@/components/share-buttons';
import { Comments } from '@/components/comments';
import { AuthorAvatar } from '@/components/author-avatar';
import { Breadcrumbs } from '@/components/site/breadcrumbs';
import { PostCover } from '@/components/site/post-cover';
import { PostSide } from '@/components/site/post-side';
import { SectionSig } from '@/components/site/section-sig';
import { SocialConnections } from '@/components/site/social-connections';

// Gerado estaticamente e regenerado quando um post muda (revalidatePath)
// ou, no máximo, a cada 5 minutos (posts agendados).
export const revalidate = 300;

interface PostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  // O Next roda isto em outro processo, e o PGlite (banco local sem
  // DATABASE_URL) só aceita um processo por diretório: renderiza sob demanda.
  if (databaseKind() === 'pglite') return [];

  const posts = await getAllPosts();

  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) return {};

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt || undefined,
      modifiedTime: post.updatedAt || undefined,
      tags: post.tags as string[],
      authors: [post.author.name],
      ...(post.coverImage ? { images: [{ url: post.coverImage }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      ...(post.coverImage ? { images: [post.coverImage] } : {}),
    },
  };
}

// "1 de outubro de 2026" → "1 out. 2026" (formato de citação)
function citeDate(iso: string) {
  const months = [
    'jan.',
    'fev.',
    'mar.',
    'abr.',
    'maio',
    'jun.',
    'jul.',
    'ago.',
    'set.',
    'out.',
    'nov.',
    'dez.',
  ];
  const [year, month, day] = iso.split('-');
  return `${Number(day)} ${months[Number(month) - 1] ?? ''} ${year}`;
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const [post, settings, posts] = await Promise.all([
    getPostBySlug(slug),
    getSiteSettings(),
    getAllPosts(),
  ]);

  if (!post) {
    notFound();
  }
  const writer = await getAuthor(post.author.username);

  const section = getSection(post.section);
  const number = registryNumbers(posts).get(post.slug) ?? '';
  const index = posts.findIndex((item) => item.slug === post.slug);
  const older = index === -1 ? undefined : posts[index + 1];
  const newer = index > 0 ? posts[index - 1] : undefined;
  const url = `${resolveSiteUrl(settings)}/posts/${post.slug}`;
  const sectionHref = section ? `/posts?secao=${section.key}` : '/posts';

  return (
    <div className="gz-root">
      <div className="gz-progress" data-gz-progress="[data-gz-article]" aria-hidden="true" />

      <article data-gz-article="">
        <div className="gz-wrap">
          <Breadcrumbs
            items={[
              { label: section?.many ?? settings.postsPage.title, href: sectionHref },
              { label: post.title },
            ]}
          />

          <header className="gz-post-head">
            <p className="gz-meta" data-gz-intro="">
              {section && (
                <Link className="gz-badge" href={sectionHref}>
                  <SectionSig section={post.section} />
                  {section.one}
                </Link>
              )}
              {number && <span className="gz-id">{number} · registro do arquivo</span>}
            </p>
            <h1 className="gz-post-title" data-gz-scramble="intro">
              {post.title}
            </h1>
            {post.excerpt && (
              <p className="gz-post-ex" data-gz-intro="">
                {post.excerpt}
              </p>
            )}
            <div className="gz-byline" data-gz-intro="">
              <Link className="gz-author" href={`/autores/${post.author.username}`}>
                <AuthorAvatar author={post.author} size={40} />
                Por {post.author.name}
              </Link>
              {post.publishedAt && (
                <time dateTime={post.publishedAt}>{longDate(post.publishedAt)}</time>
              )}
              <span>{post.readingTime} de leitura</span>
              {post.updatedAt && <span>Atualizado em {longDate(post.updatedAt)}</span>}
            </div>
          </header>

          <PostCover
            section={post.section}
            image={post.coverImage}
            tag={number ? `${number} · fig. 01` : undefined}
            variant="wide"
            className="gz-post-cover"
            priority
          />
        </div>

        <div className="gz-wrap gz-post-layout">
          <PostSide minutes={minutesOf(post.readingTime)} />

          <div className="gz-prose">
            {/* Cada parte do texto (h2) ganha o rótulo "Parte N" e decodifica ao aparecer. */}
            <div className="prose gz-parts" data-gz-decode="">
              <PostContent content={post.content} />
            </div>

            <aside className="gz-endcard" aria-label="Sobre este post">
              <div>
                <h2>Quem escreveu</h2>
                <div className="gz-writer">
                  <AuthorAvatar author={post.author} size={56} className="text-lg" />
                  <div className="grid gap-1">
                    <Link className="gz-writer-name" href={`/autores/${post.author.username}`}>
                      {post.author.name}
                    </Link>
                    {post.author.bio && <p className="gz-small">{post.author.bio}</p>}
                  </div>
                </div>
                {writer && (
                  <SocialConnections socials={writer.socials} owner={writer.name} compact />
                )}
              </div>
              {post.tags.length > 0 && (
                <div>
                  <h2>Etiquetas</h2>
                  <ul className="gz-tags">
                    {post.tags.map((tag) => (
                      <li key={tag}>
                        <Link className="gz-tag" href={`/posts?tag=${encodeURIComponent(tag)}`}>
                          {tag}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <h2>Compartilhar</h2>
                <ShareButtons title={post.title} url={url} networks={settings.integrations.share} />
              </div>
              <div>
                <h2>Como citar</h2>
                <p className="gz-cite">
                  {post.author.name.toUpperCase()}. {post.title}. {settings.general.name}
                  {post.publishedAt && `, ${citeDate(post.publishedAt)}`}. Disponível em: {url}.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </article>

      {(older || newer) && (
        <nav className="gz-section" aria-label="Outros posts" style={{ paddingTop: 0 }}>
          <div className="gz-wrap gz-pn">
            {older ? (
              <Link className="gz-pn-card" href={`/posts/${older.slug}`}>
                <span className="gz-pn-k">
                  <ChevronLeft className="gz-ico" aria-hidden="true" />
                  Post anterior
                </span>
                <span className="gz-pn-t" data-gz-scramble="hover">
                  {older.title}
                </span>
              </Link>
            ) : (
              <div className="gz-pn-card">
                <span className="gz-pn-k">Post anterior</span>
                <span className="gz-pn-t">Este é o primeiro post do arquivo.</span>
              </div>
            )}
            {newer ? (
              <Link className="gz-pn-card" href={`/posts/${newer.slug}`}>
                <span className="gz-pn-k">
                  Próximo post
                  <ChevronRight className="gz-ico" aria-hidden="true" />
                </span>
                <span className="gz-pn-t" data-gz-scramble="hover">
                  {newer.title}
                </span>
              </Link>
            ) : (
              <div className="gz-pn-card">
                <span className="gz-pn-k">Próximo post</span>
                <span className="gz-pn-t">Este é o post mais recente.</span>
              </div>
            )}
          </div>
        </nav>
      )}

      <div className="gz-wrap" style={{ paddingBottom: '2rem' }}>
        <div style={{ maxWidth: '52rem' }}>
          <Comments postSlug={post.slug} config={settings.integrations.comments} />
        </div>
      </div>

      <a className="gz-totop" href="#conteudo" data-gz-totop="">
        <ArrowUp className="gz-ico" aria-hidden="true" />
        Topo
      </a>
    </div>
  );
}
