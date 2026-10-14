import {
  extensionFor,
  formatBytes,
  maxBytesFor,
  mediaKindOf,
  safeBaseName,
  uploadFolder,
  type MediaItem,
  type MediaKind,
  type MediaMode,
} from '@/lib/cms/media-types';

import { ApiError, adminFetch, redirectToLogin, refreshSession } from './client';

export type UploadResult = { url: string; kind: MediaKind; name: string };

type Options = {
  mode: MediaMode;
  onProgress?: (fraction: number) => void;
};

export function validateFile(file: File): MediaKind {
  const kind = mediaKindOf(file.type);
  if (!kind) {
    throw new ApiError(
      `"${file.name}": formato não suportado. Use JPG, PNG, WebP, GIF, AVIF, MP4 ou WebM.`,
      415,
    );
  }
  const max = maxBytesFor(kind);
  if (file.size > max) {
    throw new ApiError(`"${file.name}" passa do limite de ${formatBytes(max)}.`, 413);
  }
  return kind;
}

function sendLocal(file: File, onProgress?: (fraction: number) => void) {
  return new Promise<{ status: number; data: { item?: MediaItem; message?: string } | null }>(
    (resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/admin/media');
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(event.loaded / event.total);
      };
      xhr.onload = () => {
        let data = null;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {}
        resolve({ status: xhr.status, data });
      };
      xhr.onerror = () => reject(new ApiError('Falha de rede durante o upload.', 0));
      xhr.send(file);
    },
  );
}

async function uploadLocal(file: File, onProgress?: (fraction: number) => void) {
  let result = await sendLocal(file, onProgress);

  if (result.status === 401) {
    const refreshed = await refreshSession();
    if (!refreshed.ok) {
      if (refreshed.reason === 'expired') redirectToLogin();
      throw new ApiError('Sua sessão expirou. Entre novamente.', 401);
    }
    result = await sendLocal(file, onProgress);
  }

  if (result.status !== 201 || !result.data?.item) {
    throw new ApiError(result.data?.message ?? `Erro ${result.status} no upload.`, result.status);
  }

  return result.data.item.url;
}

async function uploadBlob(file: File, onProgress?: (fraction: number) => void) {
  const { upload } = await import('@vercel/blob/client');
  const pathname = `${uploadFolder()}/${safeBaseName(file.name)}.${extensionFor(file.type)}`;

  const attempt = () =>
    upload(pathname, file, {
      access: 'public',
      handleUploadUrl: '/api/admin/media/upload',
      contentType: file.type,
      multipart: file.size > 25 * 1024 * 1024,
      onUploadProgress: ({ percentage }) => onProgress?.(percentage / 100),
    });

  try {
    return (await attempt()).url;
  } catch (error) {
    // O SDK não expõe o status da rota de token; renova a sessão e tenta
    // mais uma vez antes de desistir.
    const refreshed = await refreshSession();
    if (!refreshed.ok) {
      if (refreshed.reason === 'expired') redirectToLogin();
      throw new ApiError('Sua sessão expirou. Entre novamente.', 401);
    }
    try {
      return (await attempt()).url;
    } catch {
      throw new ApiError(
        error instanceof Error ? error.message : 'Falha no upload para o Vercel Blob.',
        502,
      );
    }
  }
}

export async function uploadMedia(
  file: File,
  { mode, onProgress }: Options,
): Promise<UploadResult> {
  const kind = validateFile(file);

  if (mode === 'disabled') {
    throw new ApiError(
      'Upload indisponível: configure o Vercel Blob (BLOB_READ_WRITE_TOKEN) ou use uma URL.',
      503,
    );
  }

  if (mode === 'blob') {
    const url = await uploadBlob(file, onProgress);
    // Registra na biblioteca (o servidor confere tipo e tamanho no Blob).
    await adminFetch('/api/admin/media/register', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
    return { url, kind, name: file.name };
  }

  return { url: await uploadLocal(file, onProgress), kind, name: file.name };
}
