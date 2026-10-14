import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { del, head } from '@vercel/blob';

import type { Actor } from '@/lib/auth/permissions';
import { closeDb, createUser, resetDb } from '@/test/helpers/db';

// Vercel Blob é mock; banco e disco são reais (PGlite + diretório temporário).
jest.mock('@vercel/blob', () => ({ del: jest.fn(), head: jest.fn() }));

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

function stream(...chunks: Buffer[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(new Uint8Array(chunk)));
      controller.close();
    },
  });
}

const actor = (user: { id: string; role: string }) => ({ id: user.id, role: user.role }) as Actor;

let root: string;
let media: typeof import('../media');
let author: Awaited<ReturnType<typeof createUser>>;
let other: Awaited<ReturnType<typeof createUser>>;
let editor: Awaited<ReturnType<typeof createUser>>;

const previousUploadsDir = process.env.UPLOADS_DIR;

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'gaspar-media-'));
  // Uploads numa pasta temporária, nunca no public/ do repositório.
  process.env.UPLOADS_DIR = path.join(root, 'public', 'uploads');
  media = require('../media');
});

beforeEach(async () => {
  await resetDb();
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.VERCEL;
  author = await createUser({ username: 'autor' });
  other = await createUser({ username: 'outra' });
  editor = await createUser({ username: 'editora', role: 'editor' });
});

afterAll(async () => {
  await closeDb();
  process.env.UPLOADS_DIR = previousUploadsDir;
  await fs.rm(root, { recursive: true, force: true });
});

describe('getMediaMode', () => {
  it('Blob com token; local fora da Vercel; desativado na Vercel sem Blob', () => {
    expect(media.getMediaMode()).toBe('local');
    process.env.VERCEL = '1';
    expect(media.getMediaMode()).toBe('disabled');
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_x';
    expect(media.getMediaMode()).toBe('blob');
  });
});

describe('upload local', () => {
  it('grava o arquivo e registra quem enviou', async () => {
    const item = await media.saveLocalUpload(
      stream(PNG),
      'image/png',
      'Foto.png',
      PNG.length,
      author.id,
    );

    expect(item.url).toMatch(/^\/uploads\/\d{4}\/\d{2}\/foto-[0-9a-f]{8}\.png$/);
    await expect(fs.readFile(path.join(root, 'public', item.url))).resolves.toEqual(PNG);

    const [listed] = await media.listMedia();
    expect(listed).toMatchObject({ url: item.url, kind: 'image', uploadedBy: { id: author.id } });
  });

  it('recusa conteúdo disfarçado (HTML com extensão de imagem)', async () => {
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    await expect(
      media.saveLocalUpload(stream(html), 'image/png', 'x.png', html.length, author.id),
    ).rejects.toMatchObject({ status: 415 });
    await expect(media.listMedia()).resolves.toEqual([]);
  });
});

describe('remoção', () => {
  it('só quem enviou ou um editor remove o arquivo', async () => {
    const item = await media.saveLocalUpload(
      stream(PNG),
      'image/png',
      'a.png',
      PNG.length,
      author.id,
    );

    await expect(media.deleteMedia(actor(other), item.url)).rejects.toMatchObject({ status: 403 });
    await media.deleteMedia(actor(editor), item.url);

    await expect(media.listMedia()).resolves.toEqual([]);
    await expect(fs.access(path.join(root, 'public', item.url))).rejects.toThrow();
  });

  it('não apaga nada fora da biblioteca', async () => {
    await expect(
      media.deleteMedia(actor(editor), '/uploads/../../package.json'),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('Vercel Blob', () => {
  const url = 'https://abc.public.blob.vercel-storage.com/uploads/2026/10/foto-x1.png';

  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_x';
  });

  it('registra o upload conferindo tipo e tamanho reais no Blob', async () => {
    (head as jest.Mock).mockResolvedValue({ url, contentType: 'image/png', size: 1234 });

    const item = await media.registerBlobUpload(url, author.id);
    expect(item).toMatchObject({ url, pathname: 'uploads/2026/10/foto-x1.png', size: 1234 });
    expect(head).toHaveBeenCalledWith(url);
  });

  it('recusa URLs de fora do store e tipos não suportados', async () => {
    await expect(
      media.registerBlobUpload('https://evil.com/uploads/a.png', author.id),
    ).rejects.toMatchObject({ status: 400 });

    (head as jest.Mock).mockResolvedValue({ url, contentType: 'text/html', size: 10 });
    await expect(media.registerBlobUpload(url, author.id)).rejects.toMatchObject({ status: 404 });
  });

  it('remove do Blob ao apagar', async () => {
    (head as jest.Mock).mockResolvedValue({ url, contentType: 'image/png', size: 1 });
    await media.registerBlobUpload(url, author.id);

    await media.deleteMedia(actor(author), url);
    expect(del).toHaveBeenCalledWith(url);
  });
});
