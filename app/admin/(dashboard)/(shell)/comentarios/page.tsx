import type { Metadata } from 'next';

import { canModerateComments } from '@/lib/auth/permissions';
import { actorOf, requireAdminPage } from '@/lib/auth/session';
import { listCommentsForAdmin } from '@/lib/comments/service';
import { CommentsTable } from '@/components/admin/comments-table';
import { NoPermission } from '@/components/admin/no-permission';
import { AdminPageHeader } from '@/components/admin/page-header';

export const metadata: Metadata = {
  title: 'Comentários',
};

export default async function CommentsPage() {
  const session = await requireAdminPage('/admin/comentarios');
  const actor = actorOf(session);
  if (!canModerateComments(actor.role)) {
    return <NoPermission message="Só editores moderam comentários." />;
  }

  const comments = await listCommentsForAdmin(actor);

  return (
    <div className="gz-root gz-admin-page">
      <AdminPageHeader
        kicker="moderação"
        title="Comentários"
        description="Ocultar tira do site sem apagar; apagar remove de vez."
      />
      <CommentsTable comments={comments} />
    </div>
  );
}
