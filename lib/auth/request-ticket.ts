import 'server-only';

import { cookies } from 'next/headers';

import { COOKIES, REQUEST_PATH, REQUEST_TICKET_TTL, isProduction } from './config';
import { seal, unseal } from './tokens';

// Quem criou a conta mas ainda não foi aprovado não recebe sessão OAuth:
// nenhuma rota do painel aceita essa pessoa. Depois da senha certa ela ganha
// só este ticket, que abre exclusivamente a página do próprio pedido.

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict' as const,
  path: REQUEST_PATH,
  maxAge,
});

// Para Server Actions (que podem gravar cookies).
export async function setRequestTicket(userId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + REQUEST_TICKET_TTL;
  const ticket = await seal('request', { sub: userId }, expiresAt);
  const store = await cookies();
  store.set(COOKIES.request, ticket, cookieOptions(REQUEST_TICKET_TTL));
}

export async function readRequestTicket(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(COOKIES.request)?.value;
  if (!value) return null;
  const payload = await unseal<{ sub: string }>('request', value);
  return typeof payload?.sub === 'string' ? payload.sub : null;
}

export async function clearRequestTicket() {
  const store = await cookies();
  store.set(COOKIES.request, '', cookieOptions(0));
}
