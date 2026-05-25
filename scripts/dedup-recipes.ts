/**
 * Find and merge duplicate recipes.
 *
 * The unique constraints on `slug` and `source_url` already prevent the
 * "exact same row" case. What we hunt here are recipes that arrived from
 * the scraper with subtly different slugs but the same human-facing name
 * (typos, accent variations, URL rewrites on amandinecooking.com). Those
 * end up as 2 distinct rows in the DB and pollute the listing.
 *
 * Strategy
 * --------
 * - Normalize each `nameFr` (lowercase, strip accents, collapse spaces).
 * - Group by normalized name. Any group with ≥ 2 rows is a candidate.
 * - The KEEPER is the row with the earliest `created_at` (the one we
 *   inserted first — preserves stable URLs and shopping-list links).
 * - The DUPLICATES are deleted. The cascade on `recipe_ingredients`,
 *   `recipe_tags`, `recipe_categories` does the cleanup.
 * - Anything pointing AT a duplicate via `menu_slots.recipe_id` is
 *   re-pointed to the keeper before deletion so user menus don't break.
 *
 * Flags
 * -----
 *   --dry         List duplicates, change nothing (default).
 *   --apply       Actually merge + delete.
 *
 *   npx tsx scripts/dedup-recipes.ts
 *   npx tsx scripts/dedup-recipes.ts --apply
 */
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq, inArray } from 'drizzle-orm';
import * as schema from '../src/lib/server/db/schema';

const apply = process.argv.includes('--apply');

const client = createClient({ url: 'file:./data/local.db' });
const db = drizzle(client, { schema });
const { recipes, menuSlots } = schema;

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

type Row = {
  id: number;
  slug: string;
  nameFr: string;
  createdAt: Date | number | null;
};

const rows = (await db
  .select({
    id: recipes.id,
    slug: recipes.slug,
    nameFr: recipes.nameFr,
    createdAt: recipes.createdAt
  })
  .from(recipes)) as Row[];

console.log(`Loaded ${rows.length} recipes.`);

const groups = new Map<string, Row[]>();
for (const r of rows) {
  const key = normalize(r.nameFr);
  const list = groups.get(key) ?? [];
  list.push(r);
  groups.set(key, list);
}

const ts = (v: Date | number | null): number => {
  if (v == null) return Infinity;
  if (v instanceof Date) return v.getTime();
  return v * 1000; // libsql returns epoch seconds when stored as integer
};

const dupGroups: Array<{ keeper: Row; drop: Row[] }> = [];
for (const list of groups.values()) {
  if (list.length < 2) continue;
  // Earliest createdAt wins. Tie-break on lowest id (= scraped first).
  list.sort((a, b) => {
    const d = ts(a.createdAt) - ts(b.createdAt);
    return d !== 0 ? d : a.id - b.id;
  });
  dupGroups.push({ keeper: list[0]!, drop: list.slice(1) });
}

if (dupGroups.length === 0) {
  console.log('✅ No duplicates found.');
  process.exit(0);
}

console.log(`\nFound ${dupGroups.length} duplicate groups:\n`);
let dupRowCount = 0;
for (const g of dupGroups) {
  console.log(`  Keep  #${g.keeper.id.toString().padStart(4)}  ${g.keeper.nameFr}`);
  for (const d of g.drop) {
    console.log(`  Drop  #${d.id.toString().padStart(4)}  ${d.nameFr}   (slug=${d.slug})`);
    dupRowCount++;
  }
  console.log();
}
console.log(`Total recipes to delete: ${dupRowCount}.`);

if (!apply) {
  console.log('\nDry run — re-run with --apply to perform the merge.');
  process.exit(0);
}

// --- Apply ---------------------------------------------------------------

console.log('\nApplying merge...');

for (const g of dupGroups) {
  const dropIds = g.drop.map((d) => d.id);

  // Re-point any menu slot from a duplicate to the keeper. Otherwise the
  // FK delete would clobber them (recipeId is nullable, but we'd rather
  // preserve the link).
  await db
    .update(menuSlots)
    .set({ recipeId: g.keeper.id })
    .where(inArray(menuSlots.recipeId, dropIds));

  // Cascade handles recipe_ingredients, recipe_tags, recipe_categories.
  await db.delete(recipes).where(inArray(recipes.id, dropIds));

  console.log(`  ✓ Merged ${dropIds.length} → #${g.keeper.id} (${g.keeper.nameFr})`);
}

console.log(`\n✅ Deleted ${dupRowCount} duplicate rows.`);
process.exit(0);
