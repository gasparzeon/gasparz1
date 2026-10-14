import type { Metadata } from 'next';

import { canManageSite } from '@/lib/auth/permissions';
import { actorOf, requireAdminPage } from '@/lib/auth/session';
import { getMediaMode } from '@/lib/cms/media';
import { getSiteSettingsForAdmin } from '@/lib/site/service';
import { NoPermission } from '@/components/admin/no-permission';
import { PageEditor } from '@/components/admin/pages/page-editor';

export const metadata: Metadata = {
  title: 'Nova página',
};

export default async function NewPagePage() {
  const session = await requireAdminPage('/admin/paginas/nova');
  const actor = actorOf(session);
  if (!canManageSite(actor.role)) {
    return <NoPermission message="Só administradores editam as páginas do site." />;
  }

  const { settings } = await getSiteSettingsForAdmin(actor);

  return (
    <div className="gz-root gz-admin-page gz-admin-page--narrow">
      <PageEditor initial={null} social={settings.social} mediaMode={getMediaMode()} />
    </div>
  );
}
