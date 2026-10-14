import { z } from 'zod';

import { adminRoute, json } from '@/lib/admin/api';
import { createPasswordReset, regenerateInvite } from '@/lib/users/service';

type Context = { params: Promise<{ id: string }> };

const bodySchema = z.object({ purpose: z.enum(['invite', 'reset']) });

// Gera um link de uso único (novo convite ou redefinição de senha).
export const POST = adminRoute('posts:write', async (request, { params }: Context, { actor }) => {
  const { id } = await params;
  const { purpose } = bodySchema.parse(await request.json());

  const token =
    purpose === 'invite' ? await regenerateInvite(actor, id) : await createPasswordReset(actor, id);
  return json({ token, purpose }, 201);
});
