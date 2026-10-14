import { NextResponse, type NextRequest } from 'next/server';

import { commentErrorResponse, commentSession, requireSameOrigin } from '@/lib/comments/http';
import { setCommentVisibility, visibilitySchema } from '@/lib/comments/service';

type Context = { params: Promise<{ id: string }> };

// Moderação: editores e acima escondem ou mostram de novo.
export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { actor, viaCookie } = await commentSession(request);
    requireSameOrigin(request, viaCookie);
    const { status } = visibilitySchema.parse(await request.json());
    await setCommentVisibility(actor, (await params).id, status);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return commentErrorResponse(error);
  }
}
