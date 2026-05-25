/**
 * Profile cookie helpers.
 *
 * The household password has been removed — there's no session token
 * anymore, only a long-lived cookie that holds the picked profile's
 * `users.id`. Everything else (route guards, ownership checks) keys off
 * `locals.currentUser` populated from that cookie.
 */
import type { Cookies } from '@sveltejs/kit';
import { db } from './db';
import { users, type User } from './db/schema';
import { eq } from 'drizzle-orm';

const USER_COOKIE = 'hh_user_id';
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

export function setCurrentUserCookie(cookies: Cookies, userId: number): void {
  cookies.set(USER_COOKIE, String(userId), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.env.DEV,
    maxAge: COOKIE_MAX_AGE_S
  });
}

export function clearCurrentUserCookie(cookies: Cookies): void {
  cookies.delete(USER_COOKIE, { path: '/' });
}

export async function getCurrentUser(cookies: Cookies): Promise<User | null> {
  const raw = cookies.get(USER_COOKIE);
  if (!raw) return null;
  const id = parseInt(raw, 10);
  if (!Number.isFinite(id)) return null;
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}
