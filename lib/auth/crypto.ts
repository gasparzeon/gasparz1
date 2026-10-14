import { createHash, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

import { AuthConfigError } from './config';

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(input: string | Buffer) {
  return createHash('sha256').update(input).digest();
}

// Comparação em tempo constante para strings de qualquer tamanho.
export function safeEqual(a: string, b: string) {
  return timingSafeEqual(sha256(a), sha256(b));
}

// RFC 7636 §4.2: code_challenge = BASE64URL(SHA256(code_verifier))
export function pkceChallenge(verifier: string) {
  return sha256(verifier).toString('base64url');
}

type DerivedKeys = {
  secret: string;
  signing: Uint8Array;
  encryption: Uint8Array;
};

let cachedKeys: DerivedKeys | null = null;

// Chaves independentes para assinatura (JWS) e cifragem (JWE),
// derivadas do AUTH_SECRET via HKDF-SHA256.
export function getKeys(): DerivedKeys {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new AuthConfigError(
      'Defina AUTH_SECRET com pelo menos 32 caracteres aleatórios (ex.: `openssl rand -base64 48`).',
    );
  }

  // eslint-disable-next-line security/detect-possible-timing-attacks -- chave de cache; nenhuma entrada externa é comparada aqui
  if (cachedKeys?.secret === secret) return cachedKeys;

  const derive = (info: string) =>
    new Uint8Array(hkdfSync('sha256', secret, 'gaspar-labs/auth/v1', info, 32));

  cachedKeys = {
    secret,
    signing: derive('jws:HS256'),
    encryption: derive('jwe:A256GCM'),
  };

  return cachedKeys;
}
