import type { Metadata } from 'next';
import { Lock } from 'lucide-react';

import { getSignupEnabled } from '@/lib/users/service';
import { AuthNotice, AuthShell } from '@/components/admin/auth-shell';
import { SignupForm } from '@/components/admin/account-forms';

export const metadata: Metadata = {
  title: 'Criar conta',
};

export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  if (!(await getSignupEnabled())) {
    return (
      <AuthShell>
        <AuthNotice
          icon={Lock}
          title="Pedidos fechados"
          description="No momento novas contas só entram por convite de um administrador."
          action="Já tenho conta"
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mb-6">
        <h2 className="gz-h3 mb-1 font-mono">Criar conta</h2>
        <p className="text-sm text-muted-foreground">
          A conta já nasce como leitora: dá para comentar nos posts na hora. Quem escreve entra por
          convite ou promoção de um administrador.
        </p>
      </div>
      <SignupForm />
      <p className="mt-6 border-t border-border/60 pt-5 text-center text-sm text-muted-foreground">
        Já tem conta?{' '}
        <a href="/api/auth/login" className="text-foreground underline underline-offset-4">
          Entrar
        </a>
      </p>
    </AuthShell>
  );
}
