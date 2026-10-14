import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { actorOf, authenticateRequest, isSameOriginRequest } from '@/lib/auth/session';

import { CommentError } from './service';

export function commentErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    return NextResponse.json(
      {
        error: 'validation',
        message: issue
          ? `${issue.path.length ? `${issue.path.join('.')}: ` : ''}${issue.message}`
          : 'Dados inválidos.',
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (error instanceof CommentError) {
    return NextResponse.json(
      { error: error.code ?? 'error', message: error.message },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (error instanceof SyntaxError || (error as Error | null)?.name === 'SyntaxError') {
    return NextResponse.json(
      { error: 'bad_request', message: 'JSON inválido.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  console.error('[comentários] erro inesperado:', error);
  return NextResponse.json(
    { error: 'internal', message: 'Erro inesperado no servidor.' },
    { status: 500, headers: { 'Cache-Control': 'no-store' } },
  );
}

// Sessão ativa (leitor em diante comenta). O GET da lista é público e não usa.
export async function commentSession(request: Request) {
  const { session, viaCookie } = await authenticateRequest(request);
  if (!session) throw new CommentError('Entre para comentar.', 401, 'unauthorized');
  return { session, actor: actorOf(session), viaCookie };
}

// Defesa contra CSRF além do SameSite=Strict (igual ao /api/admin).
export function requireSameOrigin(request: Request, viaCookie: boolean) {
  if (viaCookie && !isSameOriginRequest(request)) {
    throw new CommentError('Origem não permitida.', 403, 'forbidden');
  }
}
