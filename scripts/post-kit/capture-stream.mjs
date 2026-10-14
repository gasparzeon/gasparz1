// Grava um streaming real do LM Studio com o instante de cada pedaço de texto.
// O resultado alimenta render-video.mjs, que reproduz a resposta em tempo real.
//
// Uso: node scripts/post-kit/capture-stream.mjs <modelo> <saida.json> "<pergunta>" [--com-raciocinio]
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const [model, out, prompt] = args.filter((arg) => !arg.startsWith('--'));
if (!model || !out || !prompt) {
  console.error(
    'Uso: node scripts/post-kit/capture-stream.mjs <modelo> <saida.json> "<pergunta>" [--com-raciocinio]',
  );
  process.exit(1);
}

const started = performance.now();
const response = await fetch(
  `${process.env.LMSTUDIO_URL ?? 'http://localhost:1234'}/v1/chat/completions`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2500,
      temperature: 0.7,
      top_p: 0.8,
      stream: true,
      stream_options: { include_usage: true },
      ...(args.includes('--com-raciocinio') ? {} : { reasoning_effort: 'none' }),
    }),
  },
);
if (!response.ok) throw new Error(`LM Studio: ${response.status} ${await response.text()}`);

// Server-Sent Events: uma linha "data: {...}" por pedaço.
const events = [];
let usage = null;
let buffer = '';
const decoder = new TextDecoder();
for await (const chunk of response.body) {
  buffer += decoder.decode(chunk, { stream: true });
  let index;
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line.startsWith('data:') || line === 'data: [DONE]') continue;
    const data = JSON.parse(line.slice(5));
    if (data.usage) usage = data.usage;
    const delta = data.choices?.[0]?.delta ?? {};
    const t = (performance.now() - started) / 1000;
    const reasoning = delta.reasoning_content ?? delta.reasoning;
    if (reasoning) events.push({ t, kind: 'reasoning', text: reasoning });
    if (delta.content) events.push({ t, kind: 'content', text: delta.content });
  }
}

writeFileSync(out, JSON.stringify({ model, prompt, usage, events }, null, 2));
console.log(
  `${events.length} pedaços em ${(events.at(-1)?.t ?? 0).toFixed(1)} s | ${usage?.completion_tokens ?? '?'} tokens → ${out}`,
);
