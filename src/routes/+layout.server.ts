import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users, profiles } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: LayoutServerLoad = async ({ locals }) => {
  const householdId = locals.currentUser?.householdId ?? 1;

  // No more password gate — always expose the household's user list so the
  // profile switcher and shared views render correctly.
  const householdUsers = await db
    .select()
    .from(users)
    .where(eq(users.householdId, householdId));

  // Pull the optional notification email so the settings modal can show
  // it and the shopping list can pre-fill the mailto link.
  let notificationEmail: string | null = null;
  if (locals.currentUser) {
    const [row] = await db
      .select({ email: profiles.notificationEmail })
      .from(profiles)
      .where(eq(profiles.userId, locals.currentUser.id))
      .limit(1);
    notificationEmail = row?.email ?? null;
  }

  return {
    authed: true,
    currentUser: locals.currentUser,
    notificationEmail,
    householdUsers
  };
};
