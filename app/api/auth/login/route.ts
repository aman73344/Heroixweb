import { NextRequest, NextResponse } from 'next/server';
import {
  getAdminConfigProblems,
  isAdminLoginConfigured,
  validateAdminCredentials,
} from '@/lib/auth';
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE,
  createAdminSessionToken,
} from '@/lib/admin-session';
import { rateLimit, rateLimitResponse, resetRateLimit, peekRateLimit, clientKey, RATE_LIMITS } from '@/lib/rate-limit';

// Brute-force protection now lives in the shared limiter (lib/rate-limit.ts) so
// every protected endpoint uses one implementation. It is still an in-process
// counter, so it is per instance - see the note in lib/rate-limit.ts.

export async function POST(request: NextRequest) {
  const key = clientKey(request);

  // Peek at the bucket WITHOUT consuming an attempt, so a legitimate admin can
  // still log in after previous failures from the same IP (shared NAT/Wi-Fi).
  const existing = peekRateLimit(request, { ...RATE_LIMITS.login, key });
  if (!existing.ok) {
    return rateLimitResponse(existing, 'Too many attempts. Please try again later.');
  }

  if (!isAdminLoginConfigured()) {
    // Name the exact variables that are missing. This is almost always the real
    // cause of "the server did not allow it" on the deployed site.
    const missing = getAdminConfigProblems();
    return NextResponse.json(
      {
        error: 'Admin login is not configured on the server.',
        missingEnvVars: missing,
        hint:
          'Set these in Vercel (Project > Settings > Environment Variables) for ALL ' +
          'environments, then redeploy: ' +
          (missing.length ? missing.join(', ') : 'ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_SESSION_SECRET'),
      },
      { status: 503 }
    );
  }

  let email = '';
  let password = '';
  try {
    const body = await request.json();
    email = String(body?.email || '');
    password = String(body?.password || '');
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Email and password are required' },
      { status: 400 }
    );
  }

  if (!validateAdminCredentials(email, password)) {
    // Only a WRONG password counts toward the limit, and this is the only place
    // an attempt is consumed.
    const attempt = rateLimit(request, { ...RATE_LIMITS.login, key });
    if (!attempt.ok) {
      return rateLimitResponse(attempt, 'Too many attempts. Please try again later.');
    }
    // Same message for a wrong email and a wrong password.
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const token = await createAdminSessionToken(email);
  if (!token) {
    return NextResponse.json(
      { error: 'Admin session secret is not configured on the server.' },
      { status: 503 }
    );
  }

  // Correct password: clear the failure history for this IP.
  resetRateLimit(request, RATE_LIMITS.login.bucket, key);

  const response = NextResponse.json({
    success: true,
    user: { email: email.trim().toLowerCase() },
  });

  response.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE,
  });

  return response;
}
