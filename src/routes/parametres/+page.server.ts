import { fail, redirect, type Actions } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { PageServerLoad } from './$types';

const settingsSchema = z.object({
  labelFr: z.string().min(1).max(40)
});

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.currentUser) throw redirect(303, '/choisir-profil');
  return { user: locals.currentUser };
};

export const actions: Actions = {
  saveSettings: async ({ request, locals }) => {
    if (!locals.currentUser) return fail(401, { error: 'Non authentifié.' });

    const data = await request.formData();
    const parsed = settingsSchema.safeParse({ labelFr: data.get('labelFr') });
    if (!parsed.success) {
      return fail(400, { error: 'Nom invalide.' });
    }

    await db
      .update(users)
      .set({ labelFr: parsed.data.labelFr })
      .where(eq(users.id, locals.currentUser.id));

    return { saved: true };
  }
};
