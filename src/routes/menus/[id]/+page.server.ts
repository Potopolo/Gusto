import { error } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { menus, menuSlots, recipes } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const menuId = parseInt(params.id, 10);
  if (!Number.isFinite(menuId)) throw error(404, 'Menu introuvable');

  const [menu] = await db.select().from(menus).where(eq(menus.id, menuId)).limit(1);
  if (!menu) throw error(404, 'Menu introuvable');

  const rows = await db
    .select({
      slot: menuSlots,
      recipe: {
        id: recipes.id,
        slug: recipes.slug,
        nameFr: recipes.nameFr,
        photoUrl: recipes.photoUrl,
        servings: recipes.servings,
        servingsUnit: recipes.servingsUnit,
        pointsPerServing: recipes.pointsPerServing,
        prepMinutes: recipes.prepMinutes
      }
    })
    .from(menuSlots)
    .leftJoin(recipes, eq(menuSlots.recipeId, recipes.id))
    .where(eq(menuSlots.menuId, menuId))
    .orderBy(asc(menuSlots.position));

  return { menu, slots: rows };
};
