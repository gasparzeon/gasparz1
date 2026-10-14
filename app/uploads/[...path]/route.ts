import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

import { resolveUploadPath } from '@/lib/cms/media';
import { contentTypeForExtension } from '@/lib/cms/media-types';

// Serve os arquivos enviados pelo painel no modo local. Em produção, o Next só
// entrega o que já estava em public/ na hora do build: sem esta rota, uma
// imagem enviada com o site no ar respondia 404. Arquivos que existiam no
// build continuam saindo direto de public/.

type Context = { params: Promise<{ path: string[] }> };

const notFound = () => new Response('Não encontrado.', { status: 404 });

// Um único intervalo ("bytes=início-fim", "bytes=início-" ou "bytes=-sufixo").
// O Safari só toca vídeo se o servidor responder a pedidos parciais.
function parseRange(header: string | null, size: number): [number, number] | 'invalid' | null {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match || (!match[1] && !match[2])) return null;

  let start: number;
  let end: number;
  if (!match[1]) {
    start = Math.max(0, size - Number(match[2]));
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  }
  return start > end || start >= size ? 'invalid' : [start, end];
}

async function serve(request: Request, { params }: Context, withBody: boolean) {
  const file = resolveUploadPath((await params).path);
  const type = file ? contentTypeForExtension(path.extname(file)) : null;
  if (!file || !type) return notFound();

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- caminho validado por resolveUploadPath (dentro da pasta de uploads)
  const stat = await fs.stat(file).catch(() => null);
  if (!stat?.isFile()) return notFound();

  const headers = new Headers({
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    // O nome leva um sufixo aleatório: o conteúdo de uma URL nunca muda.
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Last-Modified': stat.mtime.toUTCString(),
    'X-Content-Type-Options': 'nosniff',
  });

  const range = parseRange(request.headers.get('range'), stat.size);
  if (range === 'invalid') {
    headers.set('Content-Range', `bytes */${stat.size}`);
    return new Response(null, { status: 416, headers });
  }

  const [start, end] = range ?? [0, stat.size - 1];
  headers.set('Content-Length', String(end - start + 1));
  if (range) headers.set('Content-Range', `bytes ${start}-${end}/${stat.size}`);

  const body =
    withBody && stat.size > 0
      ? // eslint-disable-next-line security/detect-non-literal-fs-filename -- caminho validado por resolveUploadPath (dentro da pasta de uploads)
        (Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream<Uint8Array>)
      : null;

  return new Response(body, { status: range ? 206 : 200, headers });
}

export function GET(request: Request, context: Context) {
  return serve(request, context, true);
}

export function HEAD(request: Request, context: Context) {
  return serve(request, context, false);
}
