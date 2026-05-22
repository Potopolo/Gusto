import { db } from '$lib/server/db';
import {
  recipes,
  recipeCategories,
  categories,
  favoriteRecipes
} from '$lib/server/db/schema';
import { and, desc, eq, inArray, like, sql } from 'drizzle-orm';
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

export const load: PageServerLoad = async ({ url, locals }) => {
  const q = (url.searchParams.get('q') ?? '').trim();
  const selectedCats = parseCatsParam(url);
  const userId = locals.currentUser?.id ?? null;

  // 1) For multi-category AND filter: get recipe IDs that match EVERY selected slug
  let recipeIdsForCats: number[] | null = null;
  if (selectedCats.length > 0) {
    const matchingRows = await db
      .select({
        recipeId: recipeCategories.recipeId,
        slugMatched: categories.slug
      })
      .from(recipeCategories)
      .innerJoin(categories, eq(recipeCategories.categoryId, categories.id))
      .where(inArray(categories.slug, selectedCats));

    // Count distinct matched slugs per recipe
    const slugsByRecipe = new Map<number, Set<string>>();
    for (const r of matchingRows) {
      const set = slugsByRecipe.get(r.recipeId) ?? new Set<string>();
      set.add(r.slugMatched);
      slugsByRecipe.set(r.recipeId, set);
    }
    recipeIdsForCats = [];
    for (const [recipeId, slugs] of slugsByRecipe) {
      if (slugs.size === selectedCats.length) recipeIdsForCats.push(recipeId);
    }
    if (recipeIdsForCats.length === 0) recipeIdsForCats = [-1];
  }

  // 2) Build the recipe query with combined filters
  const conditions = [
    q ? like(recipes.nameFr, `%${q}%`) : undefined,
    recipeIdsForCats ? inArray(recipes.id, recipeIdsForCats) : undefined
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

  return { recipes: list, q, selectedCats, groupedPills };
};
