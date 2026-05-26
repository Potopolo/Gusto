import { fail, redirect, type Actions } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, profiles } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { clearCurrentUserCookie } from '$lib/server/auth';
import { ensureProfile } from '$lib/server/profile';
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
  },

  /** Save (or clear) the notification email used to pre-fill the
   *  "send shopping list" mailto link. An empty string clears the value. */
  saveEmail: async ({ request, locals }) => {
    if (!locals.currentUser) return fail(401, { error: 'Non authentifié.' });
    const data = await request.formData();
    const raw = (data.get('email') ?? '').toString().trim();
    const value = raw === '' ? null : raw;

    if (value && !z.string().email().safeParse(value).success) {
      return fail(400, { error: 'Adresse email invalide.' });
    }

    // Make sure a profile row exists so the UPDATE finds a target.
    await ensureProfile(locals.currentUser.id);
    await db
      .update(profiles)
      .set({ notificationEmail: value })
      .where(eq(profiles.userId, locals.currentUser.id));
    return { savedEmail: true };
  },

  /** Clear the profile cookie and bounce back to the profile picker. */
  logout: async ({ cookies }) => {
    clearCurrentUserCookie(cookies);
    throw redirect(303, '/choisir-profil');
  },

  /**
   * Delete the current user's profile. Refuses when it would leave the
   * household with zero profiles (we'd have no way back into the app).
   * Favorites cascade away via FK; menus/shopping-lists are household-
   * scoped so they survive.
   */
  deleteProfile: async ({ cookies, locals }) => {
    if (!locals.currentUser) return fail(401, { error: 'Non authentifié.' });
    const userId = locals.currentUser.id;
    const householdId = locals.currentUser.householdId;

    // Block deletion when it'd empty the household.
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.householdId, householdId));
    if (Number(n) <= 1) {
      return fail(400, {
        error:
          'Impossible de supprimer le dernier profil. Crée d’abord un autre profil.'
      });
    }

    // `profiles.userId` is not ON DELETE CASCADE in the schema yet —
    // wipe it manually before removing the user row. Favorites and
    // anything else FK'd from `users` cascades automatically.
    await db.delete(profiles).where(eq(profiles.userId, userId));
    await db.delete(users).where(eq(users.id, userId));

    clearCurrentUserCookie(cookies);
    throw redirect(303, '/choisir-profil');
  }
};
