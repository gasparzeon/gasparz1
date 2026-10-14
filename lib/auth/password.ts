import 'server-only';

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

// Formato: scrypt:<N>:<r>:<p>:<salt base64url>:<hash base64url>
// Parâmetros OWASP (N=2^17, r=8, p=1), os mesmos de scripts/hash-password.mjs.
const N = 2 ** 17;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;

export const MIN_PASSWORD_LENGTH = 12;

// Hash de uma senha aleatória descartada: comparar contra ele quando o
// usuário não existe mantém o tempo de resposta igual ao de um login real.
const DUMMY_HASH =
  'scrypt:131072:8:1:a2ZwyjpSYHbsOBwa1z91bQ:45uzWdEYXs16CdUhRNL1KldppI3y2dLYq3inoVx57KiWTUn6oKrTM7rtg6Qh40nYl5ZQ-JwYvOhoItlV1y3pGQ';

function scryptAsync(password: string, salt: Buffer, keyLength: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

function parseHash(encoded: string) {
  const [scheme, n, r, p, salt, hash] = encoded.split(':');
  const cost = Number(n);
  const blockSize = Number(r);
  const parallel = Number(p);

  const valid =
    scheme === 'scrypt' &&
    Number.isInteger(cost) &&
    cost >= 2 ** 14 &&
    cost <= 2 ** 20 &&
    (cost & (cost - 1)) === 0 &&
    Number.isInteger(blockSize) &&
    blockSize >= 1 &&
    blockSize <= 32 &&
    Number.isInteger(parallel) &&
    parallel >= 1 &&
    parallel <= 16 &&
    !!salt &&
    !!hash;

  if (!valid) return null;

  const key = Buffer.from(hash, 'base64url');
  if (key.length < 32 || key.length > 128) return null;

  return { N: cost, r: blockSize, p: parallel, salt: Buffer.from(salt, 'base64url'), key };
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize('NFKC'), salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
    maxmem: 256 * N * R * P,
  });
  return `scrypt:${N}:${R}:${P}:${salt.toString('base64url')}:${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const parsed = parseHash(encoded);
  if (!parsed) return false;

  const derived = await scryptAsync(password.normalize('NFKC'), parsed.salt, parsed.key.length, {
    N: parsed.N,
    r: parsed.r,
    p: parsed.p,
    maxmem: 256 * parsed.N * parsed.r * parsed.p,
  });

  return timingSafeEqual(derived, parsed.key);
}

// Gasta o mesmo tempo de uma verificação real e sempre falha.
export async function burnPasswordCheck(password: string) {
  await verifyPassword(password, DUMMY_HASH);
  return false;
}

export function passwordProblem(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres (uma frase-senha é o ideal).`;
  }
  if (password.length > 1024) return 'Senha longa demais.';
  return null;
}
