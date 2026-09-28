// Signed admin session tokens for the hidden admin area.
//
// A token looks like "<payload>.<signature>" where
//   payload   = base64url(JSON { email, exp })
//   signature = base64url(HMAC-SHA256(ADMIN_SESSION_SECRET, payload))
//
// Web Crypto is used so this exact code works both in Node route handlers
// (login/logout) and in the proxy that guards /admin.

export const ADMIN_COOKIE_NAME = 'heroix_admin_session';

// 12 hours
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 12;

export interface AdminSession {
  email: string;
}

interface TokenPayload {
  email: string;
  exp: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// The signing secret never falls back to a value that is published in this
// repository - if it is missing the admin area fails closed (no access).
function getSecret(): string | null {
  const secret = (process.env.ADMIN_SESSION_SECRET || '').trim();
  return secret.length >= 16 ? secret : null;
}

export function isAdminSessionConfigured(): boolean {
  return getSecret() !== null;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret) as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(value) as unknown as BufferSource
  );
  return toBase64Url(new Uint8Array(signature));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Creates a signed session token, or null when ADMIN_SESSION_SECRET is not configured. */
export async function createAdminSessionToken(email: string): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;

  const payload: TokenPayload = {
    email: email.trim().toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE,
  };

  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${body}.${await sign(body, secret)}`;
}

/** Verifies signature and expiry. Returns null for any invalid or expired token. */
export async function verifyAdminSessionToken(
  token: string | undefined | null
): Promise<AdminSession | null> {
  const secret = getSecret();
  if (!secret || !token) return null;

  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = await sign(body, secret);
  if (!safeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(decoder.decode(fromBase64Url(body))) as TokenPayload;
    if (!payload?.email || typeof payload.exp !== 'number') return null;
    if (payload.exp * 1000 <= Date.now()) return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}
