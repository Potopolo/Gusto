import { fail, redirect, type Actions } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import {
  equipment,
  favoriteRecipes,
  favoriteIngredients,
  recipes,
  ingredients
} from '$lib/server/db/schema';
import { asc, desc, eq } from 'drizzle-orm';
import { ensureProfile } from '$lib/server/profile';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.currentUser) throw redirect(303, '/choisir-profil');

  // Self-heal users that somehow ended up without a profile row instead of
  // bouncing to a 500. The seed values match what `/choisir-profil` writes
  // when a profile is created from the UI.
  const profile = await ensureProfile(locals.currentUser.id);

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
    profile,
    equipment: allEquipment,
    favRecipes,
    favIngredients
  };
};

export const actions: Actions = {
  toggleEquipment: async ({ request, locals }) => {
    if (!locals.currentUser) return fail(401, { error: 'Non authentifié.' });
    const data = await request.formData();
    const id = parseInt((data.get('id') ?? '').toString(), 10);
    const owned = data.get('owned') === 'true';
    if (!Number.isFinite(id)) return fail(400, { error: 'Identifiant invalide.' });
    await db.update(equipment).set({ owned }).where(eq(equipment.id, id));
    return { saved: 'equipment' };
  }
};
