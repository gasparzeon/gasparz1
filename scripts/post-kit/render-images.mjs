// Renderiza a capa e os gráficos de um post (HTML → PNG) no Chrome headless.
// Uso: node scripts/post-kit/render-images.mjs <imagens.json> <pasta-de-saída>
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { launchChrome, sleep } from './lib/chrome.mjs';

const [specFile, outDir] = process.argv.slice(2);
if (!specFile || !outDir) {
  console.error('Uso: node scripts/post-kit/render-images.mjs <imagens.json> <pasta-de-saída>');
  process.exit(1);
}

const templates = join(dirname(fileURLToPath(import.meta.url)), 'templates');
const spec = JSON.parse(readFileSync(specFile, 'utf8'));
mkdirSync(outDir, { recursive: true });

// Cores nomeadas para o JSON não precisar repetir gradientes.
const PALETTE = {
  qwen: 'linear-gradient(90deg, #38bdf8, #818cf8)',
  bonsai: 'linear-gradient(90deg, #34d399, #38bdf8)',
  fabricante: 'linear-gradient(90deg, #a78bfa, #f472b6)',
  referencia: 'repeating-linear-gradient(45deg, #3f3f46 0 12px, #27272a 12px 24px)',
  lento: 'linear-gradient(90deg, #f97316, #ef4444)',
};
const paint = (color) => PALETTE[color] ?? color;

const page = await launchChrome();
try {
  if (spec.capa) {
    // 2:1, a proporção em que a página do post exibe a capa.
    await page.viewport(1600, 800);
    await page.goto(pathToFileURL(join(templates, 'capa.html')).href);
    await page.evaluate(`window.COVER = ${JSON.stringify(spec.capa)}; draw();`);
    await sleep(300);
    await page.screenshot(join(outDir, spec.capa.arquivo));
    console.log(`capa → ${spec.capa.arquivo}`);
  }

  for (const chart of spec.graficos ?? []) {
    const data = {
      ...chart,
      rows: chart.rows.map((row) => ({ ...row, color: paint(row.color) })),
      legend: (chart.legend ?? []).map((item) => ({ ...item, color: paint(item.color) })),
    };
    await page.viewport(1600, 900);
    await page.goto(pathToFileURL(join(templates, 'grafico.html')).href);
    await page.evaluate(`window.CHART = ${JSON.stringify(data)}; draw();`);
    await sleep(300);
    // A altura acompanha o número de barras.
    const height = await page.evaluate(
      `Math.ceil(document.getElementById('card').getBoundingClientRect().height)`,
    );
    await page.viewport(1600, height);
    await sleep(200);
    await page.screenshot(join(outDir, chart.arquivo), { x: 0, y: 0, width: 1600, height });
    console.log(`gráfico → ${chart.arquivo}`);
  }
} finally {
  await page.close();
}
