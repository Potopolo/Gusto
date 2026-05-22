import { db } from '$lib/server/db';
import {
  recipes,
  recipeIngredients,
  recipeTags,
  recipeCategories,
  categories,
  favoriteRecipes,
  favoriteIngredients
} from '$lib/server/db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

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

  const ingredientsWithFav = ingredients.map((ri) => ({
    ...ri,
    isFavorite: ri.ingredientId != null && ingFavSet.has(ri.ingredientId)
  }));

  // Drop the heavy raw HTML cache from client payload
  const { rawHtmlCache: _drop, ...recipeLight } = recipe;

  return {
    recipe: recipeLight,
    isFavorite: recipeFavorite,
    ingredients: ingredientsWithFav,
    tags: tagRows.map((t) => t.tag),
    categories: cats,
    matchStats: { matched: matchedIngs, total: totalIngs }
  };
};
