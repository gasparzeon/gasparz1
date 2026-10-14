// Constantes do servidor de autorização OAuth 2.0 embutido no blog.
// Este módulo não lê segredos e pode ser importado pelo proxy.

export const AUTH_ISSUER = 'urn:gaspar-labs:auth';
export const API_AUDIENCE = 'urn:gaspar-labs:admin';

// Único cliente registrado: o próprio painel /admin (padrão BFF).
export const ADMIN_CLIENT_ID = 'gaspar-admin';
export const ADMIN_SCOPE = 'posts:write media:write';

export const AUTHORIZE_PATH = '/admin/login';
export const CALLBACK_PATH = '/api/auth/callback';

// Tempos em segundos
export const ACCESS_TOKEN_TTL = 15 * 60;
export const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60;
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
export const AUTH_CODE_TTL = 60;
export const LOGIN_TX_TTL = 10 * 60;
// Acompanhar o próprio pedido de acesso (conta ainda não aprovada).
export const REQUEST_TICKET_TTL = 2 * 60 * 60;
export const REQUEST_PATH = '/admin/pedido';
// Janela em que um refresh token já trocado ainda é tratado como
// corrida entre abas, e não como roubo de token.
export const REFRESH_REUSE_GRACE = 30;

export const isProduction = process.env.NODE_ENV === 'production';

// Prefixos __Host-/__Secure- exigem HTTPS. O Safari não aceita cookies
// Secure em http://localhost, então em desenvolvimento usamos nomes simples.
export const COOKIES = isProduction
  ? {
      access: '__Host-gaspar.at',
      refresh: '__Secure-gaspar.rt',
      tx: '__Secure-gaspar.tx',
      request: '__Secure-gaspar.req',
      hint: '__Secure-gaspar.on',
    }
  : {
      access: 'gaspar.at',
      refresh: 'gaspar.rt',
      tx: 'gaspar.tx',
      request: 'gaspar.req',
      hint: 'gaspar.on',
    };

export class AuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthConfigError';
  }
}
