import { adminRoute, json, noContent } from '@/lib/admin/api';
import { deletePost, getPostForEditor, updatePost } from '@/lib/cms/posts';
import { savePostSchema } from '@/lib/cms/schema';

type Context = { params: Promise<{ id: string }> };

export const GET = adminRoute('posts:write', async (_request, { params }: Context, { actor }) => {
  return json({ post: await getPostForEditor(actor, (await params).id) });
});

export const PUT = adminRoute('posts:write', async (request, { params }: Context, { actor }) => {
  const { id } = await params;
  const { post, status, expectedVersion } = savePostSchema.parse(await request.json());

  if (expectedVersion === null) {
    return json({ error: 'validation', message: 'expectedVersion é obrigatório.' }, 400);
  }

  return json({ post: await updatePost(actor, id, post, status, expectedVersion) });
});

export const DELETE = adminRoute('posts:write', async (request, { params }: Context, { actor }) => {
  const { id } = await params;
  const version = Number(request.nextUrl.searchParams.get('version'));

  if (!Number.isInteger(version) || version < 1) {
    return json({ error: 'validation', message: 'Parâmetro version é obrigatório.' }, 400);
  }

  await deletePost(actor, id, version);
  return noContent();
});
