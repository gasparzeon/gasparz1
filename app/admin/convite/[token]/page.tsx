import type { Metadata } from 'next';
import { LinkIcon } from 'lucide-react';

import { getTokenUser } from '@/lib/users/service';
import { AuthNotice, AuthShell } from '@/components/admin/auth-shell';
import { AcceptInviteForm } from '@/components/admin/account-forms';

export const metadata: Metadata = {
  title: 'Aceitar convite',
};

export const dynamic = 'force-dynamic';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getTokenUser('invite', token);

  if (!user) {
    return (
      <AuthShell>
        <AuthNotice
          icon={LinkIcon}
          title="Convite inválido"
          description="Este link já foi usado ou expirou. Peça um novo convite a um administrador."
          action="Ir para o login"
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mb-6">
        <h2 className="gz-h3 mb-1 font-mono">Bem-vindo(a), {user.name.split(' ')[0]}</h2>
        <p className="text-sm text-muted-foreground">
          Escolha seu usuário e uma senha para começar a escrever.
        </p>
      </div>
      <AcceptInviteForm token={token} name={user.name} username={user.username} />
    </AuthShell>
  );
}
