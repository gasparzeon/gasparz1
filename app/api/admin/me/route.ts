import { adminRoute, json } from '@/lib/admin/api';
import { getProfile, updateProfile } from '@/lib/users/service';

export const GET = adminRoute(
  'posts:write',
  async (_request, _context, { actor }) => {
    return json({ profile: await getProfile(actor.id) });
  },
  { allowReader: true },
);

export const PATCH = adminRoute(
  'posts:write',
  async (request, _context, { actor }) => {
    await updateProfile(actor.id, await request.json());
    return json({ profile: await getProfile(actor.id) });
  },
  { allowReader: true },
);
