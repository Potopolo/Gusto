import { fail, redirect, type Actions } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { users, profiles } from '$lib/server/db/schema';
import {
  defaultMacroTargets,
  defaultDietaryPrefs,
  defaultPointsFormula,
  defaultProfileValues
} from '$lib/server/db/defaults';
import { setCurrentUserCookie } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

// Single-household for now; phase 3 will introduce real auth + invitations
const DEFAULT_HOUSEHOLD_ID = 1;

const createSchema = z.object({
  labelFr: z.string().trim().min(1, 'Nom requis.').max(40, 'Nom trop long (40 max).')
});

export const load: PageServerLoad = async () => {
  const allUsers = await db
    .select()
    .from(users)
    .where(eq(users.householdId, DEFAULT_HOUSEHOLD_ID));
  return { users: allUsers };
};

export const actions: Actions = {
  select: async ({ request, cookies }) => {
    const data = await request.formData();
    const userId = parseInt((data.get('userId') ?? '').toString(), 10);
    if (!Number.isFinite(userId)) return fail(400, { error: 'Profil invalide.' });

    const row = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!row[0]) return fail(404, { error: 'Profil introuvable.' });

    setCurrentUserCookie(cookies, userId);
    throw redirect(303, '/');
  },

  create: async ({ request, cookies }) => {
    const data = await request.formData();
    const parsed = createSchema.safeParse({ labelFr: data.get('labelFr') ?? '' });
    if (!parsed.success) {
      return fail(400, { error: parsed.error.issues[0]?.message ?? 'Données invalides.' });
    }

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.labelFr, parsed.data.labelFr))
      .limit(1);
    if (existing[0]) {
      return fail(409, { error: 'Ce nom est déjà utilisé.' });
    }

    const [newUser] = await db
      .insert(users)
      .values({ householdId: DEFAULT_HOUSEHOLD_ID, labelFr: parsed.data.labelFr })
      .returning();

    if (!newUser) return fail(500, { error: 'Création impossible.' });

    await db.insert(profiles).values({
      userId: newUser.id,
      ...defaultProfileValues,
      macroTargets: defaultMacroTargets,
      dietaryPrefs: defaultDietaryPrefs,
      pointsFormulaConfig: defaultPointsFormula
    });

    setCurrentUserCookie(cookies, newUser.id);
    throw redirect(303, '/profil');
  }
};
