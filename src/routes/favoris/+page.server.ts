import { error, fail, redirect, type Actions } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
  profiles,
  equipment,
  favoriteRecipes,
  favoriteIngredients,
  recipes,
  ingredients,
  type Profile
} from '$lib/server/db/schema';
import { asc, desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.currentUser) throw redirect(303, '/choisir-profil');

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, locals.currentUser.id))
    .limit(1);

  if (!profile) throw error(500, 'Profile not seeded');

  const allEquipment = await db.select().from(equipment).orderBy(equipment.nameFr);

  const favRecipes = await db
    .select({
      id: recipes.id,
      slug: recipes.slug,
      nameFr: recipes.nameFr,
      photoUrl: recipes.photoUrl,
      pointsPerServing: recipes.pointsPerServing,
      prepMinutes: recipes.prepMinutes,
      favoritedAt: favoriteRecipes.createdAt
    })
    .from(favoriteRecipes)
    .innerJoin(recipes, eq(favoriteRecipes.recipeId, recipes.id))
    .where(eq(favoriteRecipes.userId, locals.currentUser.id))
    .orderBy(desc(favoriteRecipes.createdAt));

  const favIngredients = await db
    .select({
      id: ingredients.id,
      nameFr: ingredients.nameFr,
      favoritedAt: favoriteIngredients.createdAt
    })
    .from(favoriteIngredients)
    .innerJoin(ingredients, eq(favoriteIngredients.ingredientId, ingredients.id))
    .where(eq(favoriteIngredients.userId, locals.currentUser.id))
    .orderBy(asc(ingredients.nameFr));

  return {
    profile: profile as Profile,
    equipment: allEquipment,
    favRecipes,
    favIngredients
  };
};

export const actions: Actions = {
  toggleEquipment: async ({ request }) => {
    const data = await request.formData();
    const id = parseInt((data.get('id') ?? '').toString(), 10);
    const owned = data.get('owned') === 'true';
    if (!Number.isFinite(id)) return fail(400);
    await db.update(equipment).set({ owned }).where(eq(equipment.id, id));
    return { saved: 'equipment' };
  }
};
