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
 * Build a "stem" from an ingredient name that's stable across the small
 * differences in how the same food shows up in different recipes:
 *   "Oignon, rouge, cru"          → "oignon"
 *   "Oignons rouges"              → "oignon"
 *   "Tomates cerises bio"         → "tomate"
 *   "Crème liquide entière 30%"   → "creme"
 *   "Sucre en poudre"             → "sucre"
 * The stem groups the buckets; the displayed name remains whichever
 * shortest variant we saw first (handled by the caller).
 */
const STEM_STOPWORDS = new Set([
  'rouge', 'rouges', 'vert', 'verts', 'verte', 'vertes',
  'jaune', 'jaunes', 'blanc', 'blanche', 'blancs', 'blanches',
  'noir', 'noirs', 'noire', 'noires',
  'cru', 'crue', 'crus', 'crues',
  'cuit', 'cuite', 'cuits', 'cuites',
  'frais', 'fraiche', 'fraiches',
  'bio', 'extra', 'nature', 'naturel', 'naturelle',
  'entier', 'entiere', 'entieres',
  'liquide', 'epaisse', 'epais',
  'en', 'de', 'du', 'des', 'la', 'le', 'les',
  'a', 'au', 'aux', 'et', 'ou',
  'poudre', 'morceau', 'morceaux', 'pot', 'tube',
  'conserve', 'surgele', 'surgeles', 'surgelee', 'surgelees'
]);

function stemName(name: string): string {
  const words = normalizeKey(name)
    .split(/[\s,()/-]+/)
    .filter(Boolean)
    .filter((w) => !STEM_STOPWORDS.has(w) && !/^\d/.test(w));
  if (words.length === 0) return normalizeKey(name);
  // Drop any trailing 's' / 'x' on each kept word to fold plurals.
  return words.map((w) => w.replace(/[sx]$/, '')).join(' ');
}

/** Convert a quantity+unit to a base unit (g for weights, ml for volumes).
 *  Returns the original pair when the unit is unknown (e.g. "pincée",
 *  "tranche", "boîte") so those buckets stay distinct. */
const WEIGHTS_TO_G: Record<string, number> = {
  g: 1, gr: 1, gramme: 1, grammes: 1,
  kg: 1000, kgs: 1000,
  mg: 0.001
};
const VOLUMES_TO_ML: Record<string, number> = {
  ml: 1, millilitre: 1, millilitres: 1,
  cl: 10, centilitre: 10, centilitres: 10,
  dl: 100, decilitre: 100, decilitres: 100,
  l: 1000, litre: 1000, litres: 1000
};

function toBaseUnit(
  qty: number | null,
  unit: string | null
): { qty: number | null; baseUnit: string | null } {
  if (qty == null) return { qty: null, baseUnit: unit };
  if (!unit) return { qty, baseUnit: null };
  const u = unit.toLowerCase().trim();
  if (WEIGHTS_TO_G[u] != null) return { qty: qty * WEIGHTS_TO_G[u]!, baseUnit: 'g' };
  if (VOLUMES_TO_ML[u] != null) return { qty: qty * VOLUMES_TO_ML[u]!, baseUnit: 'ml' };
  return { qty, baseUnit: u };
}

/** Re-humanize the aggregated total: 1200g → "1.2 kg", 750ml → "75 cl". */
function fromBaseUnit(
  qty: number | null,
  baseUnit: string | null
): { qty: number | null; unit: string | null } {
  if (qty == null) return { qty: null, unit: baseUnit };
  if (baseUnit === 'g') {
    if (qty >= 1000) return { qty: Math.round((qty / 1000) * 100) / 100, unit: 'kg' };
    return { qty: Math.round(qty), unit: 'g' };
  }
  if (baseUnit === 'ml') {
    if (qty >= 1000) return { qty: Math.round((qty / 1000) * 100) / 100, unit: 'L' };
    if (qty >= 100 && qty % 10 === 0) return { qty: qty / 10, unit: 'cl' };
    return { qty: Math.round(qty), unit: 'ml' };
  }
  return { qty: Math.round(qty * 10) / 10, unit: baseUnit };
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

  // 2) Aggregate per (stemmed name + base unit). Skip optional lines.
  // We keep the shortest seen name as the display label so the user gets
  // "Oignon" rather than "Oignon, rouge, cru".
  type Bucket = {
    nameFr: string;
    qty: number | null;       // accumulated in base unit (g, ml, or count)
    baseUnit: string | null;
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

      const scaledQty = line.quantity != null ? line.quantity * factor : null;
      const { qty: baseQty, baseUnit } = toBaseUnit(scaledQty, line.unit);

      const key = `${stemName(name)}|${baseUnit ?? ''}`;

      const existing = buckets.get(key);
      if (existing) {
        if (existing.qty != null && baseQty != null) {
          existing.qty += baseQty;
        } else if (existing.qty == null) {
          existing.qty = baseQty;
        }
        // Prefer the shorter name as display label — "Oignon" wins over
        // "Oignon, rouge, cru" because it's friendlier on the list.
        if (name.length < existing.nameFr.length) {
          existing.nameFr = name;
        }
        // Keep the first non-null ingredientId we encountered (used by
        // categorize() and downstream features).
        if (existing.ingredientId == null && line.ingredientId != null) {
          existing.ingredientId = line.ingredientId;
        }
      } else {
        buckets.set(key, {
          nameFr: name,
          qty: baseQty,
          baseUnit,
          note: null,
          ingredientId: line.ingredientId
        });
      }
    }
  }

  // 3) Humanize quantities (1200 g → "1.2 kg") and categorize.
  return Array.from(buckets.values()).map((b) => {
    const { qty, unit } = fromBaseUnit(b.qty, b.baseUnit);
    return {
      nameFr: b.nameFr,
      qty,
      unit,
      note: b.note,
      ingredientId: b.ingredientId,
      category: categorize(b.nameFr)
    };
  });
}
