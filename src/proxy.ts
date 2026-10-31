import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_HINT_COOKIE } from '@/lib/sessionHint';

/**
 * Returning users go straight from the landing page to their files. A `next`
 * param means a protected page just bounced them here (stale session), so we
 * leave it alone to avoid a redirect loop.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_HINT_COOKIE) && !request.nextUrl.searchParams.has('next')) {
    return NextResponse.redirect(new URL('/files', request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: '/' };
