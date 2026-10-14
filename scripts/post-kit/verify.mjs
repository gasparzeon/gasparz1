// Abre um post no Chrome headless e confere se imagens, vídeos e o player do
// YouTube carregaram, além de erros no console. Salva uma captura do topo.
//
// Uso: node scripts/post-kit/verify.mjs <url-do-post> [captura.png]
import { launchChrome, sleep } from './lib/chrome.mjs';

const [url, shot] = process.argv.slice(2);
if (!url) {
  console.error('Uso: node scripts/post-kit/verify.mjs <url-do-post> [captura.png]');
  process.exit(1);
}

const errors = [];
const page = await launchChrome();
try {
  page.on((message) => {
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      errors.push(message.params.args.map((arg) => arg.value ?? arg.description ?? '').join(' '));
    }
    if (message.method === 'Runtime.exceptionThrown') {
      errors.push(message.params.exceptionDetails.exception?.description ?? 'exceção');
    }
  });
  await page.viewport(1280, 900);
  await page.goto(url, 4000);
  if (shot) await page.screenshot(shot);

  // Rola a página inteira para disparar o carregamento preguiçoso das imagens.
  await page.evaluate(`(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 150));
    }
  })()`);
  await sleep(2000);

  const report = await page.evaluate(`(async () => ({
    imagens: [...document.querySelectorAll('main img')].map((img) => ({
      src: img.getAttribute('src'),
      ok: img.complete && img.naturalWidth > 0,
    })),
    videos: await Promise.all([...document.querySelectorAll('main video')].map(async (video) => {
      video.muted = true;
      try { await video.play(); await new Promise((r) => setTimeout(r, 1200)); }
      catch (error) { return { src: video.getAttribute('src'), ok: false, erro: String(error) }; }
      return { src: video.getAttribute('src'), ok: video.currentTime > 0 };
    })),
    youtube: document.querySelectorAll('button[aria-label*="YouTube"]').length,
    tabelas: document.querySelectorAll('main table').length,
  }))()`);

  for (const item of [...report.imagens, ...report.videos]) {
    console.log(`${item.ok ? 'ok  ' : 'FALHA'} ${item.src}${item.erro ? ` (${item.erro})` : ''}`);
  }
  console.log(`players do YouTube: ${report.youtube} | tabelas: ${report.tabelas}`);
  console.log(`erros no console: ${errors.length ? `\n  ${errors.join('\n  ')}` : 'nenhum'}`);
  const failed = [...report.imagens, ...report.videos].some((item) => !item.ok) || errors.length;
  process.exitCode = failed ? 1 : 0;
} finally {
  await page.close();
}
