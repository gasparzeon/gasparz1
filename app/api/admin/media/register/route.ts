import { z } from 'zod';

import { adminRoute, json } from '@/lib/admin/api';
import { registerBlobUpload } from '@/lib/cms/media';

const bodySchema = z.object({ url: z.string().url().max(2048) });

export const POST = adminRoute('media:write', async (request, _context, { actor }) => {
  const { url } = bodySchema.parse(await request.json());
  return json({ item: await registerBlobUpload(url, actor.id) }, 201);
});
