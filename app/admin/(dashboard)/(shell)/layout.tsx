import { canManageUsers } from '@/lib/auth/permissions';
import { requireAdminPage } from '@/lib/auth/session';
import { countPendingUsers } from '@/lib/users/service';
import { AdminHeader } from '@/components/admin/admin-header';

// Redundante com o layout raiz do /admin, mas deixa explícito que o
// shell nunca é pré-renderizado.
export const dynamic = 'force-dynamic';

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdminPage();
  const pendingUsers = canManageUsers(user.role) ? await countPendingUsers() : 0;

  return (
    <>
      <AdminHeader user={user} pendingUsers={pendingUsers} />
      <main id="painel" tabIndex={-1} className="outline-none">
        {children}
      </main>
    </>
  );
}
