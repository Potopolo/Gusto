import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { like, eq } from 'drizzle-orm';
import * as s from '../src/lib/server/db/schema';

const arg = process.argv[2] ?? '%légumes express%';
const client = createClient({ url: 'file:./data/local.db' });
const db = drizzle(client, { schema: s });

const rows = await db
  .select({
    id: s.recipes.id,
    name: s.recipes.nameFr,
    points: s.recipes.pointsPerServing,
    servings: s.recipes.servings,
    sourceUrl: s.recipes.sourceUrl,
    nutrition: s.recipes.nutritionPerServing
  })
  .from(s.recipes)
  .where(like(s.recipes.nameFr, arg))
  .limit(3);

for (const r of rows) {
  console.log(`#${r.id} ${r.name}`);
  console.log(`  source:   ${r.sourceUrl}`);
  console.log(`  servings: ${r.servings}`);
  console.log(`  points:   ${r.points}`);
  console.log(`  nutrition: ${r.nutrition ? 'YES' : 'no'}`);
  if (r.nutrition) {
    const ps = (r.nutrition as any).per_serving;
    if (ps) console.log(`    per_serving: kcal=${ps.kcal}, prot=${ps.protein_g}, fat=${ps.fat_g}, carbs=${ps.carbs_g}`);
  }

  const ings = await db
    .select({ ri: s.recipeIngredients, ing: s.ingredients })
    .from(s.recipeIngredients)
    .leftJoin(s.ingredients, eq(s.recipeIngredients.ingredientId, s.ingredients.id))
    .where(eq(s.recipeIngredients.recipeId, r.id));
  console.log(`  ingredients (${ings.length}, ${ings.filter((x) => x.ing != null).length} matched CIQUAL):`);
  for (const { ri, ing } of ings.slice(0, 12)) {
    console.log(`    - ${ri.rawText}  → CIQUAL: ${ing?.nameFr ?? '✗'}`);
  }
  console.log();
}
