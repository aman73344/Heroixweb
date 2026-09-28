// Server-side helpers for the hidden admin area.
// Only import this from server code (server components / route handlers).
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE_NAME,
  verifyAdminSessionToken,
  type AdminSession,
} from './admin-session';

/** Current admin (from the signed cookie) or null when not signed in. */
export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  return verifyAdminSessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
}

/**
 * Guard for admin-only API routes.
 * Returns a 401 response when the caller is not a signed-in admin, else null.
 */
export async function requireAdminApi(): Promise<NextResponse | null> {
  const session = await getAdminSession();
  if (session) return null;
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}
