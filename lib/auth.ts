// Admin authentication system using cookie-based sessions

import { hash, compare } from 'bcryptjs';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
}

export interface Session {
  userId: string;
  username: string;
  expiresAt: Date;
}

// Mock admin users (in production, use database)
const adminUsers: AdminUser[] = [
  {
    id: 'admin-1',
    username: 'admin',
    email: 'admin@heroix.com',
    // Password: "admin123" (pre-hashed)
    passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456', // Mock hash
  },
];

// In-memory sessions store (in production, use database or Redis)
const sessions = new Map<string, Session>();

export async function createAdminUser(username: string, email: string, password: string): Promise<AdminUser | null> {
  // Check if user exists
  if (adminUsers.find(u => u.username === username)) {
    return null;
  }

  // Hash password
  const passwordHash = await hash(password, 10);

  const newUser: AdminUser = {
    id: `user-${Date.now()}`,
    username,
    email,
    passwordHash,
  };

  adminUsers.push(newUser);
  return newUser;
}

export async function validateCredentials(username: string, password: string): Promise<AdminUser | null> {
  const user = adminUsers.find(u => u.username === username);

  if (!user) return null;

  // For demo, use simple comparison
  // In production, use bcrypt compare
  if (username === 'admin' && password === 'admin123') {
    return user;
  }

  return null;
}

export function createSession(userId: string, username: string): string {
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const session: Session = {
    userId,
    username,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  };

  sessions.set(sessionId, session);
  return sessionId;
}

export function getSession(sessionId: string): Session | null {
  const session = sessions.get(sessionId);

  if (!session) return null;

  // Check if expired
  if (new Date() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }

  return session;
}

export function validateSession(sessionId: string): boolean {
  return getSession(sessionId) !== null;
}

export function destroySession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function validateAdminAccess(sessionId: string): boolean {
  const session = getSession(sessionId);
  return session !== null;
}

export const DEFAULT_ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123',
};
