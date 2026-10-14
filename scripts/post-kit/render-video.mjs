// Transforma um streaming gravado (capture-stream.mjs) num MP4 que reproduz a
// resposta no tempo real em que cada pedaço chegou: o Chrome desenha um quadro
// por instante e o ffmpeg junta tudo em H.264.
//
// Uso: node scripts/post-kit/render-video.mjs <stream.json> <saida.mp4> "<título da janela>" [fps]
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { launchChrome } from './lib/chrome.mjs';

const [streamFile, out, title, fpsArg] = process.argv.slice(2);
if (!streamFile || !out || !title) {
  console.error(
    'Uso: node scripts/post-kit/render-video.mjs <stream.json> <saida.mp4> "<título>" [fps]',
  );
  process.exit(1);
}

const FPS = Number(fpsArg ?? 15);
const HOLD = 2.5; // segundos parados no fim, com a resposta completa
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const template = join(dirname(fileURLToPath(import.meta.url)), 'templates', 'terminal.html');

const stream = JSON.parse(readFileSync(streamFile, 'utf8'));
const done = stream.events.at(-1).t;
const data = { title, prompt: stream.prompt, events: stream.events, done };

const frames = mkdtempSync(join(tmpdir(), 'post-kit-frames-'));
mkdirSync(frames, { recursive: true });
const total = Math.ceil((done + HOLD) * FPS);

const page = await launchChrome();
try {
  await page.viewport(1280, 720);
  await page.goto(pathToFileURL(template).href);
  await page.evaluate(`window.DATA = ${JSON.stringify(data)}`);
  for (let frame = 0; frame < total; frame++) {
    await page.evaluate(`render(${frame / FPS})`);
    await page.screenshot(join(frames, `f${String(frame).padStart(5, '0')}.png`));
  }
} finally {
  await page.close();
}

// yuv420p + faststart: toca em qualquer navegador e começa antes de baixar tudo.
execFileSync(FFMPEG, [
  '-y',
  '-loglevel',
  'error',
  '-framerate',
  String(FPS),
  '-i',
  join(frames, 'f%05d.png'),
  '-c:v',
  'libx264',
  '-pix_fmt',
  'yuv420p',
  '-crf',
  '20',
  '-preset',
  'slow',
  '-movflags',
  '+faststart',
  out,
]);
rmSync(frames, { recursive: true, force: true });
console.log(`vídeo → ${out} (${total} quadros, ${(total / FPS).toFixed(1)} s)`);
