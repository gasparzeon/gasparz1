import type { Metadata } from 'next';

import { canAccessPanel, canEditAllPosts } from '@/lib/auth/permissions';
import { requireAdminPage } from '@/lib/auth/session';
import { getMediaMode } from '@/lib/cms/media';
import { listTags } from '@/lib/cms/posts';
import { listActiveAuthors } from '@/lib/users/service';
import { PostEditor } from '@/components/admin/post-editor';
import { ReaderLanding } from '@/components/admin/reader-landing';

export const metadata: Metadata = {
  title: 'Novo post',
};

export default async function NewPostPage() {
  const { user } = await requireAdminPage('/admin/posts/new');
  if (!canAccessPanel(user.role)) {
    return <ReaderLanding name={user.name} />;
  }

  const [tags, authors] = await Promise.all([
    listTags(),
    canEditAllPosts(user.role) ? listActiveAuthors() : Promise.resolve([]),
  ]);

  return (
    <PostEditor
      initial={null}
      viewer={user}
      authors={authors}
      mediaMode={getMediaMode()}
      tagSuggestions={tags}
    />
  );
}
