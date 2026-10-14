import { upload } from '@vercel/blob/client';

import { adminFetch, refreshSession } from '../client';
import { uploadMedia, validateFile } from '../upload';

jest.mock('@vercel/blob/client', () => ({ upload: jest.fn() }));
jest.mock('../client', () => {
  const actual = jest.requireActual('../client');
  return {
    ...actual,
    adminFetch: jest.fn(),
    refreshSession: jest.fn(),
    redirectToLogin: jest.fn(),
  };
});

const mockUpload = upload as jest.Mock;
const mockRefresh = refreshSession as jest.Mock;
const mockAdminFetch = adminFetch as jest.Mock;

beforeEach(() => {
  mockAdminFetch.mockResolvedValue({ item: {} });
});

const file = (name: string, type: string, size = 10) =>
  new File([new Uint8Array(size)], name, { type });

describe('validateFile', () => {
  it('aceita imagens e vídeos suportados', () => {
    expect(validateFile(file('a.png', 'image/png'))).toBe('image');
    expect(validateFile(file('a.mp4', 'video/mp4'))).toBe('video');
  });

  it('recusa formatos e tamanhos fora do limite', () => {
    expect(() => validateFile(file('a.svg', 'image/svg+xml'))).toThrow(/formato não suportado/);
    expect(() => validateFile(file('a.png', 'image/png', 16 * 1024 * 1024))).toThrow(/limite/);
  });
});

describe('uploadMedia', () => {
  it('recusa upload quando a mídia está desativada', async () => {
    await expect(
      uploadMedia(file('a.png', 'image/png'), { mode: 'disabled' }),
    ).rejects.toMatchObject({ status: 503 });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('envia direto ao Vercel Blob com caminho organizado e progresso', async () => {
    mockUpload.mockImplementation(async (_path, _body, options) => {
      options.onUploadProgress({ loaded: 5, total: 10, percentage: 50 });
      return { url: 'https://x.public.blob.vercel-storage.com/uploads/2026/10/foto-abc.png' };
    });
    const onProgress = jest.fn();

    const result = await uploadMedia(file('Foto Nova.PNG', 'image/png'), {
      mode: 'blob',
      onProgress,
    });

    expect(result).toEqual({
      url: 'https://x.public.blob.vercel-storage.com/uploads/2026/10/foto-abc.png',
      kind: 'image',
      name: 'Foto Nova.PNG',
    });
    const [pathname, , options] = mockUpload.mock.calls[0];
    expect(pathname).toMatch(/^uploads\/\d{4}\/\d{2}\/foto-nova\.png$/);
    expect(options).toMatchObject({
      access: 'public',
      handleUploadUrl: '/api/admin/media/upload',
      contentType: 'image/png',
      multipart: false,
    });
    expect(onProgress).toHaveBeenCalledWith(0.5);
    // Depois do upload, registra o arquivo na biblioteca (dono = quem enviou).
    expect(mockAdminFetch).toHaveBeenCalledWith('/api/admin/media/register', {
      method: 'POST',
      body: JSON.stringify({ url: result.url }),
    });
  });

  it('usa multipart para vídeos grandes', async () => {
    mockUpload.mockResolvedValue({ url: 'https://blob/v.mp4' });
    await uploadMedia(file('v.mp4', 'video/mp4', 30 * 1024 * 1024), { mode: 'blob' });
    expect(mockUpload.mock.calls[0][2]).toMatchObject({ multipart: true });
  });

  it('renova a sessão e tenta de novo se o token de upload falhar', async () => {
    mockUpload
      .mockRejectedValueOnce(new Error('Failed to retrieve the client token'))
      .mockResolvedValueOnce({ url: 'https://blob/a.png' });
    mockRefresh.mockResolvedValue({ ok: true });

    await expect(uploadMedia(file('a.png', 'image/png'), { mode: 'blob' })).resolves.toMatchObject({
      url: 'https://blob/a.png',
    });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockUpload).toHaveBeenCalledTimes(2);
  });

  it('desiste se a sessão expirou', async () => {
    mockUpload.mockRejectedValue(new Error('401'));
    mockRefresh.mockResolvedValue({ ok: false, reason: 'expired' });

    await expect(uploadMedia(file('a.png', 'image/png'), { mode: 'blob' })).rejects.toMatchObject({
      status: 401,
    });
    expect(mockUpload).toHaveBeenCalledTimes(1);
  });
});
