/**
 * Backfill the per-serving nutrition + point count for every
 * fourchette-et-bikini recipe by re-parsing the JSON-LD block embedded
 * in `recipes.rawHtmlCache`. Fourchette publishes per-portion energy,
 * fat, sat-fat, carbs, sugar, fiber, protein and sodium — way more
 * reliable than our CIQUAL ingredient matching for that site, since
 * CIQUAL barely finds anything in their ingredient names.
 *
 * Idempotent — re-running over the same data overwrites the same values.
 *
 *   npx tsx scripts/backfill-fourchette-nutrition.ts
 *   npx tsx scripts/backfill-fourchette-nutrition.ts --dry
 */
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq, like, isNotNull, and } from 'drizzle-orm';
import * as schema from '../src/lib/server/db/schema';
import { computePoints } from '../src/lib/server/ciqual/nutrition';
import type { NutritionPer100g } from '../src/lib/server/db/schema';

const dry = process.argv.includes('--dry');

const client = createClient({ url: 'file:./data/local.db' });
const db = drizzle(client, { schema });

type LdNutrition = {
  calories?: string | number;
  fatContent?: string | number;
  saturatedFatContent?: string | number;
  carbohydrateContent?: string | number;
  sugarContent?: string | number;
  fiberContent?: string | number;
  proteinContent?: string | number;
  sodiumContent?: string | number;
};

type LdRecipe = {
  '@type'?: string | string[];
  nutrition?: LdNutrition;
};

/** Locate the first object with @type containing "Recipe" inside a JSON-LD
 *  block, walking @graph entries. */
function findRecipeLd(html: string): LdRecipe | null {
  const blocks = html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const m of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[1] ?? '');
    } catch {
      continue;
    }
    const candidates: unknown[] = [];
    const flatten = (v: unknown) => {
      if (!v) return;
      if (Array.isArray(v)) {
        v.forEach(flatten);
        return;
      }
      if (typeof v === 'object') {
        const obj = v as Record<string, unknown>;
        if ('@graph' in obj && Array.isArray(obj['@graph'])) {
          (obj['@graph'] as unknown[]).forEach(flatten);
        }
        candidates.push(obj);
      }
    };
    flatten(parsed);
    for (const c of candidates) {
      const obj = c as LdRecipe;
      const t = obj['@type'];
      const types = Array.isArray(t) ? t : [t];
      if (types.some((x) => typeof x === 'string' && /recipe/i.test(x))) {
        return obj;
      }
    }
  }
  return null;
}

/** Lenient parse — schema.org strings are like "55", "55 kcal", "2.9 g". */
function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v);
  const m = s.replace(',', '.').match(/-?\d+(\.\d+)?/);
  if (!m) return 0;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? n : 0;
}

/** Convert sodium (mg) → salt (g): 1 g salt = 0.4 g sodium = 400 mg sodium. */
function sodiumToSaltG(sodiumStr: unknown): number {
  // Fourchette publishes sodium in grams already in their LD, e.g. "0.05".
  // We multiply by 2.5 to get salt equivalent in g (NaCl ratio).
  return num(sodiumStr) * 2.5;
}

const rows = await db
  .select({
    id: schema.recipes.id,
    name: schema.recipes.nameFr,
    servings: schema.recipes.servings,
    html: schema.recipes.rawHtmlCache,
    currentNutrition: schema.recipes.nutritionPerServing,
    currentPoints: schema.recipes.pointsPerServing
  })
  .from(schema.recipes)
  .where(
    and(
      like(schema.recipes.sourceUrl, '%fourchette-et-bikini%'),
      isNotNull(schema.recipes.rawHtmlCache)
    )
  );

console.log(`Inspecting ${rows.length} fourchette recipes...\n`);

let withNutrition = 0;
let recomputed = 0;
let skipped = 0;
let no_ld = 0;

for (const r of rows) {
  if (!r.html) {
    skipped++;
    continue;
  }
  const ld = findRecipeLd(r.html);
  const nut = ld?.nutrition;
  if (!nut || nut.calories == null) {
    no_ld++;
    continue;
  }

  // Build a per-100g-shaped object that computePoints can consume. The
  // values from fourchette are per portion already, not per 100g — that's
  // fine because computePoints is unit-agnostic, it treats whichever scale
  // we give it as "one input". We feed it the per-serving numbers and
  // store them under `per_serving` for the UI badge.
  const perServing: NutritionPer100g = {
    kcal: num(nut.calories),
    protein_g: num(nut.proteinContent),
    fat_g: num(nut.fatContent),
    sat_fat_g: num(nut.saturatedFatContent),
    carbs_g: num(nut.carbohydrateContent),
    sugar_g: num(nut.sugarContent),
    fiber_g: num(nut.fiberContent),
    salt_g: sodiumToSaltG(nut.sodiumContent)
  };
  const points = computePoints(perServing);

  const servings = r.servings ?? 1;
  const totals: NutritionPer100g = {
    kcal: perServing.kcal * servings,
    protein_g: perServing.protein_g * servings,
    fat_g: perServing.fat_g * servings,
    sat_fat_g: perServing.sat_fat_g * servings,
    carbs_g: perServing.carbs_g * servings,
    sugar_g: perServing.sugar_g * servings,
    fiber_g: perServing.fiber_g * servings,
    salt_g: perServing.salt_g * servings
  };

  withNutrition++;
  if (dry) {
    if (recomputed < 10) {
      console.log(
        `  #${r.id} ${r.name.slice(0, 50).padEnd(50)} ` +
          `${Math.round(perServing.kcal)}kcal/p → ${points} pts ` +
          `(was ${r.currentPoints})`
      );
    }
    recomputed++;
    continue;
  }

  await db
    .update(schema.recipes)
    .set({
      nutritionPerServing: {
        ...totals,
        servings,
        per_serving: perServing
      },
      pointsPerServing: points
    })
    .where(eq(schema.recipes.id, r.id));
  recomputed++;
  if (recomputed % 50 === 0) console.log(`  ${recomputed} done...`);
}

console.log(`\n— ${dry ? 'Dry run' : 'Done'} —`);
console.log(`  Had a usable LD nutrition block: ${withNutrition}`);
console.log(`  Recipes recomputed:              ${recomputed}`);
console.log(`  No LD nutrition (skipped):       ${no_ld}`);
console.log(`  Empty cache (skipped):           ${skipped}`);
