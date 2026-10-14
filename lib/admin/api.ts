import 'server-only';

import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';

import { AuthConfigError } from '@/lib/auth/config';
import { canAccessPanel, type Actor } from '@/lib/auth/permissions';
import {
  actorOf,
  authenticateRequest,
  isSameOriginRequest,
  type AdminSession,
} from '@/lib/auth/session';
import { MediaError } from '@/lib/cms/media';
import { PostError } from '@/lib/cms/posts';
import { DatabaseConfigError } from '@/lib/db';
import { PageError } from '@/lib/site/pages';
import { SiteError } from '@/lib/site/service';
import { UserError } from '@/lib/users/service';

type Scope = 'posts:write' | 'media:write';

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export function noContent() {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    return json(
      {
        error: 'validation',
        message: issue
          ? `${issue.path.length ? `${issue.path.join('.')}: ` : ''}${issue.message}`
          : 'Dados inválidos.',
        issues: error.flatten().fieldErrors,
      },
      400,
    );
  }
  if (
    error instanceof PostError ||
    error instanceof UserError ||
    error instanceof SiteError ||
    error instanceof PageError
  ) {
    return json({ error: error.code ?? 'error', message: error.message }, error.status);
  }
  if (error instanceof MediaError) {
    return json({ error: 'media', message: error.message }, error.status);
  }
  if (error instanceof AuthConfigError || error instanceof DatabaseConfigError) {
    return json({ error: 'config', message: error.message }, 503);
  }
  // Pelo nome também: o SyntaxError de request.json() pode vir de outro
  // realm (ex.: o fetch nativo dentro do Jest), e aí o instanceof falha.
  if (error instanceof SyntaxError || (error as Error | null)?.name === 'SyntaxError') {
    return json({ error: 'bad_request', message: 'JSON inválido.' }, 400);
  }

  console.error('[admin] erro inesperado:', error);
  return json({ error: 'internal', message: 'Erro inesperado no servidor.' }, 500);
}

// Toda rota de /api/admin passa por aqui: autenticação (cookie ou Bearer),
// usuário ativo, escopo, proteção CSRF e respostas de erro padronizadas.
// A autorização fina (quem pode o quê) fica nos serviços.
//
// Leitores (conta do site) não entram no painel: só as rotas do próprio
// perfil aceitam o papel com `allowReader`.
export function adminRoute<Context>(
  scope: Scope,
  handler: (
    request: NextRequest,
    context: Context,
    auth: { session: AdminSession; actor: Actor },
  ) => Promise<Response>,
  opts: { allowReader?: boolean } = {},
) {
  return async (request: NextRequest, context: Context) => {
    try {
      const { session, viaCookie } = await authenticateRequest(request);

      if (!session) {
        return json({ error: 'unauthorized', message: 'Sessão expirada.' }, 401);
      }
      if (!opts.allowReader && !canAccessPanel(session.user.role)) {
        return json({ error: 'forbidden', message: 'Só quem escreve acessa o painel.' }, 403);
      }
      if (!session.scope.split(' ').includes(scope)) {
        return json({ error: 'insufficient_scope', message: 'Permissão insuficiente.' }, 403);
      }
      if (viaCookie && request.method !== 'GET' && !isSameOriginRequest(request)) {
        return json({ error: 'forbidden', message: 'Origem não permitida.' }, 403);
      }

      return await handler(request, context, { session, actor: actorOf(session) });
    } catch (error) {
      return errorResponse(error);
    }
  };
}
