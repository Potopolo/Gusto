import { db } from '$lib/server/db';
import {
  recipes,
  recipeIngredients,
  recipeTags,
  recipeCategories,
  categories,
  favoriteRecipes,
  favoriteIngredients,
  ingredients as ingredientsTable,
  menus,
  menuSlots
} from '$lib/server/db/schema';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { error, fail, type Actions } from '@sveltejs/kit';
import { findZeroPointsEntry } from '$lib/server/ww/lookup';
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

export const load: PageServerLoad = async ({ params, locals }) => {
  const [recipe] = await db
    .select()
    .from(recipes)
    .where(eq(recipes.slug, params.slug))
    .limit(1);

  if (!recipe) throw error(404, 'Recette introuvable');

  const userId = locals.currentUser?.id ?? null;

  const ingredients = await db
    .select()
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipeId, recipe.id))
    .orderBy(recipeIngredients.position);

  // Match rate: how many ingredients are linked to a CIQUAL entry with usable data
  const totalIngs = ingredients.length;
  const matchedIngs = ingredients.filter((ri) => ri.ingredientId !== null).length;

  const tagRows = await db
    .select()
    .from(recipeTags)
    .where(eq(recipeTags.recipeId, recipe.id));

  const cats = await db
    .select({
      slug: categories.slug,
      nameFr: categories.nameFr,
      kind: categories.kind
    })
    .from(recipeCategories)
    .innerJoin(categories, eq(recipeCategories.categoryId, categories.id))
    .where(eq(recipeCategories.recipeId, recipe.id));

  // Favorite status for the recipe itself + each linked ingredient
  let recipeFavorite = false;
  const ingFavSet = new Set<number>();
  if (userId != null) {
    const [r] = await db
      .select()
      .from(favoriteRecipes)
      .where(
        and(eq(favoriteRecipes.userId, userId), eq(favoriteRecipes.recipeId, recipe.id))
      )
      .limit(1);
    recipeFavorite = !!r;

    const linkedIds = ingredients
      .map((i) => i.ingredientId)
      .filter((id): id is number => id != null);
    if (linkedIds.length > 0) {
      const favs = await db
        .select({ ingredientId: favoriteIngredients.ingredientId })
        .from(favoriteIngredients)
        .where(
          and(
            eq(favoriteIngredients.userId, userId),
            inArray(favoriteIngredients.ingredientId, linkedIds)
          )
        );
      for (const f of favs) ingFavSet.add(f.ingredientId);
    }
  }

  // WW lookup — annotate each ingredient. We test the canonical name when
  // a CIQUAL link exists (more reliable) and fall back to the recipe's raw
  // text otherwise. Ingredients without any match are returned untouched.
  const canonicalIds = ingredients
    .map((i) => i.ingredientId)
    .filter((id): id is number => id != null);
  const canonicalNames = new Map<number, string>();
  if (canonicalIds.length > 0) {
    const rows = await db
      .select({ id: ingredientsTable.id, nameFr: ingredientsTable.nameFr })
      .from(ingredientsTable)
      .where(inArray(ingredientsTable.id, canonicalIds));
    for (const r of rows) canonicalNames.set(r.id, r.nameFr);
  }

  const ingredientsWithFav = ingredients.map((ri) => {
    const canonical =
      ri.ingredientId != null ? canonicalNames.get(ri.ingredientId) ?? null : null;
    const probe = canonical ?? ri.rawText;
    const ww = findZeroPointsEntry(probe);
    return {
      ...ri,
      isFavorite: ri.ingredientId != null && ingFavSet.has(ri.ingredientId),
      wwZero: ww !== null,
      wwName: ww?.name ?? null
    };
  });

  const wwZeroCount = ingredientsWithFav.filter((i) => i.wwZero).length;

  // Drop the heavy raw HTML cache from client payload
  const { rawHtmlCache: _drop, ...recipeLight } = recipe;

  // Active menus the user can add this recipe to (light shape for the modal)
  const userMenus = await db
    .select({
      id: menus.id,
      name: menus.name,
      startDate: menus.startDate,
      endDate: menus.endDate
    })
    .from(menus)
    .orderBy(desc(menus.startDate));

  return {
    recipe: recipeLight,
    isFavorite: recipeFavorite,
    ingredients: ingredientsWithFav,
    tags: tagRows.map((t) => t.tag),
    categories: cats,
    matchStats: { matched: matchedIngs, total: totalIngs },
    wwStats: { zeroCount: wwZeroCount, total: totalIngs },
    menus: userMenus
  };
};

export const actions: Actions = {
  /** Add this recipe as a new slot in an existing menu. */
  addToMenu: async ({ request, params, locals }) => {
    if (!locals.currentUser) return fail(401, { error: 'Non authentifié.' });

    const slug = params.slug ?? '';
    if (!slug) return fail(404, { error: 'Recette introuvable.' });
    const [recipe] = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(eq(recipes.slug, slug))
      .limit(1);
    if (!recipe) return fail(404, { error: 'Recette introuvable.' });

    const data = await request.formData();
    const menuId = parseInt((data.get('menuId') ?? '').toString(), 10);
    const dateStr = (data.get('date') ?? '').toString();
    const mealType = (data.get('mealType') ?? '').toString();
    const servings = Math.max(
      1,
      Math.min(50, parseInt((data.get('servings') ?? '2').toString(), 10) || 2)
    );

    if (!Number.isFinite(menuId)) return fail(400, { error: 'Menu invalide.' });
    if (!isValidMealType(mealType)) return fail(400, { error: 'Type de plat invalide.' });
    const date = new Date(dateStr + 'T00:00:00');
    if (!Number.isFinite(date.getTime())) return fail(400, { error: 'Date invalide.' });

    // Verify the menu exists
    const [menu] = await db.select().from(menus).where(eq(menus.id, menuId)).limit(1);
    if (!menu) return fail(404, { error: 'Menu introuvable.' });

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
      recipeId: recipe.id,
      servings,
      position: (last?.position ?? -1) + 1,
      isManual: true
    });

    return { addedToMenu: true, menuId };
  }
};
