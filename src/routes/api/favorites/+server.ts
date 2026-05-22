/**
 * Toggle a favorite for the current user.
 *
 * POST body (JSON or form-encoded):
 *   - kind: 'recipe' | 'ingredient'
 *   - id:   number (recipeId or ingredientId)
 *
 * Returns { favorited: boolean } reflecting the state AFTER the toggle.
 * The endpoint is idempotent-ish: clients send the toggle command (not
 * the desired state), so two rapid clicks reliably alternate.
 */
import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { favoriteRecipes, favoriteIngredients } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

async function readPayload(request: Request): Promise<{ kind?: string; id?: number }> {
  const ct = request.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    const body = (await request.json()) as { kind?: string; id?: number | string };
    return { kind: body.kind, id: typeof body.id === 'string' ? parseInt(body.id, 10) : body.id };
  }
  const fd = await request.formData();
  return {
    kind: (fd.get('kind') ?? '').toString(),
    id: parseInt((fd.get('id') ?? '').toString(), 10)
  };
}

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.currentUser) throw error(401, 'Non authentifié.');

  const { kind, id } = await readPayload(request);
  if (!Number.isFinite(id) || (id as number) <= 0) {
    throw error(400, 'id invalide.');
  }
  const userId = locals.currentUser.id;
  const targetId = id as number;

  if (kind === 'recipe') {
    const [existing] = await db
      .select()
      .from(favoriteRecipes)
      .where(
        and(eq(favoriteRecipes.userId, userId), eq(favoriteRecipes.recipeId, targetId))
      )
      .limit(1);
    if (existing) {
      await db
        .delete(favoriteRecipes)
        .where(
          and(
            eq(favoriteRecipes.userId, userId),
            eq(favoriteRecipes.recipeId, targetId)
          )
        );
      return json({ favorited: false });
    }
    await db.insert(favoriteRecipes).values({ userId, recipeId: targetId });
    return json({ favorited: true });
  }

  if (kind === 'ingredient') {
    const [existing] = await db
      .select()
      .from(favoriteIngredients)
      .where(
        and(
          eq(favoriteIngredients.userId, userId),
          eq(favoriteIngredients.ingredientId, targetId)
        )
      )
      .limit(1);
    if (existing) {
      await db
        .delete(favoriteIngredients)
        .where(
          and(
            eq(favoriteIngredients.userId, userId),
            eq(favoriteIngredients.ingredientId, targetId)
          )
        );
      return json({ favorited: false });
    }
    await db.insert(favoriteIngredients).values({ userId, ingredientId: targetId });
    return json({ favorited: true });
  }

  throw error(400, 'kind doit être "recipe" ou "ingredient".');
};
