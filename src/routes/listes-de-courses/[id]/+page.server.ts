import { error, fail, type Actions } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
  menus,
  shoppingLists,
  shoppingListItems
} from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const listId = parseInt(params.id, 10);
  if (!Number.isFinite(listId)) throw error(404, 'Liste introuvable');

  const [list] = await db
    .select({
      id: shoppingLists.id,
      name: shoppingLists.name,
      createdAt: shoppingLists.createdAt,
      menuId: shoppingLists.menuId,
      menuName: menus.name
    })
    .from(shoppingLists)
    .leftJoin(menus, eq(menus.id, shoppingLists.menuId))
    .where(eq(shoppingLists.id, listId))
    .limit(1);
  if (!list) throw error(404, 'Liste introuvable');

  const items = await db
    .select()
    .from(shoppingListItems)
    .where(eq(shoppingListItems.listId, listId))
    .orderBy(asc(shoppingListItems.position));

  return { list, items };
};

export const actions: Actions = {
  /** Remove a single item. Verifies the item belongs to the URL's list. */
  removeItem: async ({ request, params }) => {
    const listId = parseInt(params.id, 10);
    if (!Number.isFinite(listId)) return fail(404, { error: 'Liste introuvable.' });

    const data = await request.formData();
    const itemId = parseInt((data.get('itemId') ?? '').toString(), 10);
    if (!Number.isFinite(itemId)) return fail(400, { error: 'Article invalide.' });

    await db
      .delete(shoppingListItems)
      .where(
        and(
          eq(shoppingListItems.id, itemId),
          eq(shoppingListItems.listId, listId)
        )
      );

    return { removed: true };
  }
};
