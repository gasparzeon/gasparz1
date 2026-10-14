import type { Metadata } from 'next';

import { ROLES, canManageUsers, roleInfo } from '@/lib/auth/permissions';
import { actorOf, requireAdminPage } from '@/lib/auth/session';
import { getSignupEnabled, listUsers } from '@/lib/users/service';
import { UsersManager } from '@/components/admin/users-manager';
import { AdminPageHeader } from '@/components/admin/page-header';
import { NoPermission } from '@/components/admin/no-permission';

export const metadata: Metadata = {
  title: 'Usuários',
};

export default async function UsersPage() {
  const session = await requireAdminPage('/admin/usuarios');
  const actor = actorOf(session);

  if (!canManageUsers(actor.role)) {
    return <NoPermission message="Só administradores gerenciam usuários." />;
  }

  const [users, signupEnabled] = await Promise.all([listUsers(actor), getSignupEnabled()]);

  return (
    <div className="gz-root gz-admin-page">
      <AdminPageHeader kicker="equipe" title="Usuários" />

      <UsersManager
        actor={actor}
        signupEnabled={signupEnabled}
        users={users.map((user) => ({
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          role: user.role,
          status: user.status,
          requestNote: user.requestNote,
          postCount: user.postCount,
          createdAt: user.createdAt.toISOString(),
          requestedAt: user.requestedAt.toISOString(),
          reviewedAt: user.reviewedAt?.toISOString() ?? null,
          reviewedBy: user.reviewedBy,
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        }))}
      />

      <section className="mt-12" aria-labelledby="papeis-t">
        <p className="gz-kicker">
          <b>~/</b>permissões
        </p>
        <h2 id="papeis-t" className="gz-h2 mb-6">
          Papéis
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((role) => (
            <div key={role} className="gz-panel" style={{ padding: '1.25rem' }}>
              <dt className="gz-h3 mb-1">{roleInfo(role).label}</dt>
              <dd className="gz-small">{roleInfo(role).description}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
