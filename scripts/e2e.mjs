#!/usr/bin/env node
// Testes de ponta a ponta (Cypress) contra o build de produção.
//
//   pnpm e2e:install            # uma vez: baixa o binário do Cypress
//   pnpm e2e                    # build + servidor + cypress run
//   pnpm e2e -- --spec cypress/e2e/post.cy.ts
//   pnpm e2e:open               # Cypress interativo (mesmo servidor)
//   E2E_SKIP_BUILD=1 pnpm e2e   # reaproveita o último build
//   E2E_BROWSER=electron pnpm e2e   # sem Chrome instalado (padrão: chrome)
//
// O servidor sobe isolado: banco em memória (PGlite) com os posts de
// content/posts e uma conta de teste própria. Não toca no banco local (.data)
// nem na conta de verdade (as variáveis daqui valem mais que as do .env.local).

import { spawn } from 'node:child_process';
import { randomBytes, scrypt } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const NEXT = require.resolve('next/dist/bin/next');
// O Cypress não exporta o caminho do executável: vem do "bin" do package.json.
const CYPRESS = path.join(path.dirname(require.resolve('cypress/package.json')), 'bin/cypress');

const PORT = process.env.E2E_PORT ?? '3123';
const BASE_URL = `http://localhost:${PORT}`;
const ADMIN_USER = 'e2e';
const ADMIN_PASSWORD = 'senha-de-teste-e2e-123';

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const open = args.includes('--open');
const cypressArgs = args.filter((arg) => arg !== '--open');

// Mesmo formato de scripts/hash-password.mjs e lib/auth/password.ts.
function hashPassword(password) {
  const N = 2 ** 17;
  const salt = randomBytes(16);
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      64,
      { N, r: 8, p: 1, maxmem: 256 * N * 8 },
      (error, key) =>
        error
          ? reject(error)
          : resolve(`scrypt:${N}:8:1:${salt.toString('base64url')}:${key.toString('base64url')}`),
    );
  });
}

function run(command, commandArgs, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [command, ...commandArgs], { env, stdio: 'inherit' });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

async function waitForServer(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
    } catch {
      // Ainda subindo.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`O servidor não respondeu em ${BASE_URL}.`);
}

const env = {
  ...process.env,
  NODE_ENV: 'production',
  NEXT_TELEMETRY_DISABLED: '1',
  PGLITE_DIR: 'memory://',
  ADMIN_USERNAME: ADMIN_USER,
  ADMIN_PASSWORD_HASH: await hashPassword(ADMIN_PASSWORD),
  AUTH_SECRET: randomBytes(48).toString('base64url'),
};
delete env.DATABASE_URL;
delete env.DATABASE_URL_UNPOOLED;

if (!process.env.E2E_SKIP_BUILD) {
  const code = await run(NEXT, ['build'], env);
  if (code !== 0) process.exit(code);
}

const server = spawn(process.execPath, [NEXT, 'start', '-p', PORT], { env, stdio: 'inherit' });
const stop = () => server.kill('SIGTERM');
process.on('SIGINT', () => {
  stop();
  process.exit(130);
});

let exitCode = 1;
try {
  await waitForServer();
  await rm('cypress/screenshots', { recursive: true, force: true });
  exitCode = await run(
    CYPRESS,
    [
      open ? 'open' : 'run',
      '--e2e',
      '--config',
      `baseUrl=${BASE_URL}`,
      '--env',
      `adminUser=${ADMIN_USER},adminPassword=${ADMIN_PASSWORD}`,
      ...(open ? [] : ['--browser', process.env.E2E_BROWSER ?? 'chrome']),
      ...cypressArgs,
    ],
    process.env,
  );
} catch (error) {
  console.error(error);
} finally {
  stop();
}
process.exit(exitCode);
