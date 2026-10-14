// Mede um modelo carregado no LM Studio: velocidade de geração, tempo até o
// primeiro token, leitura do prompt e memória do processo.
//
// Uso: node scripts/post-kit/bench.mjs <modelo> <saida.json> [--sem-raciocinio] [--texto-longo <arquivo>]
//   O modelo precisa estar carregado (lms load <modelo>) e o servidor ligado (lms server start).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const [model, out] = args.filter(
  (arg, index) => !arg.startsWith('--') && args[index - 1] !== '--texto-longo',
);
if (!model || !out) {
  console.error(
    'Uso: node scripts/post-kit/bench.mjs <modelo> <saida.json> [--sem-raciocinio] [--texto-longo <arquivo>]',
  );
  process.exit(1);
}

const API = `${process.env.LMSTUDIO_URL ?? 'http://localhost:1234'}/api/v0/chat/completions`;
// O texto longo mede a leitura do prompt (~1.400 tokens no post de exemplo).
const longText = readFileSync(option('--texto-longo', 'README.md'), 'utf8').slice(0, 6000);
// O LM Studio aceita reasoning_effort "none" para desligar o modo "pensando".
const extra = flag('--sem-raciocinio') ? { reasoning_effort: 'none' } : {};

const TASKS = [
  {
    id: 'explicacao',
    prompt:
      'Explique em 3 parágrafos curtos o que é quantização de modelos de linguagem e por que ela permite rodar LLMs em computadores domésticos.',
  },
  {
    id: 'codigo',
    prompt:
      'Escreva uma função Python que receba uma lista de inteiros e devolva os três maiores valores distintos em ordem decrescente. Inclua docstring e três testes com assert. Responda só com o código.',
  },
  {
    id: 'resumo-longo',
    prompt: `Resuma em português, em 5 tópicos curtos, o texto técnico abaixo.\n\n${longText}`,
  },
];

// Memória física (phys_footprint) do maior processo do LM Studio. Só no macOS.
function memory() {
  try {
    const [pid, rss] = execSync(
      `ps -axo pid=,rss=,comm= | grep -i -E 'lm ?studio|llmster|mlx' | grep -v grep`,
      {
        encoding: 'utf8',
      },
    )
      .trim()
      .split('\n')
      .map((line) => line.trim().split(/\s+/))
      .sort((a, b) => Number(b[1]) - Number(a[1]))[0];
    const footprint = execSync(
      `footprint -p ${pid} 2>/dev/null | grep -i 'phys_footprint:' | head -1`,
      {
        encoding: 'utf8',
      },
    ).match(/([\d.]+)\s*(KB|MB|GB)/i);
    const factor = footprint ? { KB: 1 / 1024, MB: 1, GB: 1024 }[footprint[2].toUpperCase()] : 0;
    return {
      footprintMB: footprint ? Math.round(Number(footprint[1]) * factor) : null,
      rssMB: Math.round(Number(rss) / 1024),
    };
  } catch {
    return {};
  }
}

async function run(task, maxTokens = 2500) {
  const started = Date.now();
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: task.prompt }],
      max_tokens: maxTokens,
      temperature: 0.7,
      top_p: 0.8,
      stream: false,
      ...extra,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`LM Studio: ${response.status} ${JSON.stringify(data)}`);
  const message = data.choices?.[0]?.message ?? {};
  return {
    task: task.id,
    wallSeconds: (Date.now() - started) / 1000,
    stats: data.stats,
    usage: data.usage,
    finish: data.choices?.[0]?.finish_reason,
    answer: message.content,
    memory: memory(),
  };
}

const results = { model, extra, date: new Date().toISOString(), runs: [] };
// Aquecimento descartado: a primeira chamada paga a inicialização.
await run({ id: 'aquecimento', prompt: 'Diga olá.' }, 32);
for (const task of TASKS) {
  const result = await run(task);
  results.runs.push(result);
  const { stats, usage } = result;
  console.log(
    `${task.id}: ${stats?.tokens_per_second?.toFixed(1)} tok/s | 1º token ${stats?.time_to_first_token?.toFixed(2)} s | prompt ${usage?.prompt_tokens} tok | gerados ${usage?.completion_tokens} tok (${usage?.completion_tokens_details?.reasoning_tokens ?? 0} pensando) | ${result.wallSeconds.toFixed(1)} s | fim ${result.finish} | memória ${JSON.stringify(result.memory)}`,
  );
}
writeFileSync(out, JSON.stringify(results, null, 2));
