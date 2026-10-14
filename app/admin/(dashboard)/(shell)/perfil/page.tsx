import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { requireAdminPage } from '@/lib/auth/session';
import { getMediaMode } from '@/lib/cms/media';
import { getProfile } from '@/lib/users/service';
import { ProfileForm } from '@/components/admin/profile-form';
import { AdminPageHeader } from '@/components/admin/page-header';

export const metadata: Metadata = {
  title: 'Meu perfil',
};

export default async function ProfilePage() {
  const { user } = await requireAdminPage('/admin/perfil');
  const profile = await getProfile(user.id);
  if (!profile) notFound();

  return (
    <div className="gz-root gz-admin-page">
      <AdminPageHeader kicker="conta" title="Meu perfil" />
      <ProfileForm profile={profile} mediaMode={getMediaMode()} />
    </div>
  );
}
