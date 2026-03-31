// Middleware - temporarily disabled for local auth development
// Admin authentication is handled in the admin page itself

import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
