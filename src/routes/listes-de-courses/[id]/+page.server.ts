import { error, fail, type Actions } from '@sveltejs/kit';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
  menus,
  shoppingLists,
  shoppingListItems
} from '$lib/server/db/schema';
import { categorize, isShoppingCategory } from '$lib/shopping/categorize';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const listId = parseInt(params.id ?? "", 10);
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
    const listId = parseInt(params.id ?? "", 10);
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
  },

  /**
   * Add a manual item to a list. Used for both food and non-food (hygiène,
   * entretien). Category can be passed explicitly or left empty to auto-
   * detect from the item name.
   */
  addItem: async ({ request, params }) => {
    const listId = parseInt(params.id ?? "", 10);
    if (!Number.isFinite(listId)) return fail(404, { error: 'Liste introuvable.' });

    // Verify list exists before accepting writes
    const [list] = await db
      .select({ id: shoppingLists.id })
      .from(shoppingLists)
      .where(eq(shoppingLists.id, listId))
      .limit(1);
    if (!list) return fail(404, { error: 'Liste introuvable.' });

    const data = await request.formData();
    const name = ((data.get('name') ?? '').toString()).trim();
    if (!name) return fail(400, { error: 'Donne un nom à l’article.' });
    if (name.length > 120) return fail(400, { error: 'Nom trop long.' });

    const qtyRaw = (data.get('qty') ?? '').toString().trim().replace(',', '.');
    const qty = qtyRaw ? parseFloat(qtyRaw) : null;
    if (qty != null && (!Number.isFinite(qty) || qty < 0)) {
      return fail(400, { error: 'Quantité invalide.' });
    }

    const unit = ((data.get('unit') ?? '').toString()).trim().slice(0, 16) || null;

    const rawCat = (data.get('category') ?? '').toString();
    const category =
      rawCat && isShoppingCategory(rawCat) ? rawCat : categorize(name);

    // Append at the end of the list
    const [last] = await db
      .select({ position: shoppingListItems.position })
      .from(shoppingListItems)
      .where(eq(shoppingListItems.listId, listId))
      .orderBy(desc(shoppingListItems.position))
      .limit(1);

    await db.insert(shoppingListItems).values({
      listId,
      nameFr: name,
      qty,
      unit,
      category,
      isManual: true,
      position: (last?.position ?? -1) + 1
    });

    return { added: true };
  },

  /**
   * Toggle the is_checked flag on a single item. Used by the optimistic
   * client-side checkbox in the list view — the UI flips immediately, this
   * write is fire-and-forget, and a failure response rolls the UI back.
   */
  toggleItem: async ({ request, params }) => {
    const listId = parseInt(params.id ?? "", 10);
    if (!Number.isFinite(listId)) return fail(404, { error: 'Liste introuvable.' });

    const data = await request.formData();
    const itemId = parseInt((data.get('itemId') ?? '').toString(), 10);
    const checkedRaw = (data.get('checked') ?? '').toString();
    if (!Number.isFinite(itemId)) return fail(400, { error: 'Article invalide.' });
    if (checkedRaw !== '0' && checkedRaw !== '1') {
      return fail(400, { error: 'État invalide.' });
    }

    await db
      .update(shoppingListItems)
      .set({ isChecked: checkedRaw === '1' })
      .where(
        and(
          eq(shoppingListItems.id, itemId),
          eq(shoppingListItems.listId, listId)
        )
      );

    return { toggled: true, checked: checkedRaw === '1' };
  }
};
