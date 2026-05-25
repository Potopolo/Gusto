import { fail, type Actions } from '@sveltejs/kit';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { shoppingLists, shoppingListItems, menus } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

const DEFAULT_HOUSEHOLD_ID = 1;

export const load: PageServerLoad = async () => {
  const list = await db
    .select({
      id: shoppingLists.id,
      name: shoppingLists.name,
      createdAt: shoppingLists.createdAt,
      menuId: shoppingLists.menuId,
      menuName: menus.name,
      itemCount: sql<number>`count(${shoppingListItems.id})`
    })
    .from(shoppingLists)
    .leftJoin(menus, eq(menus.id, shoppingLists.menuId))
    .leftJoin(shoppingListItems, eq(shoppingListItems.listId, shoppingLists.id))
    .where(eq(shoppingLists.householdId, DEFAULT_HOUSEHOLD_ID))
    .groupBy(shoppingLists.id, shoppingLists.name, shoppingLists.createdAt, shoppingLists.menuId, menus.name)
    .orderBy(desc(shoppingLists.createdAt));

  return {
    lists: list.map((r) => ({ ...r, itemCount: Number(r.itemCount) }))
  };
};

export const actions: Actions = {
  /** Hard-delete a list (items cascade via the schema's onDelete: 'cascade'). */
  delete: async ({ request, locals }) => {
    if (!locals.currentUser) return fail(401, { error: 'Non authentifié.' });

    const data = await request.formData();
    const listId = parseInt((data.get('listId') ?? '').toString(), 10);
    if (!Number.isFinite(listId)) return fail(400, { error: 'Liste invalide.' });

    await db
      .delete(shoppingLists)
      .where(
        and(eq(shoppingLists.id, listId), eq(shoppingLists.householdId, DEFAULT_HOUSEHOLD_ID))
      );

    return { deleted: true };
  }
};
