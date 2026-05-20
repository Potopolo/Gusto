import { fail, type Actions } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { menus } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';
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

export const actions: Actions = {
  /** Hard-delete a menu (menu_slots cascade via the schema's onDelete: 'cascade'). */
  delete: async ({ request }) => {
    const data = await request.formData();
    const menuId = parseInt((data.get('menuId') ?? '').toString(), 10);
    if (!Number.isFinite(menuId)) return fail(400, { error: 'Menu invalide.' });

    await db
      .delete(menus)
      .where(and(eq(menus.id, menuId), eq(menus.householdId, DEFAULT_HOUSEHOLD_ID)));

    return { deleted: true };
  }
};
