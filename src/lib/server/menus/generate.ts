/**
 * Menu generation algorithm.
 *
 * For each (date × mealType) slot, pick a recipe such that:
 *  - it has computed points and they're under a per-meal budget
 *  - its season tag matches the start date's season, or it has no season tag
 *  - (future: matches owned equipment, dietary prefs)
 *  - it hasn't already been used in this generation (variety)
 */

import { and, eq, inArray, isNotNull, lte } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { recipes, recipeCategories, categories, profiles, recipeTags } from '$lib/server/db/schema';
import { SWEET_RE, isNotAMeal } from '$lib/menus/sweet';

const SEASON_BY_MONTH: Record<number, string> = {
  3: 'printemps', 4: 'printemps', 5: 'printemps',
  6: 'ete',       7: 'ete',       8: 'ete',
  9: 'automne',   10: 'automne',  11: 'automne',
  12: 'hiver',    1: 'hiver',     2: 'hiver'
};

export type GenerateOpts = {
  startDate: Date;
  days: number;
  mealsPerDay: string[];
  peopleCount: number;
  userId: number;
  householdId: number;
};

export type GeneratedSlot = {
  date: Date;
  mealType: string;
  recipeId: number | null;
  servings: number;
  position: number;
};

export async function generateMenu(opts: GenerateOpts): Promise<GeneratedSlot[]> {
  const { startDate, days, mealsPerDay, peopleCount, userId } = opts;

  // 1) Daily points budget → per-meal budget (with a margin)
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  const dailyTarget = profile?.dailyPointsTarget ?? 30;
  const maxPointsPerMeal = Math.max(8, Math.ceil(dailyTarget / mealsPerDay.length) + 3);

  // 2) Season filter — recipes tagged with the current season OR with no season at all
  const month = startDate.getMonth() + 1;
  const currentSeason = SEASON_BY_MONTH[month] ?? null;

  const currentSeasonRows = currentSeason
    ? await db
        .select({ recipeId: recipeCategories.recipeId })
        .from(recipeCategories)
        .innerJoin(categories, eq(recipeCategories.categoryId, categories.id))
        .where(eq(categories.slug, currentSeason))
    : [];
  const inCurrentSeason = new Set(currentSeasonRows.map((r) => r.recipeId));

  const anySeasonRows = await db
    .select({ recipeId: recipeCategories.recipeId })
    .from(recipeCategories)
    .innerJoin(categories, eq(recipeCategories.categoryId, categories.id))
    .where(eq(categories.kind, 'saison'));
  const hasAnySeason = new Set(anySeasonRows.map((r) => r.recipeId));

  // Season-locked occasions: 'noel' is winter-only — exclude from spring/summer/fall.
  const OFF_SEASON_OCCASIONS_FOR: Record<string, string[]> = {
    printemps: ['noel'],
    ete: ['noel'],
    automne: ['noel'],
    hiver: []
  };
  const offSlugs = OFF_SEASON_OCCASIONS_FOR[currentSeason ?? ''] ?? [];
  const offSeasonRecipeIds = new Set<number>();
  if (offSlugs.length > 0) {
    const rows = await db
      .select({ recipeId: recipeCategories.recipeId })
      .from(recipeCategories)
      .innerJoin(categories, eq(recipeCategories.categoryId, categories.id))
      .where(inArray(categories.slug, offSlugs));
    for (const r of rows) offSeasonRecipeIds.add(r.recipeId);
  }

  // 3) Eligible recipes by points
  const eligibleByPoints = await db
    .select({
      id: recipes.id,
      pointsPerServing: recipes.pointsPerServing
    })
    .from(recipes)
    .where(
      and(
        isNotNull(recipes.pointsPerServing),
        lte(recipes.pointsPerServing, maxPointsPerMeal)
      )
    );

  // 4a) Recipes tagged as dessert/apéro/goûter/petit-déj — excluded from main meals
  const NON_MAIN_SLUGS = ['dessert', 'gouter', 'apero', 'petit-dej', 'boisson'];
  const nonMainRows = await db
    .select({ recipeId: recipeCategories.recipeId })
    .from(recipeCategories)
    .innerJoin(categories, eq(recipeCategories.categoryId, categories.id))
    .where(inArray(categories.slug, NON_MAIN_SLUGS));
  const isNonMain = new Set<number>(nonMainRows.map((r) => r.recipeId));

  // 4a-bis) Also exclude recipes whose name or any raw Amandine tag hits sweet keywords.
  // Catches "Gâteau X", "Mini moelleux Y" that aren't tagged with our `dessert` slug.
  // And exclude condiments / sauces / drinks / plain dairy / snacks via NOT_A_MEAL_RE.
  const namedRecipes = await db.select({ id: recipes.id, nameFr: recipes.nameFr }).from(recipes);
  for (const r of namedRecipes) {
    if (SWEET_RE.test(r.nameFr)) isNonMain.add(r.id);
    if (isNotAMeal(r.nameFr)) isNonMain.add(r.id);
  }
  const tagRows = await db.select().from(recipeTags);
  for (const t of tagRows) if (SWEET_RE.test(t.tag)) isNonMain.add(t.recipeId);

  // 4b) Final pool: season-compatible + meal-appropriate
  const isMainMeal = (mealType: string) => mealType === 'déjeuner' || mealType === 'dîner';

  const seasonOk = (id: number) => {
    if (offSeasonRecipeIds.has(id)) return false;
    if (!currentSeason) return true;
    if (inCurrentSeason.has(id)) return true;
    if (!hasAnySeason.has(id)) return true;
    return false;
  };

  const mainPool = eligibleByPoints.filter((r) => seasonOk(r.id) && !isNonMain.has(r.id));
  const anyPool = eligibleByPoints.filter((r) => seasonOk(r.id));

  // 5) Fill slots, no immediate repetition
  const slots: GeneratedSlot[] = [];
  const used = new Set<number>();
  let position = 0;

  for (let d = 0; d < days; d++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + d);

    for (const mealType of mealsPerDay) {
      const pool = isMainMeal(mealType) ? mainPool : anyPool;
      let available = pool.filter((r) => !used.has(r.id));
      if (available.length === 0) {
        // Ran out — reset usage so we can re-use favourites
        used.clear();
        available = pool;
      }
      const picked = available.length
        ? available[Math.floor(Math.random() * available.length)]
        : null;
      if (picked) used.add(picked.id);
      slots.push({
        date,
        mealType,
        recipeId: picked?.id ?? null,
        servings: peopleCount,
        position: position++
      });
    }
  }

  return slots;
}
