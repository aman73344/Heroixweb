// Admin credential check - only used by the server-side login route handler.
//
// Credentials live in environment variables (.env.local), never in the code:
//   ADMIN_EMAIL           the owner's admin email
//   ADMIN_EMAILS          optional comma separated list of extra admin emails
//   ADMIN_PASSWORD        the admin password
//   ADMIN_SESSION_SECRET  secret used to sign the session cookie

export function getAdminEmails(): string[] {
  const emails = [
    ...(process.env.ADMIN_EMAIL || '').split(','),
    ...(process.env.ADMIN_EMAILS || '').split(','),
  ]
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set(emails));
}

function getAdminPassword(): string | null {
  const password = (process.env.ADMIN_PASSWORD || '').trim();
  return password.length > 0 ? password : null;
}

export function isAdminLoginConfigured(): boolean {
  return getAdminEmails().length > 0 && getAdminPassword() !== null;
}

// Length + content comparison without early exit.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** True only when the email is a configured admin AND the password matches. */
export function validateAdminCredentials(email: string, password: string): boolean {
  const expectedPassword = getAdminPassword();
  if (!expectedPassword || !email || !password) return false;

  const emailOk = getAdminEmails().includes(email.trim().toLowerCase());
  const passwordOk = safeEqual(password, expectedPassword);

  return emailOk && passwordOk;
}
