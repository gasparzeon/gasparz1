import type { Metadata } from 'next';
import { CheckCircle2, Clock, LogIn, XCircle } from 'lucide-react';

import { readRequestTicket } from '@/lib/auth/request-ticket';
import { roleInfo, type Role } from '@/lib/auth/permissions';
import { formatDate } from '@/lib/format';
import { getAccessRequest, getSignupEnabled } from '@/lib/users/service';
import { AuthNotice, AuthShell } from '@/components/admin/auth-shell';
import { RequestNoteForm } from '@/components/admin/request-forms';
import { leaveRequestAction } from './actions';

export const metadata: Metadata = {
  title: 'Seu pedido de acesso',
};

export const dynamic = 'force-dynamic';

// O que um administrador pode liberar para quem chega pelo cadastro.
const GRANTABLE: Role[] = ['contributor', 'author', 'editor'];

export default async function AccessRequestPage() {
  const userId = await readRequestTicket();
  const request = userId ? await getAccessRequest(userId) : null;

  if (!request || (request.status !== 'pending' && request.status !== 'rejected')) {
    if (request?.status === 'active') {
      const role = roleInfo(request.role);
      return (
        <AuthShell>
          <AuthNotice
            icon={CheckCircle2}
            title="Pedido aprovado"
            description={`Você entra como ${role.label.toLowerCase()}: ${role.description.charAt(0).toLowerCase()}${role.description.slice(1)}`}
            action="Entrar no painel"
          />
        </AuthShell>
      );
    }

    return (
      <AuthShell>
        <AuthNotice
          icon={LogIn}
          title="Entre para ver seu pedido"
          description="Por segurança, esta página fica aberta por pouco tempo depois do login."
        />
      </AuthShell>
    );
  }

  const rejected = request.status === 'rejected';
  const signupOpen = rejected ? await getSignupEnabled() : true;

  return (
    <AuthShell>
      <div className="mb-5">
        <span
          className={
            rejected
              ? 'mb-3 inline-flex items-center gap-1.5 rounded-sm border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs text-destructive'
              : 'mb-3 inline-flex items-center gap-1.5 rounded-sm border border-sky-500/30 bg-sky-500/10 px-2.5 py-0.5 text-xs text-sky-700 dark:text-sky-300'
          }
        >
          {rejected ? <XCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
          {rejected ? 'Recusado' : 'Em análise'}
        </span>
        <h2 className="gz-h3 mb-1 font-mono">Olá, {request.name.split(' ')[0]}</h2>
        <p className="text-sm text-muted-foreground">
          @{request.username} · pedido enviado em {formatDate(request.requestedAt)}
        </p>
      </div>

      {rejected ? (
        <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
          {request.reviewedBy ? `@${request.reviewedBy}` : 'Um administrador'} recusou o pedido
          {request.reviewedAt && ` em ${formatDate(request.reviewedAt)}`}.{' '}
          {signupOpen
            ? 'Se quiser, conte mais sobre o que pretende escrever e peça de novo.'
            : 'Os pedidos estão fechados no momento.'}
        </p>
      ) : (
        <div className="mb-5 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            Sua conta existe, mas ainda não escreve nem publica nada. Um administrador vai revisar o
            pedido e escolher o que você poderá fazer:
          </p>
          <ul className="space-y-1.5 rounded-lg border border-border/60 bg-secondary/30 p-3 text-xs">
            {GRANTABLE.map((role) => (
              <li key={role}>
                <span className="font-medium text-foreground">{roleInfo(role).label}</span>
                {' — '}
                {roleInfo(role).description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(!rejected || signupOpen) && (
        <RequestNoteForm key={request.status} mode={request.status} note={request.note} />
      )}

      <form action={leaveRequestAction} className="mt-6 border-t border-border/60 pt-5 text-center">
        <button
          type="submit"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Sair
        </button>
      </form>
    </AuthShell>
  );
}
