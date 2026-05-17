import { fail, redirect, type Actions } from '@sveltejs/kit';
import { checkPassword, signSession } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.authed) throw redirect(303, '/choisir-profil');
  return {};
};

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const data = await request.formData();
    const password = (data.get('password') ?? '').toString();

    if (!password) return fail(400, { error: 'Mot de passe requis.' });

    const ok = await checkPassword(password);
    if (!ok) return fail(401, { error: 'Mot de passe incorrect.' });

    await signSession(cookies);
    throw redirect(303, '/choisir-profil');
  }
};
