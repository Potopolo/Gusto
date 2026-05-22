import { db } from '$lib/server/db';
import { recipes, favoriteRecipes } from '$lib/server/db/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const recent = await db
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
    .orderBy(desc(recipes.fetchedAt))
    .limit(6);

  const userId = locals.currentUser?.id ?? null;
  const favSet = new Set<number>();
  if (userId != null && recent.length > 0) {
    const favRows = await db
      .select({ recipeId: favoriteRecipes.recipeId })
      .from(favoriteRecipes)
      .where(
        and(
          eq(favoriteRecipes.userId, userId),
          inArray(favoriteRecipes.recipeId, recent.map((r) => r.id))
        )
      );
    for (const f of favRows) favSet.add(f.recipeId);
  }

  const withFav = recent.map((r) => ({ ...r, isFavorite: favSet.has(r.id) }));
  return { recentRecipes: withFav };
};
