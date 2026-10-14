import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ShieldX } from 'lucide-react';

import { canEditAllPosts } from '@/lib/auth/permissions';
import { actorOf, requireAdminPage } from '@/lib/auth/session';
import { getMediaMode } from '@/lib/cms/media';
import { PostError, getPostForEditor, listTags } from '@/lib/cms/posts';
import { listActiveAuthors } from '@/lib/users/service';
import { PostEditor } from '@/components/admin/post-editor';

type Params = Promise<{ id: string }>;

export const metadata: Metadata = {
  title: 'Editar post',
};

export default async function EditPostPage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await requireAdminPage(`/admin/posts/${id}`);

  let post;
  try {
    post = await getPostForEditor(actorOf(session), id);
  } catch (error) {
    if (error instanceof PostError && error.status === 404) notFound();
    if (error instanceof PostError && error.status === 403) {
      return (
        <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
          <ShieldX className="mb-4 h-8 w-8 text-muted-foreground" />
          <h1 className="mb-2 font-sans text-xl font-semibold tracking-normal">Sem permissão</h1>
          <p className="mb-6 text-sm text-muted-foreground">{error.message}</p>
          <a href="/admin" className="text-sm underline underline-offset-4">
            Voltar para os posts
          </a>
        </div>
      );
    }
    throw error;
  }

  const [tags, authors] = await Promise.all([
    listTags(),
    canEditAllPosts(session.user.role) ? listActiveAuthors() : Promise.resolve([]),
  ]);

  return (
    <PostEditor
      key={post.id}
      initial={post}
      viewer={session.user}
      authors={authors}
      mediaMode={getMediaMode()}
      tagSuggestions={tags}
    />
  );
}
