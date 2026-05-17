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
    const points = computePoints(perServing);

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
