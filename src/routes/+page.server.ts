import { db } from '$lib/server/db';
import { recipes } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const recent = await db
    .select({
      id: recipes.id,
      slug: recipes.slug,
      nameFr: recipes.nameFr,
      photoUrl: recipes.photoUrl,
      servings: recipes.servings,
      servingsUnit: recipes.servingsUnit,
      pointsPerServing: recipes.pointsPerServing
    })
    .from(recipes)
    .orderBy(desc(recipes.fetchedAt))
    .limit(6);

  return { recentRecipes: recent };
};
