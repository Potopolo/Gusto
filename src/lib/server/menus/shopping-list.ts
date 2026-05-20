/**
 * Aggregate recipe ingredients across the slots of a menu into a flat
 * shopping list, scaled by the per-slot servings.
 *
 * Aggregation strategy (v1):
 *  - For each (date, mealType, recipe) slot, multiply each ingredient line's
 *    quantity by `slot.servings / recipe.servings`.
 *  - Key items by (normalizedName, unit) so duplicates collapse but
 *    incompatible units stay distinct ("200g sucre" + "1 sachet sucre vanillé"
 *    remain two rows).
 *  - Use the canonical ingredient name when the line is matched to CIQUAL,
 *    otherwise fall back to a cleaned-up version of the raw text.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
  ingredients,
  menuSlots,
  recipeIngredients,
  recipes
} from '$lib/server/db/schema';
import { categorize, type ShoppingCategory } from '$lib/shopping/categorize';

export type AggregatedItem = {
  nameFr: string;
  qty: number | null;
  unit: string | null;
  note: string | null;
  ingredientId: number | null;
  category: ShoppingCategory;
};

/** Lowercase, strip accents, collapse whitespace. */
function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strip a raw ingredient line down to a "shopping-friendly" name.
 * Removes leading quantity + unit, parenthetical notes, and trailing
 * suffixes like "(optionnel)".
 *
 * Examples:
 *   "120g de crème liquide entière"        → "crème liquide entière"
 *   "1 cuillère à soupe d'huile d'olive"   → "huile d'olive"
 *   "2 oignons rouges"                     → "oignons rouges"
 */
function cleanRawText(raw: string): string {
  let out = raw;
  // Drop parenthetical comments
  out = out.replace(/\([^)]*\)/g, '');
  // Strip leading "<qty>[ ]<unit>[de|d']"
  out = out.replace(
    /^\s*\d+(?:[.,/]\d+)?\s*(?:k?g|m?l|c?l|c\.\s*(?:à\s+)?(?:s|c|soupe|cafe|café)|cs|cc|cuill[èe]res?(?:\s+[aà]\s+(?:soupe|cafe|café))?|pinc[ée]es?|verres?|bols?|tasses?|sachets?|gousses?|brins?|tranches?|portions?)?\s*(?:de\s+|d[’']\s*)?/i,
    ''
  );
  // If still numeric at the start (e.g. "2 oignons"), drop it
  out = out.replace(/^\s*\d+(?:[.,/]\d+)?\s+/, '');
  return out.replace(/\s+/g, ' ').trim();
}

export async function generateShoppingItems(menuId: number): Promise<AggregatedItem[]> {
  // 1) Load all slots of the menu with their recipe servings + per-recipe ingredient lines.
  const slots = await db
    .select({
      slotId: menuSlots.id,
      slotServings: menuSlots.servings,
      recipeId: menuSlots.recipeId,
      recipeServings: recipes.servings
    })
    .from(menuSlots)
    .leftJoin(recipes, eq(menuSlots.recipeId, recipes.id))
    .where(eq(menuSlots.menuId, menuId));

  const recipeIds = Array.from(
    new Set(slots.map((s) => s.recipeId).filter((id): id is number => id != null))
  );
  if (recipeIds.length === 0) return [];

  const lines = await db
    .select({
      recipeId: recipeIngredients.recipeId,
      ingredientId: recipeIngredients.ingredientId,
      rawText: recipeIngredients.rawText,
      quantity: recipeIngredients.quantity,
      unit: recipeIngredients.unit,
      optional: recipeIngredients.optional,
      canonicalName: ingredients.nameFr,
      canonicalCategory: ingredients.category
    })
    .from(recipeIngredients)
    .leftJoin(ingredients, eq(recipeIngredients.ingredientId, ingredients.id))
    .where(inArray(recipeIngredients.recipeId, recipeIds));

  // Group ingredient lines per recipe for O(1) lookup during aggregation
  const linesByRecipe = new Map<number, typeof lines>();
  for (const l of lines) {
    const list = linesByRecipe.get(l.recipeId) ?? [];
    list.push(l);
    linesByRecipe.set(l.recipeId, list);
  }

  // 2) Aggregate per (normalized name, unit). Skip optional lines.
  type Bucket = {
    nameFr: string;
    qty: number | null;
    unit: string | null;
    note: string | null;
    ingredientId: number | null;
  };
  const buckets = new Map<string, Bucket>();

  for (const slot of slots) {
    if (slot.recipeId == null) continue;
    const recipeLines = linesByRecipe.get(slot.recipeId) ?? [];
    const baseServings = slot.recipeServings ?? slot.slotServings ?? 1;
    const factor = baseServings > 0 ? slot.slotServings / baseServings : 1;

    for (const line of recipeLines) {
      if (line.optional) continue;

      const name = line.canonicalName ?? cleanRawText(line.rawText);
      if (!name) continue;

      const key = `${normalizeKey(name)}|${line.unit ?? ''}`;
      const scaledQty = line.quantity != null ? line.quantity * factor : null;

      const existing = buckets.get(key);
      if (existing) {
        if (existing.qty != null && scaledQty != null) {
          existing.qty += scaledQty;
        } else if (existing.qty == null) {
          existing.qty = scaledQty;
        }
      } else {
        buckets.set(key, {
          nameFr: name,
          qty: scaledQty,
          unit: line.unit,
          note: null,
          ingredientId: line.ingredientId
        });
      }
    }
  }

  // 3) Categorize each bucket and round quantities to 1 decimal
  return Array.from(buckets.values()).map((b) => ({
    ...b,
    qty: b.qty != null ? Math.round(b.qty * 10) / 10 : null,
    category: categorize(b.nameFr)
  }));
}
