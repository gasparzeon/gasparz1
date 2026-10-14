import { adminRoute, json, noContent } from '@/lib/admin/api';
import { deletePage, getPageForEditor, updatePage } from '@/lib/site/pages';
import { savePageSchema } from '@/lib/site/pages-schema';

type Context = { params: Promise<{ id: string }> };

export const GET = adminRoute('posts:write', async (_request, { params }: Context, { actor }) => {
  return json({ page: await getPageForEditor(actor, (await params).id) });
});

export const PUT = adminRoute('posts:write', async (request, { params }: Context, { actor }) => {
  const { id } = await params;
  const { page, status, expectedVersion } = savePageSchema.parse(await request.json());

  if (expectedVersion === null) {
    return json({ error: 'validation', message: 'expectedVersion é obrigatório.' }, 400);
  }
  return json({ page: await updatePage(actor, id, page, status, expectedVersion) });
});

export const DELETE = adminRoute('posts:write', async (request, { params }: Context, { actor }) => {
  const { id } = await params;
  const version = Number(request.nextUrl.searchParams.get('version'));

  if (!Number.isInteger(version) || version < 1) {
    return json({ error: 'validation', message: 'Parâmetro version é obrigatório.' }, 400);
  }

  await deletePage(actor, id, version);
  return noContent();
});
