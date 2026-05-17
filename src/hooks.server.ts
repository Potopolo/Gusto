import { redirect, type Handle } from '@sveltejs/kit';
import { getCurrentUser } from '$lib/server/auth';

// Household password gate is deferred — will be re-enabled before any public deploy.
// To re-enable: flip AUTH_BYPASS to false and route '/login' will gate the rest.
const AUTH_BYPASS = true;

const PROFILE_PICKER_ROUTE = '/choisir-profil';

export const handle: Handle = async ({ event, resolve }) => {
  const path = event.url.pathname;

  event.locals.authed = AUTH_BYPASS;
  event.locals.currentUser = await getCurrentUser(event.cookies);
  event.locals.household = null;

  if (!event.locals.currentUser && path !== PROFILE_PICKER_ROUTE) {
    throw redirect(303, PROFILE_PICKER_ROUTE);
  }

  return resolve(event);
};
