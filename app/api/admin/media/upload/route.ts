import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

import { adminRoute, json } from '@/lib/admin/api';
import { MediaError, getMediaMode } from '@/lib/cms/media';
import { contentTypeForExtension, maxBytesFor, mediaKindOf } from '@/lib/cms/media-types';

const PATHNAME_RE = /^uploads\/\d{4}\/\d{2}\/[a-z0-9-]+\.([a-z0-9]+)$/;

// Emite o token de curta duração para o upload direto do navegador ao
// Vercel Blob. O arquivo não passa pela função (sem o limite de 4,5 MB).
export const POST = adminRoute('media:write', async (request) => {
  if (getMediaMode() !== 'blob') {
    throw new MediaError('Vercel Blob não está configurado (BLOB_READ_WRITE_TOKEN).', 503);
  }

  const body = (await request.json()) as HandleUploadBody;

  // Não usamos o webhook de conclusão; só emissão de token é aceita.
  if (body.type !== 'blob.generate-client-token') {
    throw new MediaError('Evento não suportado.');
  }

  const result = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (pathname) => {
      const extension = pathname.match(PATHNAME_RE)?.[1];
      const contentType = extension ? contentTypeForExtension(extension) : null;
      const kind = contentType ? mediaKindOf(contentType) : null;

      if (!contentType || !kind) {
        throw new MediaError('Caminho ou formato de arquivo inválido.', 415);
      }

      return {
        allowedContentTypes: [contentType],
        maximumSizeInBytes: maxBytesFor(kind),
        addRandomSuffix: true,
        validUntil: Date.now() + 15 * 60 * 1000,
      };
    },
  });

  return json(result);
});
