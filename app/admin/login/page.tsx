import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AlertTriangle, LogOut, ShieldAlert } from 'lucide-react';

import { AuthConfigError } from '@/lib/auth/config';
import { getKeys } from '@/lib/auth/crypto';
import { DatabaseConfigError } from '@/lib/db';
import { getSignupEnabled, hasOwner } from '@/lib/users/service';
import { AuthNotice, AuthShell } from '@/components/admin/auth-shell';
import { buildRedirect, issueAuthorizationCode, validateAuthorizeRequest } from '@/lib/auth/oauth';
import { getAdminSession, getServerOrigin } from '@/lib/auth/session';
import { LoginForm } from '@/components/admin/login-form';

export const metadata: Metadata = {
  title: 'Entrar',
};

// Usa searchParams e consulta o banco (hasOwner): nunca pré-renderizar.
export const dynamic = 'force-dynamic';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// O código vem da query string: Map evita colisão com chaves do prototype.
const ERROR_MESSAGES = new Map<string, string>([
  ['config', 'O painel ainda não foi configurado no servidor.'],
  ['state', 'A sessão de login expirou ou foi aberta em outra aba. Entre novamente.'],
  ['grant', 'Não foi possível concluir o login. Entre novamente.'],
  ['authorize', 'A autorização foi recusada. Entre novamente.'],
  ['denied', 'Acesso negado.'],
]);

async function setupProblem() {
  try {
    getKeys();
    if (!(await hasOwner())) {
      return 'Nenhuma conta ainda. Defina ADMIN_USERNAME e ADMIN_PASSWORD_HASH (gere com `pnpm admin:hash`) para criar a conta do dono.';
    }
    return null;
  } catch (error) {
    if (error instanceof AuthConfigError || error instanceof DatabaseConfigError) {
      return error.message;
    }
    throw error;
  }
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const isAuthorizeRequest = 'client_id' in params || 'response_type' in params;

  const setupError = await setupProblem();
  if (setupError) {
    return (
      <AuthShell>
        <div className="grid gap-4">
          <span className="gz-sec-ico gz-cut" aria-hidden="true">
            <ShieldAlert className="gz-ico text-yellow-700 dark:text-yellow-400" />
          </span>
          <h2 className="gz-h3 font-mono">Configuração pendente</h2>
          <p className="gz-small">{setupError}</p>
        </div>
      </AuthShell>
    );
  }

  if (!isAuthorizeRequest) {
    if (params.logged_out) {
      return (
        <AuthShell>
          <AuthNotice
            icon={LogOut}
            title="Você saiu"
            description="Sua sessão foi encerrada e revogada neste dispositivo."
            action="Entrar novamente"
          />
        </AuthShell>
      );
    }

    const error = typeof params.error === 'string' ? params.error : null;
    if (error) {
      return (
        <AuthShell>
          <AuthNotice
            icon={AlertTriangle}
            title="Login interrompido"
            description={ERROR_MESSAGES.get(error) ?? ERROR_MESSAGES.get('grant')!}
          />
        </AuthShell>
      );
    }

    // Acesso direto: inicia o fluxo OAuth (state + PKCE).
    redirect('/api/auth/login');
  }

  const validation = validateAuthorizeRequest(params, await getServerOrigin());

  if (!validation.ok) {
    if (validation.redirectTo) redirect(validation.redirectTo);
    return (
      <AuthShell>
        <AuthNotice
          icon={AlertTriangle}
          title="Requisição inválida"
          description={validation.description}
        />
      </AuthShell>
    );
  }

  // Já autenticado: emite o code direto, sem pedir a senha de novo.
  const session = await getAdminSession();
  if (session) {
    const code = await issueAuthorizationCode(validation.params, session.user.id);
    redirect(
      buildRedirect(validation.params.redirectUri, {
        code,
        state: validation.params.state,
      }),
    );
  }

  return (
    <AuthShell>
      <LoginForm
        oauth={{
          response_type: 'code',
          client_id: validation.params.clientId,
          redirect_uri: validation.params.redirectUri,
          scope: validation.params.scope,
          state: validation.params.state,
          code_challenge: validation.params.codeChallenge,
          code_challenge_method: 'S256',
        }}
      />
      {(await getSignupEnabled()) && (
        <p className="mt-6 border-t border-border pt-5 text-sm text-muted-foreground">
          Sem conta? <a href="/admin/cadastro">Criar uma</a>
        </p>
      )}
    </AuthShell>
  );
}
