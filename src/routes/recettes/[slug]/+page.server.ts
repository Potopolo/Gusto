import { db } from '$lib/server/db';
import {
  recipes,
  recipeIngredients,
  recipeTags,
  recipeCategories,
  categories
} from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const [recipe] = await db
    .select()
    .from(recipes)
    .where(eq(recipes.slug, params.slug))
    .limit(1);

  if (!recipe) throw error(404, 'Recette introuvable');

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

  // Drop the heavy raw HTML cache from client payload
  const { rawHtmlCache: _drop, ...recipeLight } = recipe;

  return {
    recipe: recipeLight,
    ingredients,
    tags: tagRows.map((t) => t.tag),
    categories: cats,
    matchStats: { matched: matchedIngs, total: totalIngs }
  };
};
