import { EncryptJWT, SignJWT, jwtDecrypt, jwtVerify } from 'jose';

import { ACCESS_TOKEN_TTL, ADMIN_CLIENT_ID, API_AUDIENCE, AUTH_ISSUER } from './config';
import { getKeys, randomToken } from './crypto';

export type AccessTokenClaims = {
  sub: string;
  sid: string;
  scope: string;
  jti: string;
  iat: number;
  exp: number;
};

// Access token no formato JWT (RFC 9068), assinado com HS256.
export async function signAccessToken(input: { sub: string; sid: string; scope: string }) {
  const token = await new SignJWT({
    sid: input.sid,
    scope: input.scope,
    client_id: ADMIN_CLIENT_ID,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'at+jwt' })
    .setIssuer(AUTH_ISSUER)
    .setAudience(API_AUDIENCE)
    .setSubject(input.sub)
    .setJti(randomToken(16))
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL}s`)
    .sign(getKeys().signing);

  return {
    token,
    expiresAt: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL,
  };
}

// Só valida assinatura e claims. A checagem de revogação fica em session.ts.
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getKeys().signing, {
      issuer: AUTH_ISSUER,
      audience: API_AUDIENCE,
      algorithms: ['HS256'],
      typ: 'at+jwt',
    });

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string' ||
      typeof payload.scope !== 'string' ||
      typeof payload.jti !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }

    return payload as AccessTokenClaims;
  } catch {
    return null;
  }
}

// Valores opacos para o cliente: authorization codes, refresh tokens, a
// transação de login e o acompanhamento do pedido de acesso. Cifrados com
// A256GCM (confidencialidade + integridade).
type SealPurpose = 'code' | 'refresh' | 'tx' | 'request';

export type Sealed<T> = T & { jti: string; iat: number; exp: number };

export async function seal(
  purpose: SealPurpose,
  payload: Record<string, unknown>,
  expiresAt: number,
) {
  return new EncryptJWT({ ...payload, pur: purpose })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuer(AUTH_ISSUER)
    .setJti(randomToken(16))
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .encrypt(getKeys().encryption);
}

export async function unseal<T extends Record<string, unknown>>(
  purpose: SealPurpose,
  token: string,
): Promise<Sealed<T> | null> {
  try {
    const { payload } = await jwtDecrypt(token, getKeys().encryption, {
      issuer: AUTH_ISSUER,
      keyManagementAlgorithms: ['dir'],
      contentEncryptionAlgorithms: ['A256GCM'],
    });

    if (payload.pur !== purpose) return null;
    if (typeof payload.jti !== 'string') return null;

    return payload as Sealed<T>;
  } catch {
    return null;
  }
}
