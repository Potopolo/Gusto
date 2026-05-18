import { db } from '$lib/server/db';
import { menus } from '$lib/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

const DEFAULT_HOUSEHOLD_ID = 1;

export const load: PageServerLoad = async () => {
  const list = await db
    .select()
    .from(menus)
    .where(eq(menus.householdId, DEFAULT_HOUSEHOLD_ID))
    .orderBy(desc(menus.startDate));
  return { menus: list };
};
