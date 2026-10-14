import { randomBytes, scryptSync } from 'node:crypto';

// Mesmo formato de scripts/hash-password.mjs, mas com N=2^14 (o mínimo
// aceito) para os testes rodarem rápido.
export function fastHash(password: string) {
  const N = 2 ** 14;
  const salt = randomBytes(16);
  const key = scryptSync(password.normalize('NFKC'), salt, 64, { N, r: 8, p: 1 });
  return `scrypt:${N}:8:1:${salt.toString('base64url')}:${key.toString('base64url')}`;
}
