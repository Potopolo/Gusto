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

  // The toggle is wrapped in a transaction so two concurrent clicks can't
  // both observe "not favorited" and then race two INSERTs into the unique
  // PK (userId, recipeId). The second one would otherwise crash with a 500.
  if (kind === 'recipe') {
    const favorited = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(favoriteRecipes)
        .where(
          and(
            eq(favoriteRecipes.userId, userId),
            eq(favoriteRecipes.recipeId, targetId)
          )
        )
        .limit(1);
      if (existing) {
        await tx
          .delete(favoriteRecipes)
          .where(
            and(
              eq(favoriteRecipes.userId, userId),
              eq(favoriteRecipes.recipeId, targetId)
            )
          );
        return false;
      }
      await tx.insert(favoriteRecipes).values({ userId, recipeId: targetId });
      return true;
    });
    return json({ favorited });
  }

  if (kind === 'ingredient') {
    const favorited = await db.transaction(async (tx) => {
      const [existing] = await tx
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
        await tx
          .delete(favoriteIngredients)
          .where(
            and(
              eq(favoriteIngredients.userId, userId),
              eq(favoriteIngredients.ingredientId, targetId)
            )
          );
        return false;
      }
      await tx
        .insert(favoriteIngredients)
        .values({ userId, ingredientId: targetId });
      return true;
    });
    return json({ favorited });
  }

  throw error(400, 'kind doit être "recipe" ou "ingredient".');
};
