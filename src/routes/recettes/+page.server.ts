import { db } from '$lib/server/db';
import {
  recipes,
  recipeCategories,
  categories,
  favoriteRecipes
} from '$lib/server/db/schema';
import { and, between, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { INTENSITY_LEVELS, isIntensitySlug } from '$lib/intensity';
import type { PageServerLoad } from './$types';

export type RecipeListItem = {
  id: number;
  slug: string;
  nameFr: string;
  photoUrl: string | null;
  servings: number | null;
  servingsUnit: string | null;
  pointsPerServing: number | null;
  prepMinutes: number | null;
  categories: Array<{ slug: string; nameFr: string; kind: string }>;
  isFavorite: boolean;
};

export type CategoryPill = {
  slug: string;
  nameFr: string;
  kind: string;
  count: number;
};

export type PillGroup = {
  kind: string;
  labelFr: string;
  pills: CategoryPill[];
};

const KIND_ORDER = ['temps', 'régime', 'type', 'saison', 'équipement'] as const;
const KIND_LABELS: Record<string, string> = {
  temps: 'Temps',
  régime: 'Régime',
  type: 'Type',
  saison: 'Saison',
  équipement: 'Équipement'
};

/** Parse `?cats=a,b,c` (preferred) or legacy `?cat=a` into a deduped slug array. */
function parseCatsParam(url: URL): string[] {
  const out = new Set<string>();
  const raw = url.searchParams.get('cats') ?? url.searchParams.get('cat') ?? '';
  for (const s of raw.split(',')) {
    const trimmed = s.trim();
    if (trimmed) out.add(trimmed);
  }
  return Array.from(out);
}

const SEASON_BY_MONTH: Record<number, string> = {
  3: 'printemps', 4: 'printemps', 5: 'printemps',
  6: 'ete',       7: 'ete',       8: 'ete',
  9: 'automne',   10: 'automne',  11: 'automne',
  12: 'hiver',    1: 'hiver',     2: 'hiver'
};

export const load: PageServerLoad = async ({ url, locals }) => {
  const q = (url.searchParams.get('q') ?? '').trim();
  let selectedCats = parseCatsParam(url);

  // Fresh visit (no query at all) → pre-select the current season. The
  // user can deselect via Effacer which sets ?cats= explicitly.
  const isFreshVisit = !url.searchParams.has('cats') && !url.searchParams.has('cat') && !url.searchParams.has('q');
  if (isFreshVisit) {
    const currentSeason = SEASON_BY_MONTH[new Date().getMonth() + 1];
    if (currentSeason) selectedCats = [currentSeason];
  }
  const userId = locals.currentUser?.id ?? null;

  // Split selected slugs: real DB categories vs virtual intensity buckets.
  const selectedIntensities = selectedCats.filter(isIntensitySlug);
  const realSelectedCats = selectedCats.filter((s) => !isIntensitySlug(s));

  // 1) For multi-category AND filter: get recipe IDs that match EVERY real slug
  let recipeIdsForCats: number[] | null = null;
  if (realSelectedCats.length > 0) {
    const matchingRows = await db
      .select({
        recipeId: recipeCategories.recipeId,
        slugMatched: categories.slug
      })
      .from(recipeCategories)
      .innerJoin(categories, eq(recipeCategories.categoryId, categories.id))
      .where(inArray(categories.slug, realSelectedCats));

    // Count distinct matched slugs per recipe
    const slugsByRecipe = new Map<number, Set<string>>();
    for (const r of matchingRows) {
      const set = slugsByRecipe.get(r.recipeId) ?? new Set<string>();
      set.add(r.slugMatched);
      slugsByRecipe.set(r.recipeId, set);
    }
    recipeIdsForCats = [];
    for (const [recipeId, slugs] of slugsByRecipe) {
      if (slugs.size === realSelectedCats.length) recipeIdsForCats.push(recipeId);
    }
    if (recipeIdsForCats.length === 0) recipeIdsForCats = [-1];
  }

  // Intensity buckets → OR of point-range predicates
  const intensityRangePredicate =
    selectedIntensities.length > 0
      ? or(
          ...selectedIntensities.map((slug) => {
            const lvl = INTENSITY_LEVELS.find((l) => l.slug === slug)!;
            return between(recipes.pointsPerServing, lvl.min, lvl.max);
          })
        )
      : undefined;

  // 2) Build the recipe query with combined filters
  const conditions = [
    q ? like(recipes.nameFr, `%${q}%`) : undefined,
    recipeIdsForCats ? inArray(recipes.id, recipeIdsForCats) : undefined,
    intensityRangePredicate
  ].filter(Boolean);

  const whereClause =
    conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);

  const rows = await db
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
    .from(recipes)
    .where(whereClause)
    .orderBy(desc(recipes.fetchedAt));

  // 3) Fetch categories per recipe (for chips on cards)
  const ids = rows.map((r) => r.id);
  const catRows = ids.length
    ? await db
        .select({
          recipeId: recipeCategories.recipeId,
          slug: categories.slug,
          nameFr: categories.nameFr,
          kind: categories.kind
        })
        .from(recipeCategories)
        .innerJoin(categories, eq(recipeCategories.categoryId, categories.id))
        .where(inArray(recipeCategories.recipeId, ids))
    : [];

  const catsByRecipe = new Map<number, RecipeListItem['categories']>();
  for (const c of catRows) {
    const list = catsByRecipe.get(c.recipeId) ?? [];
    list.push({ slug: c.slug, nameFr: c.nameFr, kind: c.kind });
    catsByRecipe.set(c.recipeId, list);
  }

  // Pull favorite recipe IDs for the current user once, in O(1) per card
  const favSet = new Set<number>();
  if (userId != null && rows.length > 0) {
    const favRows = await db
      .select({ recipeId: favoriteRecipes.recipeId })
      .from(favoriteRecipes)
      .where(
        and(
          eq(favoriteRecipes.userId, userId),
          inArray(favoriteRecipes.recipeId, rows.map((r) => r.id))
        )
      );
    for (const f of favRows) favSet.add(f.recipeId);
  }

  const list: RecipeListItem[] = rows.map((r) => ({
    ...r,
    categories: catsByRecipe.get(r.id) ?? [],
    isFavorite: favSet.has(r.id)
  }));

  // 4) Pills with counts — only categories with at least one recipe in DB
  const pillRows = await db
    .select({
      slug: categories.slug,
      nameFr: categories.nameFr,
      kind: categories.kind,
      count: sql<number>`count(${recipeCategories.recipeId})`
    })
    .from(categories)
    .innerJoin(recipeCategories, eq(recipeCategories.categoryId, categories.id))
    .groupBy(categories.id, categories.slug, categories.nameFr, categories.kind)
    .orderBy(sql`count(${recipeCategories.recipeId}) desc`);

  const allPills: CategoryPill[] = pillRows.map((r) => ({
    slug: r.slug,
    nameFr: r.nameFr,
    kind: r.kind,
    count: Number(r.count)
  }));

  const groupedPills: PillGroup[] = KIND_ORDER.map((kind) => ({
    kind,
    labelFr: KIND_LABELS[kind] ?? kind,
    pills: allPills.filter((p) => p.kind === kind)
  })).filter((g) => g.pills.length > 0);

  // Intensity pills — counts derived from points_per_serving on the recipes table.
  // These are a virtual filter dimension, not real categories.
  const intensityCountsRows = await db
    .select({
      pts: recipes.pointsPerServing,
      n: sql<number>`count(*)`
    })
    .from(recipes)
    .where(sql`${recipes.pointsPerServing} IS NOT NULL`)
    .groupBy(recipes.pointsPerServing);
  const ptsCount = new Map<number, number>();
  for (const r of intensityCountsRows) {
    if (r.pts != null) ptsCount.set(r.pts, Number(r.n));
  }
  const intensityPills = INTENSITY_LEVELS.map((lvl) => {
    let count = 0;
    for (const [pts, n] of ptsCount) {
      if (pts >= lvl.min && pts <= lvl.max) count += n;
    }
    return { slug: lvl.slug, label: lvl.label, count };
  });

  return { recipes: list, q, selectedCats, groupedPills, intensityPills };
};
