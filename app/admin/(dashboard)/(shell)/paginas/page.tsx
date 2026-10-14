import type { Metadata } from 'next';

import { canManageSite } from '@/lib/auth/permissions';
import { actorOf, requireAdminPage } from '@/lib/auth/session';
import { listPagesForAdmin } from '@/lib/site/pages';
import { NoPermission } from '@/components/admin/no-permission';
import { PagesTable } from '@/components/admin/pages/pages-table';
import { AdminPageHeader } from '@/components/admin/page-header';

export const metadata: Metadata = {
  title: 'Páginas',
};

export default async function PagesPage() {
  const session = await requireAdminPage('/admin/paginas');
  const actor = actorOf(session);
  if (!canManageSite(actor.role)) {
    return <NoPermission message="Só administradores editam as páginas do site." />;
  }

  return (
    <div className="gz-root gz-admin-page gz-admin-page--narrow">
      <AdminPageHeader
        kicker="site"
        title="Páginas"
        description="Páginas fixas do site, como Sobre e Apoie, montadas por blocos."
      />
      <PagesTable pages={await listPagesForAdmin(actor)} />
    </div>
  );
}
