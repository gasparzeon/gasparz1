import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FileText } from 'lucide-react';

import { getAllPosts, getAuthor, getPostsByAuthor } from '@/lib/content';
import { readmeToHast } from '@/lib/markdown/readme';
import { getSiteSettings } from '@/lib/site/service';
import { plural, registryNumbers } from '@/lib/posts-view';
import { AuthorAvatar } from '@/components/author-avatar';
import { Breadcrumbs } from '@/components/site/breadcrumbs';
import { PostItem } from '@/components/site/post-item';
import { OwnProfileEdit } from '@/components/site/own-profile-edit';
import { ReadmeView } from '@/components/site/readme';
import { SocialConnections } from '@/components/site/social-connections';

export const revalidate = 300;

interface AuthorPageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: AuthorPageProps): Promise<Metadata> {
  const { username } = await params;
  const [author, settings] = await Promise.all([getAuthor(username), getSiteSettings()]);
  if (!author) return {};
  return {
    title: author.name,
    description: author.bio || `Posts de ${author.name} no ${settings.general.name}.`,
  };
}

export default async function AuthorPage({ params }: AuthorPageProps) {
  const { username } = await params;
  const author = await getAuthor(username);
  if (!author) notFound();

  const [posts, all, readme] = await Promise.all([
    getPostsByAuthor(author.username),
    getAllPosts(),
    author.readme ? readmeToHast(author.readme) : null,
  ]);
  const numbers = registryNumbers(all);

  return (
    <div className="gz-root">
      <div className="gz-wrap">
        <Breadcrumbs items={[{ label: 'Creators', href: '/creators' }, { label: author.name }]} />

        <header className="flex flex-col gap-6 py-8 sm:flex-row sm:items-center lg:py-12">
          <AuthorAvatar author={author} size={96} className="text-2xl" />
          <div className="grid gap-3">
            <p className="gz-kicker" data-gz-intro="">
              <b>@</b>
              {author.username}
            </p>
            <h1 className="gz-h1" data-gz-scramble="intro">
              {author.name}
            </h1>
            {author.bio && (
              <p className="gz-lead" data-gz-intro="">
                {author.bio}
              </p>
            )}
          </div>
        </header>

        <SocialConnections socials={author.socials} owner={author.name} className="mb-10" />

        {/* README: o que a própria pessoa quis contar (Markdown curto, lib/users/readme.ts). */}
        {readme ? (
          <section id="readme" className="gz-panel gz-readme mb-12" aria-labelledby="gz-readme-t">
            <div className="gz-readme-bar">
              <FileText className="gz-ico" aria-hidden="true" />
              <h2 id="gz-readme-t" className="gz-readme-title">
                README.md
              </h2>
              <OwnProfileEdit username={author.username} hasReadme />
            </div>
            <ReadmeView tree={readme} />
          </section>
        ) : (
          <OwnProfileEdit username={author.username} hasReadme={false} />
        )}

        <div className="gz-results">
          <p className="gz-query">
            <span aria-hidden="true">› </span>
            <b>{plural(posts.length, 'post publicado', 'posts publicados')}</b>
          </p>
        </div>

        {posts.length > 0 ? (
          <ul className="gz-list">
            {posts.map((post) => (
              <PostItem key={post.slug} post={post} number={numbers.get(post.slug)} heading="h2" />
            ))}
          </ul>
        ) : (
          <div className="gz-empty">
            <p className="gz-h3">Nenhum post publicado ainda.</p>
          </div>
        )}

        <div style={{ height: '4rem' }} />
      </div>
    </div>
  );
}
