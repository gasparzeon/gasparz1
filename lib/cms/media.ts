import 'server-only';

import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { del, head } from '@vercel/blob';
import { desc, eq } from 'drizzle-orm';

import {
  extensionFor,
  maxBytesFor,
  mediaKindOf,
  safeBaseName,
  uploadFolder,
  formatBytes,
  type MediaItem,
  type MediaMode,
} from './media-types';
import { canEditAllPosts, type Actor } from '@/lib/auth/permissions';
import { getDb } from '@/lib/db';
import { media, users } from '@/lib/db/schema';

export class MediaError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 413 | 415 | 500 | 503 = 400,
  ) {
    super(message);
    this.name = 'MediaError';
  }
}

// Onde os uploads do modo local ficam no disco. Padrão: public/uploads.
// Num servidor próprio, UPLOADS_DIR aponta para um volume persistente.
// Fora do file tracing: a função não precisa empacotar public/.
export function uploadsDir() {
  const custom = process.env.UPLOADS_DIR?.trim();
  return custom
    ? path.resolve(/*turbopackIgnore: true*/ process.cwd(), custom)
    : path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'uploads');
}

const SEGMENT_RE = /^[a-z0-9][a-z0-9._-]*$/i;

// Caminho no disco para /uploads/<segmentos>, ou null se sair da pasta de
// uploads ou tiver qualquer segmento estranho ("..", vazio, codificado…).
export function resolveUploadPath(segments: string[]) {
  if (
    segments.length === 0 ||
    segments.some((part) => !SEGMENT_RE.test(part) || part.includes('..'))
  ) {
    return null;
  }
  const root = uploadsDir();
  const file = path.join(root, ...segments);
  return file.startsWith(root + path.sep) ? file : null;
}

// blob:     Vercel Blob (produção; upload direto do navegador, sem limite de 4,5 MB)
// local:    public/uploads (desenvolvimento)
// disabled: Vercel sem Blob (disco somente leitura): só mídia por URL
export function getMediaMode(): MediaMode {
  if (process.env.BLOB_READ_WRITE_TOKEN) return 'blob';
  return process.env.VERCEL ? 'disabled' : 'local';
}

const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1']);

// Confere a assinatura binária (magic bytes) em vez de confiar no
// Content-Type enviado pelo navegador.
function sniff(head: Buffer): string | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return 'image/jpeg';
  }
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (/^GIF8[79]a/.test(head.toString('latin1', 0, 6))) return 'image/gif';
  if (head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  if (head.toString('latin1', 4, 8) === 'ftyp') {
    const brand = head.toString('latin1', 8, 12);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (HEIF_BRANDS.has(brand)) return null;
    return 'video/mp4';
  }
  if (head.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'video/webm';
  return null;
}

export async function saveLocalUpload(
  body: ReadableStream<Uint8Array> | null,
  contentType: string,
  fileName: string,
  declaredSize: number,
  uploadedBy: string,
): Promise<MediaItem> {
  const kind = mediaKindOf(contentType);
  const extension = extensionFor(contentType);
  if (!kind || !extension) {
    throw new MediaError('Formato não suportado. Use JPG, PNG, WebP, GIF, AVIF, MP4 ou WebM.', 415);
  }

  const max = maxBytesFor(kind);
  if (declaredSize > max) {
    throw new MediaError(`Arquivo maior que o limite de ${formatBytes(max)}.`, 413);
  }
  if (!body) throw new MediaError('Arquivo vazio.');

  const folder = uploadFolder();
  const name = `${safeBaseName(fileName)}-${randomBytes(4).toString('hex')}.${extension}`;
  // folder = "uploads/AAAA/MM"; no disco, fica dentro de uploadsDir().
  const dir = path.join(uploadsDir(), folder.slice('uploads/'.length));
  const target = path.join(dir, name);
  const temp = `${target}.part`;

  let size = 0;
  let head = Buffer.alloc(0);

  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- diretório montado de uploadFolder() (data), dentro de public/uploads
    await fs.mkdir(dir, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- nome gerado no servidor (slug + bytes aleatórios), dentro de public/uploads
    const handle = await fs.open(temp, 'wx');
    const reader = body.getReader();

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        size += value.byteLength;
        if (size > max) {
          await reader.cancel();
          throw new MediaError(`Arquivo maior que o limite de ${formatBytes(max)}.`, 413);
        }
        if (head.length < 16) {
          head = Buffer.concat([head, Buffer.from(value.subarray(0, 16 - head.length))]);
        }
        await handle.write(value);
      }
    } finally {
      await handle.close();
    }

    if (size === 0) throw new MediaError('Arquivo vazio.');
    if (sniff(head) !== contentType) {
      throw new MediaError('O conteúdo do arquivo não corresponde ao formato informado.', 415);
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- nome gerado no servidor (slug + bytes aleatórios), dentro de public/uploads
    await fs.rename(temp, target);
  } catch (error) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- nome gerado no servidor (slug + bytes aleatórios), dentro de public/uploads
    await fs.unlink(temp).catch(() => {});
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === 'EROFS' || code === 'EACCES') {
      throw new MediaError(
        'Sistema de arquivos somente leitura. Configure o Vercel Blob (BLOB_READ_WRITE_TOKEN) para enviar mídia em produção.',
        503,
      );
    }
    throw error;
  }

  return record(
    { url: `/${folder}/${name}`, pathname: `${folder}/${name}`, kind, size },
    uploadedBy,
  );
}

async function record(
  item: Pick<MediaItem, 'url' | 'pathname' | 'kind' | 'size'>,
  uploadedBy: string,
): Promise<MediaItem> {
  const db = await getDb();
  const [row] = await db
    .insert(media)
    .values({ ...item, uploadedBy })
    .onConflictDoNothing({ target: media.url })
    .returning({ createdAt: media.createdAt });

  return {
    ...item,
    uploadedAt: (row?.createdAt ?? new Date()).toISOString(),
    uploadedBy: { id: uploadedBy, name: '' },
  };
}

function blobPath(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.blob.vercel-storage.com')) {
    return null;
  }
  const pathname = decodeURIComponent(parsed.pathname.slice(1));
  return pathname.startsWith('uploads/') ? pathname : null;
}

// Depois do upload direto ao Blob, o navegador registra o arquivo. O
// servidor confere no próprio Blob o tipo e o tamanho reais.
export async function registerBlobUpload(url: string, uploadedBy: string): Promise<MediaItem> {
  if (getMediaMode() !== 'blob') throw new MediaError('Vercel Blob não está configurado.', 503);

  const pathname = blobPath(url);
  if (!pathname) throw new MediaError('Esse arquivo não pertence à biblioteca de mídia.');

  const info = await head(url).catch(() => null);
  const kind = info ? mediaKindOf(info.contentType) : null;
  if (!info || !kind) throw new MediaError('Arquivo não encontrado no Blob.', 404);

  return record({ url: info.url, pathname, kind, size: info.size }, uploadedBy);
}

export async function listMedia(): Promise<MediaItem[]> {
  const db = await getDb();
  const rows = await db
    .select({
      url: media.url,
      pathname: media.pathname,
      kind: media.kind,
      size: media.size,
      createdAt: media.createdAt,
      uploaderId: media.uploadedBy,
      uploaderName: users.name,
    })
    .from(media)
    .leftJoin(users, eq(users.id, media.uploadedBy))
    .orderBy(desc(media.createdAt))
    .limit(1000);

  return rows.map((row) => ({
    url: row.url,
    pathname: row.pathname,
    kind: row.kind,
    size: row.size,
    uploadedAt: row.createdAt.toISOString(),
    uploadedBy: row.uploaderId ? { id: row.uploaderId, name: row.uploaderName ?? '' } : null,
  }));
}

// Quem enviou pode apagar; editores e acima apagam qualquer arquivo.
export async function deleteMedia(actor: Actor, url: string) {
  const db = await getDb();
  const [row] = await db
    .select({ uploadedBy: media.uploadedBy })
    .from(media)
    .where(eq(media.url, url))
    .limit(1);

  if (!row) throw new MediaError('Arquivo não encontrado na biblioteca.', 404);
  if (row.uploadedBy !== actor.id && !canEditAllPosts(actor.role)) {
    throw new MediaError('Você só pode remover arquivos que enviou.', 403);
  }

  if (blobPath(url)) {
    await del(url);
  } else {
    if (!/^\/uploads\/[a-z0-9/_.-]+$/i.test(url) || url.includes('..')) {
      throw new MediaError('Esse arquivo não pertence à biblioteca de mídia.');
    }
    const file = resolveUploadPath(url.slice('/uploads/'.length).split('/'));
    if (!file) throw new MediaError('Caminho inválido.');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- URL validada por regex e verificada dentro de UPLOADS_DIR acima
    await fs.unlink(file).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }

  await db.delete(media).where(eq(media.url, url));
}
