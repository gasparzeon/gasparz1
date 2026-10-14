import { adminRoute, json } from '@/lib/admin/api';
import { getSignupEnabled, inviteUser, listUsers } from '@/lib/users/service';

export const GET = adminRoute('posts:write', async (_request, _context, { actor }) => {
  const [users, signupEnabled] = await Promise.all([listUsers(actor), getSignupEnabled()]);
  return json({ users, signupEnabled });
});

// Convite: cria a conta e devolve o token do link (o admin compartilha).
export const POST = adminRoute('posts:write', async (request, _context, { actor }) => {
  const { userId, token } = await inviteUser(actor, await request.json());
  return json({ userId, token }, 201);
});
