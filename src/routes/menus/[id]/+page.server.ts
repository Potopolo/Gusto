import { error, fail, type Actions } from '@sveltejs/kit';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { menus, menuSlots, recipes } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

const ALLOWED_MEAL_TYPES = [
  'petit-déj',
  'déjeuner',
  'goûter',
  'apéro',
  'dîner',
  'dessert',
  'collation'
] as const;
type MealType = (typeof ALLOWED_MEAL_TYPES)[number];

function isValidMealType(s: string): s is MealType {
  return (ALLOWED_MEAL_TYPES as readonly string[]).includes(s);
}

async function recipeExists(id: number): Promise<boolean> {
  const found = await db.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, id)).limit(1);
  return !!found[0];
}

export const load: PageServerLoad = async ({ params }) => {
  const menuId = parseInt(params.id, 10);
  if (!Number.isFinite(menuId)) throw error(404, 'Menu introuvable');

  const [menu] = await db.select().from(menus).where(eq(menus.id, menuId)).limit(1);
  if (!menu) throw error(404, 'Menu introuvable');

  const slotRows = await db
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
    .orderBy(asc(menuSlots.date), asc(menuSlots.position));

  const allRecipes = await db
    .select({
      id: recipes.id,
      nameFr: recipes.nameFr,
      pointsPerServing: recipes.pointsPerServing
    })
    .from(recipes)
    .orderBy(asc(recipes.nameFr));

  return { menu, slots: slotRows, allRecipes };
};

export const actions: Actions = {
  add: async ({ request, params }) => {
    const menuId = parseInt(params.id, 10);
    if (!Number.isFinite(menuId)) return fail(404, { error: 'Menu introuvable.' });

    const data = await request.formData();
    const dateStr = (data.get('date') ?? '').toString();
    const mealType = (data.get('mealType') ?? '').toString();
    const recipeIdStr = (data.get('recipeId') ?? '').toString();
    const servings = Math.max(
      1,
      Math.min(50, parseInt((data.get('servings') ?? '2').toString(), 10) || 2)
    );

    const date = new Date(dateStr + 'T00:00:00');
    if (!Number.isFinite(date.getTime())) return fail(400, { error: 'Date invalide.' });
    if (!isValidMealType(mealType)) return fail(400, { error: 'Type de plat invalide.' });

    const recipeId = recipeIdStr ? parseInt(recipeIdStr, 10) : NaN;
    if (!Number.isFinite(recipeId)) return fail(400, { error: 'Choisis une recette.' });
    if (!(await recipeExists(recipeId))) return fail(400, { error: 'Recette introuvable.' });

    const [last] = await db
      .select({ position: menuSlots.position })
      .from(menuSlots)
      .where(eq(menuSlots.menuId, menuId))
      .orderBy(desc(menuSlots.position))
      .limit(1);

    await db.insert(menuSlots).values({
      menuId,
      date,
      mealType,
      recipeId,
      servings,
      position: (last?.position ?? -1) + 1
    });

    return { added: true };
  },

  update: async ({ request, params }) => {
    const menuId = parseInt(params.id, 10);
    if (!Number.isFinite(menuId)) return fail(404, { error: 'Menu introuvable.' });

    const data = await request.formData();
    const slotId = parseInt((data.get('slotId') ?? '').toString(), 10);
    const mealType = (data.get('mealType') ?? '').toString();
    const recipeIdStr = (data.get('recipeId') ?? '').toString();
    const servings = Math.max(
      1,
      Math.min(50, parseInt((data.get('servings') ?? '2').toString(), 10) || 2)
    );

    if (!Number.isFinite(slotId)) return fail(400, { error: 'Slot invalide.' });
    if (!isValidMealType(mealType)) return fail(400, { error: 'Type de plat invalide.' });

    const recipeId = recipeIdStr ? parseInt(recipeIdStr, 10) : NaN;
    if (!Number.isFinite(recipeId)) return fail(400, { error: 'Choisis une recette.' });
    if (!(await recipeExists(recipeId))) return fail(400, { error: 'Recette introuvable.' });

    await db
      .update(menuSlots)
      .set({ mealType, recipeId, servings })
      .where(and(eq(menuSlots.id, slotId), eq(menuSlots.menuId, menuId)));

    return { updated: true };
  },

  remove: async ({ request, params }) => {
    const menuId = parseInt(params.id, 10);
    if (!Number.isFinite(menuId)) return fail(404);
    const data = await request.formData();
    const slotId = parseInt((data.get('slotId') ?? '').toString(), 10);
    if (!Number.isFinite(slotId)) return fail(400);
    await db
      .delete(menuSlots)
      .where(and(eq(menuSlots.id, slotId), eq(menuSlots.menuId, menuId)));
    return { removed: true };
  }
};
