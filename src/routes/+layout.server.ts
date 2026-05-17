import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: LayoutServerLoad = async ({ locals }) => {
  const householdId = locals.currentUser?.householdId ?? 1;

  const householdUsers = locals.authed
    ? await db.select().from(users).where(eq(users.householdId, householdId))
    : [];

  return {
    authed: locals.authed,
    currentUser: locals.currentUser,
    householdUsers
  };
};
