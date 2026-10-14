import { z } from 'zod';

import { adminRoute, json } from '@/lib/admin/api';
import { setSignupEnabled } from '@/lib/users/service';

const bodySchema = z.object({ signupEnabled: z.boolean() });

export const PATCH = adminRoute('posts:write', async (request, _context, { actor }) => {
  const { signupEnabled } = bodySchema.parse(await request.json());
  await setSignupEnabled(actor, signupEnabled);
  return json({ signupEnabled });
});
