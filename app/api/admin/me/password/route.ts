import { z } from 'zod';

import { adminRoute, json } from '@/lib/admin/api';
import { changePassword } from '@/lib/users/service';

const bodySchema = z.object({
  current: z.string().min(1).max(1024),
  next: z.string().min(1).max(1024),
});

// Trocar a senha encerra todas as sessões (inclusive esta).
export const POST = adminRoute(
  'posts:write',
  async (request, _context, { actor }) => {
    const { current, next } = bodySchema.parse(await request.json());
    await changePassword(actor.id, current, next);
    return json({ ok: true });
  },
  { allowReader: true },
);
