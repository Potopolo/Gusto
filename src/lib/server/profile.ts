/**
 * Profile bootstrap helpers.
 *
 * Every user is expected to have exactly one row in `profiles`. In practice
 * we sometimes end up with users without one — e.g. a row inserted before
 * `profiles` existed in the schema, or a manually-created user during dev.
 * Rather than 500'ing those flows, `ensureProfile` seeds the missing row
 * with the same defaults `choisir-profil` uses for new users.
 *
 * The helper is idempotent: if a profile already exists, it's returned
 * unchanged.
 */
import { eq } from 'drizzle-orm';
import { db } from './db';
import { profiles, type Profile } from './db/schema';
import {
  defaultDietaryPrefs,
  defaultMacroTargets,
  defaultPointsFormula,
  defaultProfileValues
} from './db/defaults';

/** Fetch the profile row for `userId`, creating it from defaults if absent. */
export async function ensureProfile(userId: number): Promise<Profile> {
  const [existing] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (existing) return existing as Profile;

  await db.insert(profiles).values({
    userId,
    ...defaultProfileValues,
    macroTargets: defaultMacroTargets,
    dietaryPrefs: defaultDietaryPrefs,
    pointsFormulaConfig: defaultPointsFormula
  });

  const [created] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!created) {
    throw new Error(`Failed to seed profile for user ${userId}`);
  }
  return created as Profile;
}
