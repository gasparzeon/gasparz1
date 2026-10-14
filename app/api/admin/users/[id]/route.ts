import { z } from 'zod';

import { adminRoute, json, noContent } from '@/lib/admin/api';
import { ROLES } from '@/lib/auth/permissions';
import { approveUser, deleteUser, rejectUser, updateUser } from '@/lib/users/service';

type Context = { params: Promise<{ id: string }> };

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), role: z.enum(ROLES) }),
  z.object({ action: z.literal('reject') }),
  z.object({ action: z.literal('role'), role: z.enum(ROLES) }),
  z.object({ action: z.literal('status'), status: z.enum(['active', 'suspended']) }),
]);

export const PATCH = adminRoute('posts:write', async (request, { params }: Context, { actor }) => {
  const { id } = await params;
  const body = patchSchema.parse(await request.json());

  if (body.action === 'approve') await approveUser(actor, id, body.role);
  if (body.action === 'reject') await rejectUser(actor, id);
  if (body.action === 'role') await updateUser(actor, id, { role: body.role });
  if (body.action === 'status') await updateUser(actor, id, { status: body.status });

  return json({ ok: true });
});

export const DELETE = adminRoute('posts:write', async (request, { params }: Context, { actor }) => {
  const { id } = await params;
  await deleteUser(actor, id, request.nextUrl.searchParams.get('transferTo'));
  return noContent();
});
