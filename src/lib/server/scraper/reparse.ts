/**
 * Re-apply parseIngredient() to every recipe_ingredients row using rawText.
 * Useful after improving parse-ingredient.ts without re-fetching recipe pages.
 */

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { recipeIngredients } from '../db/schema';
import { parseIngredient } from './parse-ingredient';

async function main() {
  const url = process.env.LIBSQL_URL ?? 'file:./data/local.db';
  const authToken = process.env.LIBSQL_AUTH_TOKEN;
  const client = createClient({ url, authToken });
  const db = drizzle(client);

  console.log('Chargement des recipe_ingredients...');
  const rows = await db.select().from(recipeIngredients);
  console.log(`  → ${rows.length} lignes`);

  let changed = 0;
  for (const r of rows) {
    const parsed = parseIngredient(r.rawText);
    if (
      parsed.quantity === r.quantity &&
      parsed.unit === r.unit &&
      parsed.ingredientHint === r.ingredientHint
    ) {
      continue;
    }
    await db
      .update(recipeIngredients)
      .set({
        quantity: parsed.quantity,
        unit: parsed.unit,
        ingredientHint: parsed.ingredientHint
      })
      .where(eq(recipeIngredients.id, r.id));
    changed++;
  }

  console.log(`\nMis à jour: ${changed} / ${rows.length}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
