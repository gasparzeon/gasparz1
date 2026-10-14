import { NextResponse, type NextRequest } from 'next/server';

import { COOKIES } from '@/lib/auth/config';
import { verifyAccessToken } from '@/lib/auth/tokens';

// Checagem otimista do painel. A autorização definitiva (incluindo
// revogação de sessão) é refeita em cada página e rota de /api/admin.

const PUBLIC_PATHS = [
  /^\/admin\/login$/,
  /^\/admin\/cadastro$/,
  // Pedido de acesso: protegido pelo próprio ticket, não pela sessão.
  /^\/admin\/pedido$/,
  /^\/admin\/convite\/[^/]+$/,
  /^\/admin\/redefinir-senha\/[^/]+$/,
];

function withAdminHeaders(response: NextResponse) {
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'same-origin');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Páginas públicas do painel: login, cadastro, pedido, convite e senha.
  if (PUBLIC_PATHS.some((re) => re.test(pathname))) {
    const response = withAdminHeaders(NextResponse.next());
    // A URL de autorização carrega state e code_challenge; as de convite e
    // senha carregam o token.
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  }

  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const token = bearer ?? request.cookies.get(COOKIES.access)?.value;

  if (token && (await verifyAccessToken(token))) {
    return withAdminHeaders(NextResponse.next());
  }

  if (pathname.startsWith('/api/')) {
    return withAdminHeaders(
      NextResponse.json(
        { error: 'unauthorized', message: 'Sessão expirada.' },
        {
          status: 401,
          headers: { 'WWW-Authenticate': 'Bearer realm="gaspar-admin"' },
        },
      ),
    );
  }

  // Tenta renovar com o refresh token; se não houver, o refresh manda
  // para o fluxo de login.
  const url = request.nextUrl.clone();
  url.pathname = '/api/auth/refresh';
  url.search = '';
  url.searchParams.set('returnTo', pathname + search);

  return withAdminHeaders(NextResponse.redirect(url));
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
