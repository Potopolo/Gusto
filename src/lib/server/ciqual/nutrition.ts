import type { NutritionPer100g, PointsFormulaConfig } from '../db/schema';

/** Approximate gram weight of one unit of {key}. */
const UNIT_GRAMS: Record<string, number> = {
  g: 1,
  mg: 0.001,
  kg: 1000,
  // Volume → density 1 g/ml as default (water-based); inaccurate for fats and honey
  ml: 1,
  cl: 10,
  dl: 100,
  l: 1000,
  // Cooking units (averages)
  CS: 15,
  cc: 5,
  pincée: 1,
  gousse: 5,
  tranche: 30,
  sachet: 10,
  paquet: 250,
  pot: 125,
  tasse: 250,
  verre: 200,
  boîte: 400,
  pièce: 100
};

const DEFAULT_PIECE_G = 100;

/** Convert (quantity, unit) to grams. Returns null when quantity is missing. */
export function toGrams(quantity: number | null, unit: string | null): number | null {
  if (quantity == null) return null;
  if (unit == null) return quantity * DEFAULT_PIECE_G;
  const factor = UNIT_GRAMS[unit];
  if (factor == null) return quantity * DEFAULT_PIECE_G;
  return quantity * factor;
}

export const ZERO_NUTRITION: NutritionPer100g = {
  kcal: 0,
  protein_g: 0,
  fat_g: 0,
  sat_fat_g: 0,
  carbs_g: 0,
  sugar_g: 0,
  fiber_g: 0,
  salt_g: 0
};

/** Scale a per-100g nutrition by `grams / 100`. */
export function nutritionForGrams(n: NutritionPer100g, grams: number): NutritionPer100g {
  const f = grams / 100;
  return {
    kcal: n.kcal * f,
    protein_g: n.protein_g * f,
    fat_g: n.fat_g * f,
    sat_fat_g: n.sat_fat_g * f,
    carbs_g: n.carbs_g * f,
    sugar_g: n.sugar_g * f,
    fiber_g: n.fiber_g * f,
    salt_g: n.salt_g * f
  };
}

/** Sum two nutritions field-wise. */
export function addNutrition(a: NutritionPer100g, b: NutritionPer100g): NutritionPer100g {
  return {
    kcal: a.kcal + b.kcal,
    protein_g: a.protein_g + b.protein_g,
    fat_g: a.fat_g + b.fat_g,
    sat_fat_g: a.sat_fat_g + b.sat_fat_g,
    carbs_g: a.carbs_g + b.carbs_g,
    sugar_g: a.sugar_g + b.sugar_g,
    fiber_g: a.fiber_g + b.fiber_g,
    salt_g: a.salt_g + b.salt_g
  };
}

export function divideNutrition(n: NutritionPer100g, divisor: number): NutritionPer100g {
  if (divisor === 0) return ZERO_NUTRITION;
  return {
    kcal: n.kcal / divisor,
    protein_g: n.protein_g / divisor,
    fat_g: n.fat_g / divisor,
    sat_fat_g: n.sat_fat_g / divisor,
    carbs_g: n.carbs_g / divisor,
    sugar_g: n.sugar_g / divisor,
    fiber_g: n.fiber_g / divisor,
    salt_g: n.salt_g / divisor
  };
}

// Calibrated against WW SmartPoints so a balanced 600 kcal meal lands at ~8-10 pts,
// fitting daily budgets of 23 (femme) to 37 (homme).
export const DEFAULT_POINTS_FORMULA: PointsFormulaConfig = {
  kcal_divisor: 80,
  sat_fat_coef: 0.15,
  sugar_coef: 0.06,
  salt_coef: 0,
  protein_credit: 0.05,
  fiber_credit: 0.05
};

/** Compute points for a per-serving nutrition. Salt in g; converted to mg internally. */
export function computePoints(
  n: NutritionPer100g,
  formula: PointsFormulaConfig = DEFAULT_POINTS_FORMULA
): number {
  const salt_mg = n.salt_g * 1000;
  const raw =
    n.kcal / formula.kcal_divisor +
    formula.sat_fat_coef * n.sat_fat_g +
    formula.sugar_coef * n.sugar_g +
    (formula.salt_coef * salt_mg) / 100 -
    formula.protein_credit * n.protein_g -
    formula.fiber_credit * n.fiber_g;
  return Math.max(0, Math.min(60, Math.round(raw)));
}
