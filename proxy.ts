// Proxy (formerly "middleware") - the only job here is to make sure the admin
// area and the admin-only APIs are unreachable unless a valid signed admin
// session cookie is present.
//
// Visitors without a session are simply sent back to the shop, so the admin
// area looks like it does not exist (no login screen, no "Admin" hints).
// The real authority check happens again in app/admin/layout.tsx and inside the
// admin API route handlers, so this is defence in depth.

import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from '@/lib/admin-session';

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const session = await verifyAdminSessionToken(token);

  if (session) {
    return NextResponse.next();
  }

  // API calls get a plain 401 instead of an HTML redirect.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const home = request.nextUrl.clone();
  home.pathname = '/';
  home.search = '';
  return NextResponse.redirect(home);
}

export const config = {
  // NOTE: /api/products is deliberately NOT in this matcher.
  // GET /api/products is the public catalogue read used by the storefront, and
  // this proxy blocks a whole path for anonymous callers - adding it would break
  // the shop. Its write path (POST) is instead protected inside the route handler
  // with requireAdminApi(), which checks the method being called.
  matcher: [
    '/admin',
    '/admin/:path*',
    '/api/admin-products',
    '/api/admin-products/:path*',
    '/api/test-db',
    '/api/test-db/:path*',
    '/api/test-supabase',
    '/api/test-supabase/:path*',
  ],
};
