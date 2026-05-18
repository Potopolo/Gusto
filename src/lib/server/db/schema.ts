import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export type MacroTargets = {
  protein_g: { min: number; max: number };
  fat_g: { min: number; max: number };
  carbs_g: { min: number; max: number };
  fiber_g: { min: number; max: number };
  salt_g: { min: number; max: number };
  water_ml: { min: number; max: number };
};

export type DietaryPrefs = {
  vegetarian: boolean;
  vegan: boolean;
  fish_ok: boolean;
  allergies: string[];
  dislikes: string[];
};

export type PointsFormulaConfig = {
  kcal_divisor: number;
  sat_fat_coef: number;
  sugar_coef: number;
  salt_coef: number;
  protein_credit: number;
  fiber_credit: number;
};

export const households = sqliteTable('households', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .notNull()
});

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  householdId: integer('household_id')
    .notNull()
    .references(() => households.id),
  labelFr: text('label_fr').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .notNull()
});

export const profiles = sqliteTable('profiles', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id),
  age: integer('age'),
  sex: text('sex'),
  heightCm: real('height_cm'),
  activityLevel: text('activity_level').notNull().default('moderate'),
  goalPhase: text('goal_phase').notNull().default('loss'),
  dailyPointsTarget: integer('daily_points_target').notNull().default(22),
  macroTargets: text('macro_targets', { mode: 'json' }).$type<MacroTargets>(),
  dietaryPrefs: text('dietary_prefs', { mode: 'json' }).$type<DietaryPrefs>(),
  enableWeightTracking: integer('enable_weight_tracking', { mode: 'boolean' })
    .notNull()
    .default(true),
  pointsFormulaConfig: text('points_formula_config', { mode: 'json' }).$type<PointsFormulaConfig>()
});

export const equipment = sqliteTable('equipment', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nameFr: text('name_fr').notNull().unique(),
  category: text('category').notNull(),
  owned: integer('owned', { mode: 'boolean' }).notNull().default(false)
});

// ---- Nutrition shape ----

export type NutritionPer100g = {
  kcal: number;
  protein_g: number;
  fat_g: number;
  sat_fat_g: number;
  carbs_g: number;
  sugar_g: number;
  fiber_g: number;
  salt_g: number;
};

export type RecipeNutrition = NutritionPer100g & {
  servings: number;
  per_serving: NutritionPer100g;
};

// ---- Recipes (global) ----

export const recipes = sqliteTable('recipes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  sourceUrl: text('source_url').unique(),
  authorAttribution: text('author_attribution'),
  nameFr: text('name_fr').notNull(),
  introMd: text('intro_md'),
  instructionsMd: text('instructions_md').notNull(),
  prepMinutes: integer('prep_minutes'),
  cookMinutes: integer('cook_minutes'),
  servings: integer('servings'),
  servingsUnit: text('servings_unit'),
  photoUrl: text('photo_url'),
  rawHtmlCache: text('raw_html_cache'),
  fetchedAt: integer('fetched_at', { mode: 'timestamp' }),
  notes: text('notes'),
  nutritionPerServing: text('nutrition_per_serving', { mode: 'json' }).$type<RecipeNutrition>(),
  pointsPerServing: integer('points_per_serving'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .notNull()
});

// ---- Ingredients catalog (global) ----

export const ingredients = sqliteTable('ingredients', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nameFr: text('name_fr').notNull(),
  nameCanonical: text('name_canonical').notNull(),
  category: text('category'),
  seasonalityMonths: text('seasonality_months', { mode: 'json' }).$type<number[]>(),
  defaultUnit: text('default_unit'),
  ean: text('ean'),
  ciqualCode: text('ciqual_code').unique(),
  nutritionPer100g: text('nutrition_per_100g', { mode: 'json' }).$type<NutritionPer100g>(),
  nutritionSource: text('nutrition_source'),
  fetchedAt: integer('fetched_at', { mode: 'timestamp' })
});

// ---- Recipe ↔ Ingredient join ----

export const recipeIngredients = sqliteTable('recipe_ingredients', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  recipeId: integer('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  ingredientId: integer('ingredient_id').references(() => ingredients.id),
  matchConfidence: real('match_confidence'),
  rawText: text('raw_text').notNull(),
  quantity: real('quantity'),
  unit: text('unit'),
  ingredientHint: text('ingredient_hint'),
  optional: integer('optional', { mode: 'boolean' }).notNull().default(false),
  position: integer('position').notNull()
});

// ---- Recipe ↔ Equipment join ----

export const recipeEquipment = sqliteTable('recipe_equipment', {
  recipeId: integer('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  equipmentId: integer('equipment_id')
    .notNull()
    .references(() => equipment.id),
  required: integer('required', { mode: 'boolean' }).notNull().default(true)
});

// ---- Categories (global) ----

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  nameFr: text('name_fr').notNull(),
  kind: text('kind').notNull()
});

export const recipeCategories = sqliteTable('recipe_categories', {
  recipeId: integer('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id)
});

// ---- Raw Amandine tags (informational) ----

export const recipeTags = sqliteTable('recipe_tags', {
  recipeId: integer('recipe_id')
    .notNull()
    .references(() => recipes.id, { onDelete: 'cascade' }),
  tag: text('tag').notNull()
});

// ---- Menus (per household) ----

export type MenuGenerationParams = {
  peopleCount: number;
  mealsPerDay: string[];
  days: number;
};

export const menus = sqliteTable('menus', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  householdId: integer('household_id')
    .notNull()
    .references(() => households.id),
  name: text('name').notNull(),
  startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
  endDate: integer('end_date', { mode: 'timestamp' }).notNull(),
  notes: text('notes'),
  generationParams: text('generation_params', { mode: 'json' }).$type<MenuGenerationParams>(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .default(sql`(unixepoch())`)
    .notNull()
});

export const menuSlots = sqliteTable('menu_slots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  menuId: integer('menu_id')
    .notNull()
    .references(() => menus.id, { onDelete: 'cascade' }),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  mealType: text('meal_type').notNull(), // 'petit-déj' | 'déjeuner' | 'dîner' | 'collation'
  recipeId: integer('recipe_id').references(() => recipes.id),
  servings: integer('servings').notNull().default(2),
  freeText: text('free_text'),
  position: integer('position').notNull().default(0)
});

// ---- Inferred types ----

export type Household = typeof households.$inferSelect;
export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Equipment = typeof equipment.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type Ingredient = typeof ingredients.$inferSelect;
export type RecipeIngredient = typeof recipeIngredients.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Menu = typeof menus.$inferSelect;
export type MenuSlot = typeof menuSlots.$inferSelect;
