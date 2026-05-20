import { error } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
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
