#!/usr/bin/env node
// Gera ADMIN_PASSWORD_HASH (scrypt) e um AUTH_SECRET aleatório.
//
//   pnpm admin:hash                 # pergunta a senha (sem eco)
//   ADMIN_PASSWORD=... pnpm admin:hash   # não interativo

import { randomBytes, scrypt } from 'node:crypto';
import { createInterface } from 'node:readline';

// Parâmetros recomendados pela OWASP para scrypt. Mantenha em sincronia
// com lib/auth/password.ts.
const N = 2 ** 17;
const r = 8;
const p = 1;
const KEY_LENGTH = 64;
const MIN_LENGTH = 12;

function ask(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = false;
    rl._writeToOutput = (text) => {
      if (!rl.stdoutMuted || text.includes(question)) rl.output.write(text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    rl.stdoutMuted = true;
  });
}

function hash(password) {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      KEY_LENGTH,
      { N, r, p, maxmem: 256 * N * r * p },
      (error, key) => {
        if (error) reject(error);
        else
          resolve(
            `scrypt:${N}:${r}:${p}:${salt.toString('base64url')}:${key.toString('base64url')}`,
          );
      },
    );
  });
}

async function main() {
  let password = process.env.ADMIN_PASSWORD;

  if (!password) {
    if (!process.stdin.isTTY) {
      console.error('Rode em um terminal interativo ou defina ADMIN_PASSWORD.');
      process.exit(1);
    }
    password = await ask('Nova senha do admin: ');
    const confirmation = await ask('Repita a senha: ');
    if (password !== confirmation) {
      console.error('As senhas não conferem.');
      process.exit(1);
    }
  }

  if (password.length < MIN_LENGTH) {
    console.error(`Use pelo menos ${MIN_LENGTH} caracteres (uma frase-senha longa é o ideal).`);
    process.exit(1);
  }

  const encoded = await hash(password);

  console.log('\nAdicione ao .env.local (e às variáveis de ambiente da Vercel):\n');
  console.log(`ADMIN_PASSWORD_HASH=${encoded}`);
  if (!process.env.AUTH_SECRET) {
    console.log(`AUTH_SECRET=${randomBytes(48).toString('base64url')}`);
  }
  console.log('');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
