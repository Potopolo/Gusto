/**
 * Match every recipe_ingredients row to the best CIQUAL ingredient.
 * Idempotent: re-running overwrites previous matches.
 */

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { ingredients, recipeIngredients } from '../db/schema';
import { buildCandidate, findBestMatch } from './match';

const MIN_CONFIDENCE = 0.3;

async function main() {
  const url = process.env.LIBSQL_URL ?? 'file:./data/local.db';
  const authToken = process.env.LIBSQL_AUTH_TOKEN;
  const client = createClient({ url, authToken });
  const db = drizzle(client);

  console.log('Chargement des ingrédients CIQUAL...');
  const ciqualRows = await db
    .select({ id: ingredients.id, nameFr: ingredients.nameFr })
    .from(ingredients)
    .where(eq(ingredients.nutritionSource, 'ciqual'));
  console.log(`  → ${ciqualRows.length} candidats`);

  const candidates = ciqualRows.map((r) => buildCandidate(r.id, r.nameFr));

  console.log('Chargement des recipe_ingredients...');
  const recipeIngs = await db.select().from(recipeIngredients);
  console.log(`  → ${recipeIngs.length} à matcher`);

  let high = 0;
  let med = 0;
  let low = 0;
  let none = 0;

  for (const ri of recipeIngs) {
    const inputText = (ri.ingredientHint ?? ri.rawText ?? '').trim();
    const result = findBestMatch(inputText, candidates);

    if (result && result.score >= MIN_CONFIDENCE) {
      await db
        .update(recipeIngredients)
        .set({ ingredientId: result.candidate.id, matchConfidence: result.score })
        .where(eq(recipeIngredients.id, ri.id));
      if (result.score >= 0.7) high++;
      else if (result.score >= 0.5) med++;
      else low++;
    } else {
      await db
        .update(recipeIngredients)
        .set({ ingredientId: null, matchConfidence: result?.score ?? 0 })
        .where(eq(recipeIngredients.id, ri.id));
      none++;
    }
  }

  const total = recipeIngs.length;
  const matched = high + med + low;
  console.log(`\n— Matching terminé —`);
  console.log(`  Total:       ${total}`);
  console.log(`  Haute conf:  ${high}    (≥ 0,7)`);
  console.log(`  Moyenne:     ${med}    (0,5 – 0,7)`);
  console.log(`  Faible:      ${low}    (0,3 – 0,5)`);
  console.log(`  Non matchés: ${none}    (< 0,3)`);
  console.log(`  Taux match:  ${((matched / total) * 100).toFixed(1)} %`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
