import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { canManageSite } from '@/lib/auth/permissions';
import { actorOf, requireAdminPage } from '@/lib/auth/session';
import { getMediaMode } from '@/lib/cms/media';
import { PageError, getPageForEditor } from '@/lib/site/pages';
import { getSiteSettingsForAdmin } from '@/lib/site/service';
import { NoPermission } from '@/components/admin/no-permission';
import { PageEditor } from '@/components/admin/pages/page-editor';

export const metadata: Metadata = {
  title: 'Editar página',
};

type Params = Promise<{ id: string }>;

export default async function EditPagePage({ params }: { params: Params }) {
  const { id } = await params;
  const session = await requireAdminPage(`/admin/paginas/${id}`);
  const actor = actorOf(session);
  if (!canManageSite(actor.role)) {
    return <NoPermission message="Só administradores editam as páginas do site." />;
  }

  let page;
  try {
    page = await getPageForEditor(actor, id);
  } catch (error) {
    if (error instanceof PageError && error.status === 404) notFound();
    throw error;
  }
  const { settings } = await getSiteSettingsForAdmin(actor);

  return (
    <div className="gz-root gz-admin-page gz-admin-page--narrow">
      <PageEditor initial={page} social={settings.social} mediaMode={getMediaMode()} />
    </div>
  );
}
