import type { Cookies } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from './db';
import { users, type User } from './db/schema';
import { eq } from 'drizzle-orm';

const SESSION_COOKIE = 'hh_session';
const USER_COOKIE = 'hh_user_id';
const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return b64url(new Uint8Array(sig));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function getSecret(): string {
  const s = env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET not set');
  return s;
}

export async function checkPassword(submitted: string): Promise<boolean> {
  const expected = env.HOUSEHOLD_PASSWORD;
  if (!expected) throw new Error('HOUSEHOLD_PASSWORD not set');
  return constantTimeEqual(submitted, expected);
}

export async function signSession(cookies: Cookies): Promise<void> {
  const ts = Date.now().toString();
  const sig = await hmac(ts, getSecret());
  cookies.set(SESSION_COOKIE, `${ts}.${sig}`, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.env.DEV,
    maxAge: SESSION_MAX_AGE_S
  });
}

export async function isAuthed(cookies: Cookies): Promise<boolean> {
  const token = cookies.get(SESSION_COOKIE);
  if (!token) return false;
  const [tsStr, sig] = token.split('.');
  if (!tsStr || !sig) return false;
  const expected = await hmac(tsStr, getSecret());
  if (!constantTimeEqual(expected, sig)) return false;
  const ts = parseInt(tsStr, 10);
  if (!Number.isFinite(ts)) return false;
  if (Date.now() - ts > SESSION_MAX_AGE_S * 1000) return false;
  return true;
}

export function clearSession(cookies: Cookies): void {
  cookies.delete(SESSION_COOKIE, { path: '/' });
  cookies.delete(USER_COOKIE, { path: '/' });
}

export function setCurrentUserCookie(cookies: Cookies, userId: number): void {
  cookies.set(USER_COOKIE, String(userId), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.env.DEV,
    maxAge: SESSION_MAX_AGE_S
  });
}

export async function getCurrentUser(cookies: Cookies): Promise<User | null> {
  const raw = cookies.get(USER_COOKIE);
  if (!raw) return null;
  const id = parseInt(raw, 10);
  if (!Number.isFinite(id)) return null;
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}
