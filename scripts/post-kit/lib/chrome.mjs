// Chrome headless controlado pelo DevTools Protocol, sem dependências.
// Usado para renderizar imagens e vídeos, fazer login no painel e conferir posts.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function launchChrome() {
  const profile = mkdtempSync(join(tmpdir(), 'post-kit-'));
  // Porta 0: o Chrome escolhe uma livre e a anota em DevToolsActivePort.
  const proc = spawn(
    CHROME,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--hide-scrollbars',
      '--autoplay-policy=no-user-gesture-required',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !existsSync(portFile); i++) await sleep(100);
  if (!existsSync(portFile)) {
    proc.kill();
    throw new Error('O Chrome não abriu. Defina CHROME_PATH com o caminho do executável.');
  }
  const [port, path] = readFileSync(portFile, 'utf8').trim().split('\n');

  const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });

  let seq = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    } else {
      listeners.forEach((listener) => listener(message));
    }
  });

  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

  const page = {
    send: (method, params) => send(method, params, sessionId),
    on: (listener) => listeners.push(listener),

    async evaluate(expression) {
      const result = await page.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description ?? 'erro no navegador');
      }
      return result.result?.value;
    },

    async viewport(width, height) {
      await page.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      });
    },

    async goto(url, wait = 2500) {
      await page.send('Page.navigate', { url });
      await sleep(wait);
      await page.evaluate('document.fonts.ready');
    },

    async screenshot(file, clip) {
      const { data } = await page.send('Page.captureScreenshot', {
        format: 'png',
        ...(clip ? { clip: { ...clip, scale: 1 }, captureBeyondViewport: true } : {}),
      });
      if (file) writeFileSync(file, Buffer.from(data, 'base64'));
      return data;
    },

    async close() {
      ws.close();
      proc.kill();
      // Espera o Chrome soltar o perfil antes de apagá-lo.
      await new Promise((resolve) => proc.once('exit', resolve));
      // Processos auxiliares do Chrome ainda podem estar gravando no perfil.
      try {
        rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {
        // Pasta temporária: o sistema limpa depois.
      }
    },
  };

  await page.send('Page.enable');
  await page.send('Runtime.enable');
  return page;
}
