import { redirect, type Handle } from '@sveltejs/kit';
import { getCurrentUser } from '$lib/server/auth';

/**
 * Profile gate.
 *
 * The household password has been removed — anyone who reaches the app
 * can pick a profile from `/choisir-profil`. After picking, the user
 * cookie identifies them across requests. API endpoints stay reachable
 * without a profile (each one enforces `locals.currentUser` itself).
 */
const PROFILE_PICKER_ROUTE = '/choisir-profil';

export const handle: Handle = async ({ event, resolve }) => {
  const path = event.url.pathname;
  const isApi = path.startsWith('/api/');

  event.locals.authed = true;
  event.locals.currentUser = await getCurrentUser(event.cookies);
  event.locals.household = null;

  // Anyone without a chosen profile lands on the picker (except the picker
  // itself and the API). Once they pick, the cookie sticks for 30 days.
  if (!event.locals.currentUser && path !== PROFILE_PICKER_ROUTE && !isApi) {
    throw redirect(303, PROFILE_PICKER_ROUTE);
  }

  return resolve(event);
};
