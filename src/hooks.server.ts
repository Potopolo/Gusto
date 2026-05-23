import { redirect, type Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getCurrentUser, isAuthed } from '$lib/server/auth';

/**
 * Auth gate.
 *
 * - AUTH_BYPASS=true  → development shortcut. Everyone is treated as
 *   authed; only the profile picker stays as a soft gate.
 * - AUTH_BYPASS=false → the /login route is the public entry. Any other
 *   route without a valid session cookie is redirected to /login.
 *   Once the user enters the household password they're sent to the
 *   profile picker, and only after they pick a profile do they reach
 *   the rest of the app.
 */
const LOGIN_ROUTE = '/login';
const PROFILE_PICKER_ROUTE = '/choisir-profil';

export const handle: Handle = async ({ event, resolve }) => {
  const path = event.url.pathname;
  const bypass = (env.AUTH_BYPASS ?? '').toLowerCase() === 'true';

  // Static assets / API endpoints that don't need session checks
  const isApi = path.startsWith('/api/');

  const authed = bypass || (await isAuthed(event.cookies));
  event.locals.authed = authed;
  event.locals.currentUser = authed ? await getCurrentUser(event.cookies) : null;
  event.locals.household = null;

  // Not authenticated → only /login is reachable
  if (!authed) {
    if (path === LOGIN_ROUTE || isApi) return resolve(event);
    throw redirect(303, LOGIN_ROUTE);
  }

  // Authenticated but no profile picked → land on the picker
  if (!event.locals.currentUser && path !== PROFILE_PICKER_ROUTE && path !== LOGIN_ROUTE) {
    throw redirect(303, PROFILE_PICKER_ROUTE);
  }

  return resolve(event);
};
