import type { Metadata } from 'next';
import Link from 'next/link';

import { canManageSite } from '@/lib/auth/permissions';
import { actorOf, requireAdminPage } from '@/lib/auth/session';
import { getMediaMode } from '@/lib/cms/media';
import { getSiteSettingsForAdmin } from '@/lib/site/service';
import { NoPermission } from '@/components/admin/no-permission';
import { SiteSettingsForm } from '@/components/admin/site/site-settings-form';
import { AdminPageHeader } from '@/components/admin/page-header';

export const metadata: Metadata = {
  title: 'Site',
};

export default async function SiteSettingsPage() {
  const session = await requireAdminPage('/admin/site');
  const actor = actorOf(session);
  if (!canManageSite(actor.role)) {
    return <NoPermission message="Só administradores alteram as configurações do site." />;
  }

  const { settings, updatedAt } = await getSiteSettingsForAdmin(actor);

  return (
    <div className="gz-root gz-admin-page gz-admin-page--narrow">
      <AdminPageHeader
        kicker="configurações"
        title="Site"
        description={
          <>
            Identidade, menu, página inicial, rodapé, redes sociais e integrações. As páginas como
            Sobre e Apoie ficam em <Link href="/admin/paginas">Páginas</Link>.
          </>
        }
      />
      <SiteSettingsForm initial={settings} updatedAt={updatedAt} mediaMode={getMediaMode()} />
    </div>
  );
}
