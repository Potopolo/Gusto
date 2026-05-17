import type { MacroTargets, DietaryPrefs, PointsFormulaConfig } from './schema';

export const defaultMacroTargets: MacroTargets = {
  protein_g: { min: 60, max: 100 },
  fat_g: { min: 50, max: 80 },
  carbs_g: { min: 180, max: 260 },
  fiber_g: { min: 25, max: 40 },
  salt_g: { min: 3, max: 6 },
  water_ml: { min: 1500, max: 2500 }
};

export const defaultDietaryPrefs: DietaryPrefs = {
  vegetarian: false,
  vegan: false,
  fish_ok: true,
  allergies: [],
  dislikes: []
};

// Calibrated against WW SmartPoints (~2017) so a balanced 600 kcal meal lands at ~8-10 pts,
// fitting daily budgets of 23 (femme) to 37 (homme) used by WW. Tweakable in Settings.
export const defaultPointsFormula: PointsFormulaConfig = {
  kcal_divisor: 80,
  sat_fat_coef: 0.15,
  sugar_coef: 0.06,
  salt_coef: 0,
  protein_credit: 0.05,
  fiber_credit: 0.05
};

export const defaultProfileValues = {
  activityLevel: 'moderate' as const,
  goalPhase: 'loss' as const,
  // 23 (femme) / 37 (homme) baseline WW. Default to 30 (mid) until user sets sex/goal.
  dailyPointsTarget: 30,
  enableWeightTracking: true
};
