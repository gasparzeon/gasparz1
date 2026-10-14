import { NextResponse, type NextRequest } from 'next/server';

import { commentErrorResponse, commentSession, requireSameOrigin } from '@/lib/comments/http';
import { createComment, listComments } from '@/lib/comments/service';

// Lista pública dos comentários visíveis de um post: GET ?post=<slug>.
export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get('post') ?? '';
    const { post, comments } = await listComments(slug);
    return NextResponse.json({ post, comments });
  } catch (error) {
    return commentErrorResponse(error);
  }
}

// Comentar exige login (leitor em diante, com conta ativa).
export async function POST(request: NextRequest) {
  try {
    const { actor, viaCookie } = await commentSession(request);
    requireSameOrigin(request, viaCookie);
    const { post, body } = (await request.json()) as { post?: string; body?: string };
    const comment = await createComment(actor.id, post ?? '', body ?? '');
    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return commentErrorResponse(error);
  }
}
