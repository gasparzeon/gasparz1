// Envia a mídia para a biblioteca do painel e cria o post pela API.
// O login é o mesmo fluxo OAuth do navegador; depois usamos o access token
// como Bearer (a API aceita, e assim não depende de cookies).
//
// Uso: ADMIN_USER=... ADMIN_PASS=... node scripts/post-kit/publish.mjs <post.json> <pasta-da-mídia> [--publicar]
//   post.json: { slug, title, excerpt, tags, capa, conteudo, midia: [arquivos] }
//   No Markdown, {{arquivo.ext}} é trocado pela URL que o upload devolver.
//   Sem --publicar, o post fica como rascunho.
import { readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

import { launchChrome, sleep } from './lib/chrome.mjs';

const args = process.argv.slice(2);
const [postFile, mediaDir] = args.filter((arg) => !arg.startsWith('--'));
const BASE = process.env.BLOG_URL ?? 'http://localhost:3000';
const { ADMIN_USER, ADMIN_PASS } = process.env;
if (!postFile || !mediaDir || !ADMIN_USER || !ADMIN_PASS) {
  console.error(
    'Uso: ADMIN_USER=... ADMIN_PASS=... node scripts/post-kit/publish.mjs <post.json> <pasta-da-mídia> [--publicar]',
  );
  process.exit(1);
}

const post = JSON.parse(readFileSync(postFile, 'utf8'));
const markdown = readFileSync(resolve(dirname(postFile), post.conteudo), 'utf8');

// 1. Login pelo formulário do painel e leitura do access token (cookie httpOnly,
//    visível só para o DevTools Protocol).
const page = await launchChrome();
let token;
try {
  await page.send('Network.enable');
  await page.goto(`${BASE}/api/auth/login`, 3000);
  await page.evaluate(`(() => {
    const set = (selector, value) => {
      const input = document.querySelector(selector);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set('input[name="username"]', ${JSON.stringify(ADMIN_USER)});
    set('input[name="password"]', ${JSON.stringify(ADMIN_PASS)});
    document.querySelector('button[type="submit"]').click();
  })()`);
  await sleep(5000);
  const { cookies } = await page.send('Network.getCookies', { urls: [BASE] });
  token = cookies.find((cookie) => cookie.name.endsWith('gaspar.at'))?.value;
} finally {
  await page.close();
}
if (!token) throw new Error('Login falhou: confira ADMIN_USER/ADMIN_PASS e se o blog está no ar.');
const auth = { Authorization: `Bearer ${token}` };

// 2. Upload de cada arquivo (modo local: public/uploads; na Vercel, use o painel).
const TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
};
const urls = {};
for (const name of post.midia) {
  const file = join(mediaDir, name);
  const response = await fetch(`${BASE}/api/admin/media`, {
    method: 'POST',
    headers: {
      ...auth,
      'Content-Type': TYPES[name.split('.').pop().toLowerCase()],
      'Content-Length': String(statSync(file).size),
      'X-File-Name': encodeURIComponent(basename(file)),
    },
    body: readFileSync(file),
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(`Upload de ${name}: ${response.status} ${JSON.stringify(body)}`);
  urls[name] = body.item.url;
  console.log(`enviado ${name} → ${body.item.url}`);
}

// 3. Cria o post com as URLs no lugar dos marcadores.
const status = args.includes('--publicar') ? 'published' : 'draft';
const content = markdown.replace(/\{\{([^}]+)\}\}/g, (_match, name) => {
  if (!urls[name])
    throw new Error(`O Markdown usa {{${name}}}, mas o arquivo não está em "midia".`);
  return urls[name];
});
const response = await fetch(`${BASE}/api/admin/posts`, {
  method: 'POST',
  headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status,
    expectedVersion: null,
    post: {
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      publishedAt: new Date().toISOString().slice(0, 10),
      updatedAt: '',
      tags: post.tags,
      coverImage: post.capa ? urls[post.capa] : '',
      content,
    },
  }),
});
const result = await response.json();
if (!response.ok) throw new Error(`Post: ${response.status} ${JSON.stringify(result)}`);
console.log(
  `post ${status === 'published' ? 'publicado' : 'salvo como rascunho'}: ${BASE}/posts/${result.post.slug}`,
);
