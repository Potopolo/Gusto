import { db } from '$lib/server/db';
import {
  recipes,
  recipeCategories,
  categories,
  favoriteRecipes
} from '$lib/server/db/schema';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

const SEASON_BY_MONTH: Record<number, string> = {
  3: 'printemps',
  4: 'printemps',
  5: 'printemps',
  6: 'ete',
  7: 'ete',
  8: 'ete',
  9: 'automne',
  10: 'automne',
  11: 'automne',
  12: 'hiver',
  1: 'hiver',
  2: 'hiver'
};

/** Map a recipe to one of the suggestion buckets, or null if it shouldn't surface. */
type Bucket = 'plat' | 'apero' | 'dessert';
function bucketFromSlugs(slugs: Set<string>): Bucket | null {
  if (slugs.has('apero')) return 'apero';
  if (slugs.has('dessert') || slugs.has('gourmand')) return 'dessert';
  if (slugs.has('plat') || slugs.has('soupe') || slugs.has('salade')) return 'plat';
  // Non-classified recipes drop out — we surface only confident matches
  return null;
}

/** Mulberry32-ish pseudo-shuffle seeded by today's date so the
 *  selection stays stable through a session but rotates each day. */
function shuffleByDay<T>(arr: T[]): T[] {
  const day = new Date();
  let seed = day.getFullYear() * 10000 + (day.getMonth() + 1) * 100 + day.getDate();
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const load: PageServerLoad = async ({ locals }) => {
  const month = new Date().getMonth() + 1;
  const currentSeason = SEASON_BY_MONTH[month];

  // 1) Recipes tagged with the current season
  const inSeasonRows = await db
    .select({ recipeId: recipeCategories.recipeId })
    .from(recipeCategories)
    .innerJoin(categories, eq(recipeCategories.categoryId, categories.id))
    .where(eq(categories.slug, currentSeason));
  const inSeason = new Set(inSeasonRows.map((r) => r.recipeId));

  // 2) Recipes tagged with ANY season (so we can detect season-agnostic ones)
  const anySeasonRows = await db
    .select({ recipeId: recipeCategories.recipeId })
    .from(recipeCategories)
    .innerJoin(categories, eq(recipeCategories.categoryId, categories.id))
    .where(eq(categories.kind, 'saison'));
  const hasAnySeason = new Set(anySeasonRows.map((r) => r.recipeId));

  // 3) All category mappings — used to bucket recipes and to filter season
  const catLinks = await db
    .select({
      recipeId: recipeCategories.recipeId,
      slug: categories.slug
    })
    .from(recipeCategories)
    .innerJoin(categories, eq(recipeCategories.categoryId, categories.id));
  const slugsByRecipe = new Map<number, Set<string>>();
  for (const c of catLinks) {
    const set = slugsByRecipe.get(c.recipeId) ?? new Set<string>();
    set.add(c.slug);
    slugsByRecipe.set(c.recipeId, set);
  }

  // 4) Fetch all recipe rows (light fields), keep only season-compatible ones
  const allRows = await db
    .select({
      id: recipes.id,
      slug: recipes.slug,
      nameFr: recipes.nameFr,
      photoUrl: recipes.photoUrl,
      servings: recipes.servings,
      servingsUnit: recipes.servingsUnit,
      pointsPerServing: recipes.pointsPerServing,
      prepMinutes: recipes.prepMinutes
    })
    .from(recipes);

  // Some occasion categories (e.g. 'noel') are season-locked. Exclude recipes
  // tagged with an off-season occasion regardless of their season tags.
  const OFF_SEASON_OCCASIONS_FOR: Record<string, string[]> = {
    printemps: ['noel'],
    ete: ['noel'],
    automne: ['noel'],
    hiver: []
  };
  const offSeasonOccasions = new Set(OFF_SEASON_OCCASIONS_FOR[currentSeason] ?? []);
  const offSeasonRecipeIds = new Set<number>();
  if (offSeasonOccasions.size > 0) {
    for (const [recipeId, slugs] of slugsByRecipe) {
      for (const s of slugs) {
        if (offSeasonOccasions.has(s)) {
          offSeasonRecipeIds.add(recipeId);
          break;
        }
      }
    }
  }

  const seasonOk = (id: number) =>
    !offSeasonRecipeIds.has(id) && (inSeason.has(id) || !hasAnySeason.has(id));

  // 5) Bucket eligible recipes
  const buckets: Record<Bucket, typeof allRows> = { plat: [], apero: [], dessert: [] };
  for (const r of allRows) {
    if (!seasonOk(r.id)) continue;
    const slugs = slugsByRecipe.get(r.id) ?? new Set<string>();
    const b = bucketFromSlugs(slugs);
    if (b) buckets[b].push(r);
  }

  // 6) Pick a balanced sample (deterministic per-day)
  const PICK = { plat: 3, apero: 2, dessert: 2 } as const;
  const selected: Array<(typeof allRows)[number] & { bucket: Bucket }> = [];
  for (const b of ['plat', 'apero', 'dessert'] as Bucket[]) {
    const pool = shuffleByDay(buckets[b]);
    for (const r of pool.slice(0, PICK[b])) selected.push({ ...r, bucket: b });
  }

  // 7) Annotate with favorite state
  const userId = locals.currentUser?.id ?? null;
  const favSet = new Set<number>();
  if (userId != null && selected.length > 0) {
    const favRows = await db
      .select({ recipeId: favoriteRecipes.recipeId })
      .from(favoriteRecipes)
      .where(
        and(
          eq(favoriteRecipes.userId, userId),
          inArray(favoriteRecipes.recipeId, selected.map((r) => r.id))
        )
      );
    for (const f of favRows) favSet.add(f.recipeId);
  }

  return {
    suggestions: selected.map((r) => ({ ...r, isFavorite: favSet.has(r.id) })),
    season: currentSeason
  };
};
