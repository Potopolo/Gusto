/**
 * Compute aggregate nutrition + points for every recipe in the database.
 * Re-runs are safe — overwrites previous values.
 */

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import {
  recipes,
  recipeIngredients,
  ingredients,
  type NutritionPer100g
} from '../db/schema';
import {
  toGrams,
  nutritionForGrams,
  addNutrition,
  divideNutrition,
  computePoints,
  ZERO_NUTRITION
} from './nutrition';
import { isFreeIngredient } from '../ww/lookup';

async function main() {
  const url = process.env.LIBSQL_URL ?? 'file:./data/local.db';
  const authToken = process.env.LIBSQL_AUTH_TOKEN;
  const client = createClient({ url, authToken });
  const db = drizzle(client);

  console.log('Chargement des recettes...');
  const allRecipes = await db.select().from(recipes);
  console.log(`  → ${allRecipes.length} recettes`);

  let computed = 0;
  let skipped = 0;

  for (const recipe of allRecipes) {
    const rows = await db
      .select({
        ri: recipeIngredients,
        ing: ingredients
      })
      .from(recipeIngredients)
      .leftJoin(ingredients, eq(recipeIngredients.ingredientId, ingredients.id))
      .where(eq(recipeIngredients.recipeId, recipe.id));

    if (rows.length === 0 || !recipe.servings || recipe.servings < 1) {
      await db
        .update(recipes)
        .set({ nutritionPerServing: null, pointsPerServing: null })
        .where(eq(recipes.id, recipe.id));
      skipped++;
      continue;
    }

    let total: NutritionPer100g = { ...ZERO_NUTRITION };
    let matchedIngredients = 0;
    let totalIngredients = 0;

    for (const { ri, ing } of rows) {
      totalIngredients++;
      if (!ing?.nutritionPer100g) continue;
      const grams = toGrams(ri.quantity, ri.unit);
      if (grams === null || grams <= 0) continue;
      total = addNutrition(total, nutritionForGrams(ing.nutritionPer100g, grams));
      matchedIngredients++;
    }

    // If almost nothing was matched, skip — points would be meaningless
    if (matchedIngredients === 0 || matchedIngredients / totalIngredients < 0.5) {
      await db
        .update(recipes)
        .set({ nutritionPerServing: null, pointsPerServing: null })
        .where(eq(recipes.id, recipe.id));
      skipped++;
      continue;
    }

    const perServing = divideNutrition(total, recipe.servings);
    let points: number | null = computePoints(perServing);

    // WW override — if every ingredient (canonical name or raw text) is
    // either a ZeroPoints food or a neutral seasoning, the recipe itself
    // is 0 pts. We check BOTH the canonical CIQUAL name (when present)
    // AND the raw recipe text, because a wrong CIQUAL match can produce
    // a "Saucisson sec" canonical for a "Chocolat" raw — relying on the
    // canonical alone would give false positives.
    const allFree = rows.every(({ ri, ing }) => {
      if (ing?.nameFr && !isFreeIngredient(ing.nameFr)) return false;
      if (!isFreeIngredient(ri.rawText)) return false;
      return true;
    });

    if (allFree) {
      points = 0;
    } else if (points === 0 && perServing.kcal < 50) {
      // Safe guard: the formula returned 0 but the aggregated nutrition
      // is implausibly low (< 50 kcal/portion) AND the WW override didn't
      // validate. This usually means the parser missed ingredients
      // (sucre, beurre, chocolat…) or CIQUAL made a wrong match. Rather
      // than publish a misleading "0 pts" badge, mark it as unknown so
      // estimate-missing-points.ts can take over with a rule-based guess.
      // 50 kcal is a deliberately low bar — a genuine ZeroPoints salade
      // de concombre still clears it easily (~70-90 kcal/portion).
      points = null;
    } else if (points === 0 && rows.length < 3) {
      // Same idea: a recipe with fewer than 3 parsed ingredients is
      // almost certainly a parse miss when it isn't ZP-validated.
      points = null;
    }

    await db
      .update(recipes)
      .set({
        nutritionPerServing: {
          ...total,
          servings: recipe.servings,
          per_serving: perServing
        },
        pointsPerServing: points
      })
      .where(eq(recipes.id, recipe.id));

    computed++;
  }

  console.log(`\n— Calcul terminé —`);
  console.log(`  Calculées:  ${computed}`);
  console.log(`  Sans data:  ${skipped} (servings manquant ou <50% matchés)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
