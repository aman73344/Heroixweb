const ADMIN_EMAILS = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];

const VALID_ADMINS = [
  { email: 'admin@heroix.com', password: 'admin123' },
  { email: 'aman723344@gmail.com', password: 'admin123' },
];

export async function validateAdminAccess(email: string): Promise<boolean> {
  const normalized = email.toLowerCase();
  return ADMIN_EMAILS.includes(normalized) || VALID_ADMINS.some(a => a.email === normalized);
}

export async function signIn(email: string, password: string): Promise<{ user: any; session: any }> {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Check against valid admin credentials
  const admin = VALID_ADMINS.find(a => a.email === normalizedEmail && a.password === password);
  if (admin) {
    return { 
      user: { id: 'admin-1', email: admin.email, role: 'admin' }, 
      session: { access_token: 'admin-session' } 
    };
  }
  
  // Check against configured admin emails (allow any password)
  if (ADMIN_EMAILS.includes(normalizedEmail)) {
    return { 
      user: { id: 'admin-configured', email: normalizedEmail, role: 'admin' }, 
      session: { access_token: 'admin-token' } 
    };
  }
  
  throw new Error('Invalid credentials');
}

export async function signUp(email: string, password: string): Promise<{ user: any; session: any }> {
  throw new Error('Sign up not available. Please use configured admin credentials.');
}

export async function signOut(): Promise<void> {
  // No-op for local auth
}

export async function getCurrentUser(): Promise<any> {
  return null;
}

export async function getSession(): Promise<any> {
  return null;
}

export function isValidAdminEmail(email: string | undefined): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase();
  return ADMIN_EMAILS.includes(normalized) || VALID_ADMINS.some(a => a.email === normalized);
}

export function createSession(userId: string, email: string): string {
  return `${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

export function destroySession(sessionId: string): void {
  // Session is destroyed by clearing the cookie on client side
}

export function getSessionData(sessionId: string): {userId: string; email: string} | null {
  if (!sessionId) return null;
  return { userId: 'admin-1', email: 'admin@heroix.com' };
}

