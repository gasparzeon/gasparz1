import path from 'node:path';
import { promises as fs } from 'node:fs';
import { del, head } from '@vercel/blob';

import { getDb } from '@/lib/db';
import { createFakeDb, type FakeDb } from '@/test/helpers/fake-db';

import {
  MediaError,
  deleteMedia,
  getMediaMode,
  listMedia,
  registerBlobUpload,
  resolveUploadPath,
  saveLocalUpload,
} from '../media';

// Unitário: disco, Vercel Blob e banco são mocks. A integração real com o
// Postgres fica em media.db.test.ts.
jest.mock('node:fs', () => {
  return {
    promises: {
      mkdir: jest.fn(async () => undefined),
      open: jest.fn(async () => ({
        write: jest.fn(async () => undefined),
        close: jest.fn(async () => undefined),
      })),
      rename: jest.fn(async () => undefined),
      unlink: jest.fn(async () => undefined),
    },
  };
});
jest.mock('@vercel/blob', () => ({ head: jest.fn(), del: jest.fn() }));
jest.mock('@/lib/db', () => ({ getDb: jest.fn() }));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockHead = head as jest.Mock;
const mockDel = del as jest.Mock;
const UPLOADS = path.join(process.cwd(), 'public', 'uploads');

// Assinaturas binárias reais (magic bytes), completadas até 16 bytes.
const bytes = (...values: number[]) => Uint8Array.from([...values, ...Array(16).fill(0)]);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const ascii = (text: string) =>
  Uint8Array.from([...Buffer.from(text, 'latin1'), ...Array(16).fill(0)]);
const MP4 = ascii('\0\0\0\x18ftypisom');
const HEIC = ascii('\0\0\0\x18ftypheic');
const AVIF = ascii('\0\0\0\x1cftypavif');
const WEBP = ascii('RIFF\0\0\0\0WEBPVP8 ');

function stream(...chunks: Uint8Array[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(chunk));
      controller.close();
    },
  });
}

let fake: FakeDb;

beforeEach(() => {
  fake = createFakeDb();
  (getDb as jest.Mock).mockResolvedValue(fake.db);
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.VERCEL;
  delete process.env.UPLOADS_DIR;
});

describe('pasta de uploads', () => {
  it('usa public/uploads por padrão e UPLOADS_DIR quando definido', async () => {
    expect(resolveUploadPath(['2026', '10', 'a.png'])).toBe(path.join(UPLOADS, '2026/10/a.png'));

    process.env.UPLOADS_DIR = '/srv/gaspar/uploads';
    expect(resolveUploadPath(['2026', '10', 'a.png'])).toBe('/srv/gaspar/uploads/2026/10/a.png');

    fake.queue('insert', [{ createdAt: new Date() }]);
    await saveLocalUpload(stream(PNG), 'image/png', 'a.png', 20, 'u1');
    const [[temp]] = mockFs.open.mock.calls as unknown as [string][];
    expect(temp.startsWith('/srv/gaspar/uploads/')).toBe(true);
  });

  it.each([
    [['..', 'x.png']],
    [['a', '..', '..', 'x.png']],
    [['']],
    [[]],
    [['a b.png']],
    [['.env']],
  ])('recusa caminhos estranhos: %j', (segments) => {
    expect(resolveUploadPath(segments)).toBeNull();
  });
});

describe('getMediaMode', () => {
  it('usa o Blob com token, disco local no desenvolvimento e desliga na Vercel sem Blob', () => {
    expect(getMediaMode()).toBe('local');
    process.env.VERCEL = '1';
    expect(getMediaMode()).toBe('disabled');
    process.env.BLOB_READ_WRITE_TOKEN = 'token';
    expect(getMediaMode()).toBe('blob');
  });
});

describe('saveLocalUpload', () => {
  it('grava num .part, confere a assinatura e só então renomeia e registra', async () => {
    const created = new Date('2026-10-12T10:00:00Z');
    fake.queue('insert', [{ createdAt: created }]);

    const item = await saveLocalUpload(stream(JPEG), 'image/jpeg', 'Foto da Praia.JPG', 20, 'u1');

    expect(item.url).toMatch(/^\/uploads\/\d{4}\/\d{2}\/foto-da-praia-[0-9a-f]{8}\.jpg$/);
    expect(item).toMatchObject({
      kind: 'image',
      size: JPEG.byteLength,
      uploadedAt: created.toISOString(),
    });

    const [[temp, flags]] = mockFs.open.mock.calls as unknown as [string, string][];
    expect(temp.startsWith(UPLOADS)).toBe(true);
    expect(temp.endsWith('.jpg.part')).toBe(true);
    expect(flags).toBe('wx'); // nunca sobrescreve um arquivo existente
    expect(mockFs.rename).toHaveBeenCalledWith(temp, temp.replace(/\.part$/, ''));
    expect(fake.argsOf('insert', 'values')[0][0]).toMatchObject({
      url: item.url,
      uploadedBy: 'u1',
    });
  });

  it.each([
    ['PNG', PNG, 'image/png'],
    ['WebP', WEBP, 'image/webp'],
    ['AVIF', AVIF, 'image/avif'],
    ['MP4', MP4, 'video/mp4'],
  ])('aceita %s com a assinatura certa', async (_label, data, type) => {
    await expect(saveLocalUpload(stream(data), type, 'arquivo', 20, 'u1')).resolves.toMatchObject({
      kind: type.startsWith('video') ? 'video' : 'image',
    });
  });

  it('recusa formatos fora da lista (SVG) antes de tocar no disco', async () => {
    await expect(
      saveLocalUpload(stream(PNG), 'image/svg+xml', 'logo.svg', 20, 'u1'),
    ).rejects.toMatchObject({
      status: 415,
    });
    expect(mockFs.open).not.toHaveBeenCalled();
  });

  it('recusa conteúdo que não bate com o tipo declarado e apaga o arquivo parcial', async () => {
    await expect(saveLocalUpload(stream(PNG), 'image/jpeg', 'falso.jpg', 20, 'u1')).rejects.toThrow(
      /não corresponde/,
    );
    // Foto HEIC do iPhone renomeada para .mp4: o "ftyp" engana, a marca não.
    await expect(
      saveLocalUpload(stream(HEIC), 'video/mp4', 'iphone.mp4', 20, 'u1'),
    ).rejects.toMatchObject({
      status: 415,
    });
    expect(mockFs.unlink).toHaveBeenCalledTimes(2);
    expect(mockFs.rename).not.toHaveBeenCalled();
    expect(fake.count('insert')).toBe(0);
  });

  it('aplica o limite pelo tamanho declarado e também pelo que realmente chega', async () => {
    const limit = 15 * 1024 * 1024;
    await expect(
      saveLocalUpload(stream(JPEG), 'image/jpeg', 'grande.jpg', limit + 1, 'u1'),
    ).rejects.toMatchObject({ status: 413 });

    // Content-Length mentiroso: o corte acontece durante a leitura.
    const big = new Uint8Array(limit);
    await expect(
      saveLocalUpload(stream(JPEG, big), 'image/jpeg', 'mentiroso.jpg', 10, 'u1'),
    ).rejects.toMatchObject({ status: 413 });
    expect(mockFs.unlink).toHaveBeenCalled();
  });

  it('recusa arquivo vazio', async () => {
    await expect(saveLocalUpload(null, 'image/png', 'a.png', 0, 'u1')).rejects.toThrow(/vazio/);
    await expect(saveLocalUpload(stream(), 'image/png', 'a.png', 0, 'u1')).rejects.toThrow(/vazio/);
  });

  it('explica o que fazer quando o disco é somente leitura (Vercel sem Blob)', async () => {
    mockFs.mkdir.mockRejectedValueOnce(Object.assign(new Error('read-only'), { code: 'EROFS' }));
    await expect(
      saveLocalUpload(stream(PNG), 'image/png', 'a.png', 20, 'u1'),
    ).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining('BLOB_READ_WRITE_TOKEN'),
    });
  });
});

describe('registerBlobUpload', () => {
  const blobUrl = 'https://abc.public.blob.vercel-storage.com/uploads/2026/10/foto-x1.webp';

  beforeEach(() => {
    process.env.BLOB_READ_WRITE_TOKEN = 'token';
  });

  it('confere no próprio Blob o tipo e o tamanho reais antes de registrar', async () => {
    mockHead.mockResolvedValue({ url: blobUrl, contentType: 'image/webp', size: 2048 });
    const item = await registerBlobUpload(blobUrl, 'u1');

    expect(mockHead).toHaveBeenCalledWith(blobUrl);
    expect(item).toMatchObject({
      url: blobUrl,
      pathname: 'uploads/2026/10/foto-x1.webp',
      kind: 'image',
      size: 2048,
    });
    expect(fake.argsOf('insert', 'values')[0][0]).toMatchObject({ size: 2048, uploadedBy: 'u1' });
  });

  it.each([
    ['outro domínio', 'https://evil.example/uploads/a.png'],
    ['http', 'http://abc.public.blob.vercel-storage.com/uploads/a.png'],
    ['fora de uploads/', 'https://abc.public.blob.vercel-storage.com/outra/a.png'],
    ['URL inválida', 'nada'],
  ])('recusa %s sem consultar o Blob', async (_label, url) => {
    await expect(registerBlobUpload(url, 'u1')).rejects.toBeInstanceOf(MediaError);
    expect(mockHead).not.toHaveBeenCalled();
  });

  it('dá 404 se o arquivo não existe ou tem tipo não suportado', async () => {
    mockHead.mockRejectedValueOnce(new Error('not found'));
    await expect(registerBlobUpload(blobUrl, 'u1')).rejects.toMatchObject({ status: 404 });

    mockHead.mockResolvedValueOnce({ url: blobUrl, contentType: 'image/svg+xml', size: 10 });
    await expect(registerBlobUpload(blobUrl, 'u1')).rejects.toMatchObject({ status: 404 });
  });

  it('exige o Blob configurado', async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    await expect(registerBlobUpload(blobUrl, 'u1')).rejects.toMatchObject({ status: 503 });
  });
});

describe('listMedia', () => {
  it('converte as linhas e marca arquivos de contas removidas sem autor', async () => {
    const createdAt = new Date('2026-10-01T12:00:00Z');
    fake.queue('select', [
      {
        url: '/uploads/a.png',
        pathname: 'uploads/a.png',
        kind: 'image',
        size: 1,
        createdAt,
        uploaderId: 'u1',
        uploaderName: 'Ana',
      },
      {
        url: '/uploads/b.mp4',
        pathname: 'uploads/b.mp4',
        kind: 'video',
        size: 2,
        createdAt,
        uploaderId: null,
        uploaderName: null,
      },
    ]);

    await expect(listMedia()).resolves.toEqual([
      {
        url: '/uploads/a.png',
        pathname: 'uploads/a.png',
        kind: 'image',
        size: 1,
        uploadedAt: createdAt.toISOString(),
        uploadedBy: { id: 'u1', name: 'Ana' },
      },
      {
        url: '/uploads/b.mp4',
        pathname: 'uploads/b.mp4',
        kind: 'video',
        size: 2,
        uploadedAt: createdAt.toISOString(),
        uploadedBy: null,
      },
    ]);
  });
});

describe('deleteMedia', () => {
  const author = { id: 'u1', role: 'author' as const };
  const editor = { id: 'u2', role: 'editor' as const };

  it('quem enviou apaga o arquivo local e o registro', async () => {
    fake.queue('select', [{ uploadedBy: 'u1' }]);
    await deleteMedia(author, '/uploads/2026/10/foto-ab12.png');

    expect(mockFs.unlink).toHaveBeenCalledWith(path.join(UPLOADS, '2026/10/foto-ab12.png'));
    expect(fake.count('delete')).toBe(1);
  });

  it('autor não apaga arquivo de outra pessoa; editor apaga (inclusive no Blob)', async () => {
    const url = 'https://abc.public.blob.vercel-storage.com/uploads/2026/10/x.png';

    fake.queue('select', [{ uploadedBy: 'outra' }]);
    await expect(deleteMedia(author, url)).rejects.toMatchObject({ status: 403 });
    expect(mockDel).not.toHaveBeenCalled();

    fake.queue('select', [{ uploadedBy: 'outra' }]);
    await deleteMedia(editor, url);
    expect(mockDel).toHaveBeenCalledWith(url);
    expect(mockFs.unlink).not.toHaveBeenCalled();
  });

  it('não sai de public/uploads, mesmo com o registro no banco', async () => {
    for (const url of ['/uploads/../../.env.local', '/etc/passwd', '/uploads/a b.png']) {
      fake.queue('select', [{ uploadedBy: 'u1' }]);
      await expect(deleteMedia(author, url)).rejects.toBeInstanceOf(MediaError);
    }
    expect(mockFs.unlink).not.toHaveBeenCalled();
    expect(fake.count('delete')).toBe(0);
  });

  it('404 para arquivo fora da biblioteca; arquivo já sumido do disco não impede a limpeza', async () => {
    fake.queue('select', []);
    await expect(deleteMedia(author, '/uploads/nada.png')).rejects.toMatchObject({ status: 404 });

    fake.queue('select', [{ uploadedBy: 'u1' }]);
    mockFs.unlink.mockRejectedValueOnce(Object.assign(new Error('gone'), { code: 'ENOENT' }));
    await expect(deleteMedia(author, '/uploads/sumiu.png')).resolves.toBeUndefined();
    expect(fake.count('delete')).toBe(1);
  });
});
