import { adminRoute, json, noContent } from '@/lib/admin/api';
import { MediaError, deleteMedia, getMediaMode, listMedia, saveLocalUpload } from '@/lib/cms/media';

export const GET = adminRoute('media:write', async () => {
  return json({ mode: getMediaMode(), items: await listMedia() });
});

// Upload direto para public/uploads (modo local). No modo Blob o navegador
// envia o arquivo direto ao storage (/media/upload) e registra (/media/register).
export const POST = adminRoute('media:write', async (request, _context, { actor }) => {
  if (getMediaMode() !== 'local') {
    throw new MediaError('Upload local indisponível neste ambiente.', 400);
  }

  const contentType = (request.headers.get('content-type') ?? '').split(';')[0].trim();
  const rawName = request.headers.get('x-file-name') ?? 'arquivo';
  let fileName: string;
  try {
    fileName = decodeURIComponent(rawName);
  } catch {
    fileName = 'arquivo';
  }

  const item = await saveLocalUpload(
    request.body,
    contentType,
    fileName,
    Number(request.headers.get('content-length') ?? 0),
    actor.id,
  );

  return json({ item }, 201);
});

export const DELETE = adminRoute('media:write', async (request, _context, { actor }) => {
  const { url } = (await request.json()) as { url?: unknown };
  if (typeof url !== 'string' || !url) {
    throw new MediaError('Informe a URL do arquivo.');
  }

  await deleteMedia(actor, url);
  return noContent();
});
