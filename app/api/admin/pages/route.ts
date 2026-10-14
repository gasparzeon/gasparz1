import { adminRoute, json } from '@/lib/admin/api';
import { createPage, listPagesForAdmin } from '@/lib/site/pages';
import { savePageSchema } from '@/lib/site/pages-schema';

export const GET = adminRoute('posts:write', async (_request, _context, { actor }) => {
  return json({ pages: await listPagesForAdmin(actor) });
});

export const POST = adminRoute('posts:write', async (request, _context, { actor }) => {
  const { page, status } = savePageSchema.parse(await request.json());
  return json({ page: await createPage(actor, page, status) }, 201);
});
