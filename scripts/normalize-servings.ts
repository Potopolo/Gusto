/**
 * Post-process recipes where `servings = 1` and the unit is a
 * "shareable container" word (cake, brioche, tarte, gâteau, gratin,
 * litre…) — those values mean "1 whole cake" not "1 portion". The
 * compute:nutrition step has already produced a per-WHOLE points
 * count for them, so we apply a sensible default number of parts
 * and divide.
 *
 * Idempotent: a recipe is only rewritten if its current servings is
 * still 1 AND its unit matches the shareable set.
 */
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import * as schema from '../src/lib/server/db/schema';

const client = createClient({ url: 'file:./data/local.db' });
const db = drizzle(client, { schema });

/** Map a shareable unit → default number of parts when servings is missing. */
const DEFAULT_PARTS_BY_UNIT: Array<[RegExp, number, string]> = [
  [/^brioches?$/i, 8, 'parts'],
  [/^cakes?$/i, 8, 'parts'],
  [/^g[âa]teaux?$/i, 8, 'parts'],
  [/^tartes?$/i, 8, 'parts'],
  [/^tartelettes?$/i, 1, 'tartelette'],
  [/^tourtes?$/i, 8, 'parts'],
  [/^quiches?$/i, 8, 'parts'],
  [/^kouglofs?$/i, 8, 'parts'],
  [/^cheesecakes?$/i, 10, 'parts'],
  [/^bavarois$/i, 10, 'parts'],
  [/^charlottes?$/i, 8, 'parts'],
  [/^bûches?$/i, 8, 'parts'],
  [/^pizzas?$/i, 4, 'parts'],
  [/^tortipizza$/i, 4, 'parts'],
  [/^tortillas?$/i, 4, 'parts'],
  [/^gratins?$/i, 4, 'personnes'],
  [/^tartiflettes?$/i, 4, 'personnes'],
  [/^l(itres?)?$/i, 6, 'boules'],
  [/^cocottes?$/i, 4, 'personnes'],
  [/^bowlcakes?$/i, 1, 'bowlcake'],
  [/^bols?$/i, 1, 'bol'],
  [/^pots?$/i, 1, 'pot'],
  [/^verres?$/i, 1, 'verre']
];

async function main() {
  const { recipes } = schema;
  const candidates = await db
    .select({
      id: recipes.id,
      nameFr: recipes.nameFr,
      servings: recipes.servings,
      servingsUnit: recipes.servingsUnit,
      pointsPerServing: recipes.pointsPerServing
    })
    .from(recipes);

  let updated = 0;
  for (const r of candidates) {
    if (r.servings !== 1) continue;
    const unit = (r.servingsUnit ?? '').trim();
    if (!unit) continue;

    let matched: { parts: number; normalizedUnit: string } | null = null;
    for (const [re, parts, normalizedUnit] of DEFAULT_PARTS_BY_UNIT) {
      if (re.test(unit)) {
        matched = { parts, normalizedUnit };
        break;
      }
    }
    if (!matched || matched.parts === 1) continue;

    const newPoints =
      r.pointsPerServing != null
        ? Math.max(2, Math.round(r.pointsPerServing / matched.parts))
        : null;

    await db
      .update(recipes)
      .set({
        servings: matched.parts,
        servingsUnit: matched.normalizedUnit,
        pointsPerServing: newPoints
      })
      .where(eq(recipes.id, r.id));
    updated++;
  }
  console.log(`normalize-servings: updated ${updated} recipes.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
