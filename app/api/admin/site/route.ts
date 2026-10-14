import { adminRoute, json } from '@/lib/admin/api';
import { saveSiteSettingsSchema } from '@/lib/site/schema';
import { getSiteSettingsForAdmin, saveSiteSettings } from '@/lib/site/service';

export const GET = adminRoute('posts:write', async (_request, _context, { actor }) => {
  return json(await getSiteSettingsForAdmin(actor));
});

export const PUT = adminRoute('posts:write', async (request, _context, { actor }) => {
  const { settings, expectedUpdatedAt } = saveSiteSettingsSchema.parse(await request.json());
  return json(await saveSiteSettings(actor, settings, expectedUpdatedAt));
});
