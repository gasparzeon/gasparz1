import type { Metadata } from 'next';
import { LinkIcon } from 'lucide-react';

import { getTokenUser } from '@/lib/users/service';
import { AuthNotice, AuthShell } from '@/components/admin/auth-shell';
import { ResetPasswordForm } from '@/components/admin/account-forms';

export const metadata: Metadata = {
  title: 'Redefinir senha',
};

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getTokenUser('reset', token);

  if (!user) {
    return (
      <AuthShell>
        <AuthNotice
          icon={LinkIcon}
          title="Link inválido"
          description="Este link já foi usado ou expirou. Peça um novo a um administrador."
          action="Ir para o login"
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mb-6">
        <h2 className="gz-h3 mb-1 font-mono">Nova senha</h2>
        <p className="text-sm text-muted-foreground">
          Para a conta <strong className="text-foreground">@{user.username}</strong>.
        </p>
      </div>
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
