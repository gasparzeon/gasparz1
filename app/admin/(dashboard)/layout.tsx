import { requireAdminPage } from '@/lib/auth/session';
import { SessionKeepAlive } from '@/components/admin/session-keep-alive';
import { TooltipProvider } from '@/components/ui/tooltip';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminPage();

  return (
    <TooltipProvider delayDuration={300}>
      <SessionKeepAlive expiresAt={session.expiresAt} />
      {children}
    </TooltipProvider>
  );
}
