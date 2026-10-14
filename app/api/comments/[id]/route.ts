import { type NextRequest } from 'next/server';

import { commentErrorResponse, commentSession, requireSameOrigin } from '@/lib/comments/http';
import { deleteComment, updateComment } from '@/lib/comments/service';

type Context = { params: Promise<{ id: string }> };

// Só o autor edita o próprio comentário.
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const { actor, viaCookie } = await commentSession(request);
    requireSameOrigin(request, viaCookie);
    const { body } = (await request.json()) as { body?: string };
    await updateComment(actor.id, (await params).id, body ?? '');
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return commentErrorResponse(error);
  }
}

// O autor apaga o próprio; moderador (editor em diante), qualquer um.
export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const { actor, viaCookie } = await commentSession(request);
    requireSameOrigin(request, viaCookie);
    await deleteComment(actor, (await params).id);
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return commentErrorResponse(error);
  }
}
