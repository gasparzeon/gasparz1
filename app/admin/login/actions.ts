'use server';

import { headers } from 'next/headers';

import { REQUEST_PATH } from '@/lib/auth/config';
import { buildRedirect, issueAuthorizationCode, validateAuthorizeRequest } from '@/lib/auth/oauth';
import { consumeLoginAttempt, recordLoginFailure, resetLoginFailures } from '@/lib/auth/rate-limit';
import { setRequestTicket } from '@/lib/auth/request-ticket';
import { getClientIp, getRequestOrigin } from '@/lib/auth/session';
import { verifyLogin } from '@/lib/users/service';

export type LoginState = {
  error?: string;
  retryAfter?: number;
  redirectTo?: string;
};

const OAUTH_FIELDS = [
  'response_type',
  'client_id',
  'redirect_uri',
  'scope',
  'state',
  'code_challenge',
  'code_challenge_method',
] as const;

const INVALID_CREDENTIALS = 'Usuário ou senha inválidos.';

// Etapa de autenticação do endpoint de autorização. Em caso de sucesso
// devolve a URL de redirect com o code; o navegador segue com navegação
// completa (não via router) para que o callback rode uma única vez.
export async function authorize(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const h = await headers();

  const oauthParams = Object.fromEntries(
    OAUTH_FIELDS.map((field) => {
      const value = formData.get(field);
      return [field, typeof value === 'string' ? value : undefined];
    }),
  );

  const validation = validateAuthorizeRequest(oauthParams, getRequestOrigin(h));
  if (!validation.ok) {
    return { error: 'Sessão de login inválida. Recarregue a página.' };
  }

  const username = String(formData.get('username') ?? '')
    .trim()
    .slice(0, 128);
  const password = String(formData.get('password') ?? '').slice(0, 1024);

  if (!username || !password) {
    return { error: 'Informe usuário e senha.' };
  }

  const ip = getClientIp(h);

  try {
    const limit = await consumeLoginAttempt(ip, username);
    if (!limit.allowed) {
      return {
        error: 'Muitas tentativas. Aguarde para tentar novamente.',
        retryAfter: limit.retryAfter,
      };
    }

    const result = await verifyLogin(username, password);

    if (!result.ok) {
      if (result.reason === 'invalid') {
        await recordLoginFailure(ip, username);
        return { error: INVALID_CREDENTIALS };
      }
      // Senha correta, mas a conta não pode entrar no painel.
      await resetLoginFailures(ip, username);
      // Ainda não aprovada: sem sessão, só acompanha o próprio pedido.
      if (result.reason === 'pending' || result.reason === 'rejected') {
        await setRequestTicket(result.userId);
        return { redirectTo: REQUEST_PATH };
      }
      return { error: 'Sua conta está suspensa. Fale com um administrador.' };
    }

    await resetLoginFailures(ip, username);

    const code = await issueAuthorizationCode(validation.params, result.user.id);

    return {
      redirectTo: buildRedirect(validation.params.redirectUri, {
        code,
        state: validation.params.state,
      }),
    };
  } catch (error) {
    console.error('[auth] falha no login:', error);
    return { error: 'Não foi possível entrar agora. Tente novamente.' };
  }
}
