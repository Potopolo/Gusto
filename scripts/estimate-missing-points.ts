/**
 * Backfill points_per_serving for recipes that compute:nutrition couldn't
 * resolve. Uses the rule-based estimator in src/lib/server/estimate-points.ts.
 */
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq, isNull } from 'drizzle-orm';
import * as schema from '../src/lib/server/db/schema';
import { estimatePoints } from '../src/lib/server/estimate-points';

const client = createClient({ url: 'file:./data/local.db' });
const db = drizzle(client, { schema });

async function main() {
  const { recipes, recipeCategories, categories } = schema;

  // Categories per recipe — used by the estimator's bucket-base lookup.
  const links = await db
    .select({ recipeId: recipeCategories.recipeId, slug: categories.slug })
    .from(recipeCategories)
    .innerJoin(categories, eq(recipeCategories.categoryId, categories.id));
  const slugsByRecipe = new Map<number, Set<string>>();
  for (const l of links) {
    const set = slugsByRecipe.get(l.recipeId) ?? new Set<string>();
    set.add(l.slug);
    slugsByRecipe.set(l.recipeId, set);
  }

  const missing = await db
    .select({ id: recipes.id, nameFr: recipes.nameFr })
    .from(recipes)
    .where(isNull(recipes.pointsPerServing));

  console.log(`${missing.length} recipes without points — running estimator...`);

  let updated = 0;
  const samples: Array<{ id: number; name: string; pts: number }> = [];
  for (const r of missing) {
    const slugs = slugsByRecipe.get(r.id) ?? new Set<string>();
    const pts = estimatePoints(r.nameFr, slugs);
    await db.update(recipes).set({ pointsPerServing: pts }).where(eq(recipes.id, r.id));
    updated++;
    if (samples.length < 12) samples.push({ id: r.id, name: r.nameFr.slice(0, 60), pts });
  }

  console.log(`Updated ${updated} recipes with estimated points.`);
  console.log('Sample estimates:');
  for (const s of samples) console.log(`  ${s.pts.toString().padStart(2)} pts — ${s.name}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
