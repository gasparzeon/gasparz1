import type { Metadata } from 'next';

import { canAccessPanel, canEditAllPosts } from '@/lib/auth/permissions';
import { actorOf, requireAdminPage } from '@/lib/auth/session';
import { getMediaMode } from '@/lib/cms/media';
import { listPostsForAdmin } from '@/lib/cms/posts';
import { databaseKind } from '@/lib/db';
import { AdminNotice } from '@/components/admin/admin-notice';
import { PostsTable } from '@/components/admin/posts-table';
import { ReaderLanding } from '@/components/admin/reader-landing';
import { AdminPageHeader } from '@/components/admin/page-header';

export const metadata: Metadata = {
  title: 'Posts',
};

export default async function AdminPostsPage() {
  const session = await requireAdminPage('/admin');
  if (!canAccessPanel(session.user.role)) {
    return <ReaderLanding name={session.user.name} />;
  }
  const actor = actorOf(session);
  const posts = await listPostsForAdmin(actor);

  const published = posts.filter((post) => post.status === 'published').length;
  const inReview = posts.filter((post) => post.status === 'review').length;
  const words = posts.reduce((sum, post) => sum + post.wordCount, 0);
  const seesAll = canEditAllPosts(actor.role);

  return (
    <div className="gz-root gz-admin-page">
      <AdminPageHeader kicker={seesAll ? 'todos os autores' : 'seus textos'} title="Posts">
        <div className="gz-stats">
          {[
            { label: 'publicados', value: published },
            { label: 'em revisão', value: inReview },
            { label: 'palavras', value: words.toLocaleString('pt-BR') },
          ].map((stat) => (
            <div key={stat.label} className="gz-stat">
              <b>{stat.value}</b>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
      </AdminPageHeader>

      <div className="mb-8 space-y-3">
        {inReview > 0 && seesAll && (
          <AdminNotice icon="info">
            {inReview === 1 ? 'Há 1 post' : `Há ${inReview} posts`} de colaboradores aguardando
            revisão. Abra, revise e publique.
          </AdminNotice>
        )}

        {databaseKind() === 'pglite' && process.env.NODE_ENV !== 'production' && (
          <AdminNotice icon="local">
            Banco local (PGlite em <code>.data/pglite</code>). Em produção configure{' '}
            <code>DATABASE_URL</code> com um Postgres (ex.: Neon).
          </AdminNotice>
        )}

        {getMediaMode() === 'disabled' && (
          <AdminNotice tone="warning" icon="warning">
            Upload de imagens e vídeos desativado: conecte um store do Vercel Blob ao projeto (
            <code>BLOB_READ_WRITE_TOKEN</code>). Até lá, insira mídia por URL.
          </AdminNotice>
        )}
      </div>

      <PostsTable posts={posts} currentUserId={actor.id} role={actor.role} showAuthors={seesAll} />
    </div>
  );
}
