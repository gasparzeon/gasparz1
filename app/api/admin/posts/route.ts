import { adminRoute, json } from '@/lib/admin/api';
import { createPost, listPostsForAdmin } from '@/lib/cms/posts';
import { savePostSchema } from '@/lib/cms/schema';

export const GET = adminRoute('posts:write', async (request, _context, { actor }) => {
  const onlyMine = request.nextUrl.searchParams.get('mine') === '1';
  return json({ posts: await listPostsForAdmin(actor, { onlyMine }) });
});

export const POST = adminRoute('posts:write', async (request, _context, { actor }) => {
  const { post, status } = savePostSchema.parse(await request.json());
  return json({ post: await createPost(actor, post, status) }, 201);
});
