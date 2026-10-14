import { NextResponse, type NextRequest } from 'next/server';

import { AUTHORIZE_PATH, COOKIES } from '@/lib/auth/config';
import { revokeToken } from '@/lib/auth/oauth';
import {
  clearSessionCookies,
  getRequestOrigin,
  isSameOriginRequest,
  noStore,
} from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  const origin = getRequestOrigin(request.headers);

  if (!isSameOriginRequest(request)) {
    return noStore(NextResponse.json({ error: 'forbidden' }, { status: 403 }));
  }

  const tokens = [
    request.cookies.get(COOKIES.refresh)?.value,
    request.cookies.get(COOKIES.access)?.value,
  ].filter((t): t is string => !!t);

  await Promise.all(tokens.map((token) => revokeToken(token)));

  const response = NextResponse.redirect(new URL(`${AUTHORIZE_PATH}?logged_out=1`, origin), 303);
  clearSessionCookies(response);
  return noStore(response);
}
