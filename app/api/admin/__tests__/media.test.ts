import { NextRequest } from 'next/server';
import { handleUpload } from '@vercel/blob/client';

import { authenticateRequest, isSameOriginRequest } from '@/lib/auth/session';
import {
  MediaError,
  deleteMedia,
  getMediaMode,
  listMedia,
  registerBlobUpload,
  saveLocalUpload,
} from '@/lib/cms/media';

import { DELETE as remove, GET as list, POST as uploadLocal } from '../media/route';
import { POST as register } from '../media/register/route';
import { POST as token } from '../media/upload/route';

jest.mock('@/lib/auth/session', () => ({
  authenticateRequest: jest.fn(),
  isSameOriginRequest: jest.fn(),
  actorOf: (session: { user: { id: string; role: string } }) => ({
    id: session.user.id,
    role: session.user.role,
  }),
}));
jest.mock('@/lib/cms/media', () => {
  const { StatusError } = jest.requireActual('@/test/helpers/status-error');
  return {
    MediaError: class MediaError extends StatusError {},
    getMediaMode: jest.fn(),
    listMedia: jest.fn(),
    saveLocalUpload: jest.fn(),
    deleteMedia: jest.fn(),
    registerBlobUpload: jest.fn(),
  };
});
jest.mock('@/lib/cms/posts', () => {
  const { StatusError } = jest.requireActual('@/test/helpers/status-error');
  return { PostError: class PostError extends StatusError {} };
});
jest.mock('@/lib/users/service', () => {
  const { StatusError } = jest.requireActual('@/test/helpers/status-error');
  return { UserError: class UserError extends StatusError {} };
});
jest.mock('@/lib/db', () => ({ DatabaseConfigError: class DatabaseConfigError extends Error {} }));
// O SDK do Blob é simulado: chama o onBeforeGenerateToken como o real faria.
jest.mock('@vercel/blob/client', () => ({
  handleUpload: jest.fn(
    async (options: {
      body: { payload: { pathname: string } };
      onBeforeGenerateToken: (pathname: string) => Promise<unknown>;
    }) => ({
      type: 'blob.generate-client-token',
      clientToken: 'token-temporario',
      rules: await options.onBeforeGenerateToken(options.body.payload.pathname),
    }),
  ),
}));

const mockMode = getMediaMode as jest.Mock;
const actor = { id: 'u1', role: 'author' };
const session = {
  user: { ...actor, username: 'ana', name: 'Ana', avatarUrl: '' },
  sid: 's1',
  scope: 'posts:write media:write',
  expiresAt: 0,
};

const url = (path: string) => `http://localhost/api/admin/media${path}`;
async function parse(response: Response) {
  return { status: response.status, body: await response.json().catch(() => null) };
}
const tokenRequest = (pathname: string, type = 'blob.generate-client-token') =>
  new NextRequest(url('/upload'), {
    method: 'POST',
    body: JSON.stringify({
      type,
      payload: { pathname, callbackUrl: '', clientPayload: null, multipart: false },
    }),
  });

beforeEach(() => {
  (authenticateRequest as jest.Mock).mockResolvedValue({ session, viaCookie: true });
  (isSameOriginRequest as jest.Mock).mockReturnValue(true);
  mockMode.mockReturnValue('local');
});

describe('GET /api/admin/media', () => {
  it('devolve o modo de armazenamento e a biblioteca', async () => {
    (listMedia as jest.Mock).mockResolvedValue([{ url: '/uploads/a.png' }]);
    expect(await parse(await list(new NextRequest(url('')), {}))).toEqual({
      status: 200,
      body: { mode: 'local', items: [{ url: '/uploads/a.png' }] },
    });
  });

  it('exige o escopo media:write', async () => {
    (authenticateRequest as jest.Mock).mockResolvedValue({
      session: { ...session, scope: 'posts:write' },
      viaCookie: true,
    });
    expect((await list(new NextRequest(url('')), {})).status).toBe(403);
    expect(listMedia).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/media (upload local)', () => {
  const upload = (headers: Record<string, string>) =>
    new NextRequest(url(''), { method: 'POST', body: new Uint8Array([1, 2, 3]), headers });

  it('repassa o corpo, o tipo sem parâmetros e o nome decodificado', async () => {
    (saveLocalUpload as jest.Mock).mockResolvedValue({ url: '/uploads/2026/10/foto-ab.png' });

    const response = await uploadLocal(
      upload({
        'content-type': 'image/png; charset=binary',
        'x-file-name': encodeURIComponent('Fotografia ção.png'),
      }),
      {},
    );

    expect(await parse(response)).toEqual({
      status: 201,
      body: { item: { url: '/uploads/2026/10/foto-ab.png' } },
    });
    const [body, type, name, , uploadedBy] = (saveLocalUpload as jest.Mock).mock.calls[0];
    expect(body).toBeInstanceOf(ReadableStream);
    expect(type).toBe('image/png');
    expect(name).toBe('Fotografia ção.png');
    expect(uploadedBy).toBe('u1');
  });

  it('nome com codificação inválida vira "arquivo" em vez de quebrar', async () => {
    (saveLocalUpload as jest.Mock).mockResolvedValue({ url: '/uploads/x.png' });
    await uploadLocal(upload({ 'content-type': 'image/png', 'x-file-name': '%E0%A4%A' }), {});
    expect((saveLocalUpload as jest.Mock).mock.calls[0][2]).toBe('arquivo');
  });

  it('fora do modo local, recusa sem tocar no disco', async () => {
    mockMode.mockReturnValue('blob');
    const { status, body } = await parse(
      await uploadLocal(upload({ 'content-type': 'image/png' }), {}),
    );
    expect(status).toBe(400);
    expect(body.error).toBe('media');
    expect(saveLocalUpload).not.toHaveBeenCalled();
  });

  it('traduz os erros do serviço (formato não suportado → 415)', async () => {
    (saveLocalUpload as jest.Mock).mockRejectedValue(new MediaError('Formato não suportado.', 415));
    expect(await parse(await uploadLocal(upload({ 'content-type': 'image/svg+xml' }), {}))).toEqual(
      {
        status: 415,
        body: { error: 'media', message: 'Formato não suportado.' },
      },
    );
  });
});

describe('DELETE /api/admin/media', () => {
  const del = (body: unknown) =>
    new NextRequest(url(''), { method: 'DELETE', body: JSON.stringify(body) });

  it('exige a URL e responde 204 ao remover', async () => {
    expect((await remove(del({}), {})).status).toBe(400);
    expect((await remove(del({ url: 42 }), {})).status).toBe(400);
    expect(deleteMedia).not.toHaveBeenCalled();

    const response = await remove(del({ url: '/uploads/2026/10/a.png' }), {});
    expect(response.status).toBe(204);
    expect(deleteMedia).toHaveBeenCalledWith(actor, '/uploads/2026/10/a.png');
  });

  it('arquivo de outra pessoa → 403 do serviço', async () => {
    (deleteMedia as jest.Mock).mockRejectedValue(
      new MediaError('Você só pode remover arquivos que enviou.', 403),
    );
    expect((await remove(del({ url: '/uploads/b.png' }), {})).status).toBe(403);
  });
});

describe('POST /api/admin/media/upload (token do Vercel Blob)', () => {
  beforeEach(() => mockMode.mockReturnValue('blob'));

  it('libera só o tipo da extensão, com limite de tamanho e validade curta', async () => {
    const before = Date.now();
    const { status, body } = await parse(
      await token(tokenRequest('uploads/2026/10/foto-praia.webp'), {}),
    );

    expect(status).toBe(200);
    expect(body.rules).toMatchObject({
      allowedContentTypes: ['image/webp'],
      maximumSizeInBytes: 15 * 1024 * 1024,
      addRandomSuffix: true,
    });
    expect(body.rules.validUntil).toBeGreaterThanOrEqual(before + 14 * 60 * 1000);
    expect(body.rules.validUntil).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000);
  });

  it('vídeos ganham o limite de 500 MB', async () => {
    const { body } = await parse(await token(tokenRequest('uploads/2026/10/demo.mp4'), {}));
    expect(body.rules).toMatchObject({
      allowedContentTypes: ['video/mp4'],
      maximumSizeInBytes: 500 * 1024 * 1024,
    });
  });

  it.each([
    ['SVG', 'uploads/2026/10/logo.svg'],
    ['fora de uploads/', 'outra/2026/10/a.png'],
    ['subindo pastas', 'uploads/2026/10/../../a.png'],
    ['sem extensão', 'uploads/2026/10/arquivo'],
    ['maiúsculas', 'uploads/2026/10/FOTO.PNG'],
  ])('recusa %s com 415', async (_label, pathname) => {
    const { status, body } = await parse(await token(tokenRequest(pathname), {}));
    expect(status).toBe(415);
    expect(body.error).toBe('media');
  });

  it('só emite token: outros eventos do SDK são recusados', async () => {
    const response = await token(
      tokenRequest('uploads/2026/10/a.png', 'blob.upload-completed'),
      {},
    );
    expect(response.status).toBe(400);
    expect(handleUpload).not.toHaveBeenCalled();
  });

  it('sem Blob configurado responde 503', async () => {
    mockMode.mockReturnValue('local');
    expect((await token(tokenRequest('uploads/2026/10/a.png'), {})).status).toBe(503);
  });
});

describe('POST /api/admin/media/register', () => {
  const registerRequest = (body: unknown) =>
    new NextRequest(url('/register'), { method: 'POST', body: JSON.stringify(body) });

  it('registra a URL enviada ao Blob em nome de quem enviou', async () => {
    const blobUrl = 'https://abc.public.blob.vercel-storage.com/uploads/2026/10/a-x1.png';
    (registerBlobUpload as jest.Mock).mockResolvedValue({ url: blobUrl });

    expect(await parse(await register(registerRequest({ url: blobUrl }), {}))).toEqual({
      status: 201,
      body: { item: { url: blobUrl } },
    });
    expect(registerBlobUpload).toHaveBeenCalledWith(blobUrl, 'u1');
  });

  it('recusa o que não é URL', async () => {
    expect((await register(registerRequest({ url: '/uploads/a.png' }), {})).status).toBe(400);
    expect(registerBlobUpload).not.toHaveBeenCalled();
  });
});
