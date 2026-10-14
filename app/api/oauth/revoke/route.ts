import { NextResponse, type NextRequest } from 'next/server';

import { revokeToken } from '@/lib/auth/oauth';
import { noStore } from '@/lib/auth/session';

// Revocation endpoint (RFC 7009). Responde 200 mesmo para tokens
// inválidos, para não revelar quais tokens existem.
export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.startsWith('application/x-www-form-urlencoded')) {
    return noStore(
      NextResponse.json(
        { error: 'invalid_request', error_description: 'Use application/x-www-form-urlencoded.' },
        { status: 400 },
      ),
    );
  }

  const form = new URLSearchParams(await request.text());
  const token = form.get('token');

  if (token) await revokeToken(token);

  return noStore(new NextResponse(null, { status: 200 }));
}
