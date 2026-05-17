import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import {
  recipes,
  recipeIngredients,
  recipeTags,
  recipeCategories,
  categories,
  type Recipe
} from '../db/schema';
import type { ParsedRecipe } from './amandine-parser';

// DB instance is passed in to support both SvelteKit context ($env) and CLI context (process.env)
export type DB = ReturnType<typeof drizzle>;

/**
 * Mapping from Amandine raw tag (lowercased, accents preserved) → category slugs in our DB.
 * Tags not in this map are still stored in `recipeTags` as raw informational tags.
 */
const TAG_TO_SLUGS: Record<string, string[]> = {
  végetarien: ['vegetarien'],
  vegetarien: ['vegetarien'],
  végétarien: ['vegetarien'],
  vegan: ['vegetalien', 'vegetarien'],
  végétalien: ['vegetalien', 'vegetarien'],
  'sans gluten': ['sans-gluten'],
  // Saisons
  'recettes été': ['ete'],
  'recettes hiver': ['hiver'],
  'recettes printemps': ['printemps'],
  'recettes automne': ['automne'],
  // Types
  plats: ['plat'],
  'plats principaux': ['plat'],
  desserts: ['dessert'],
  soupes: ['soupe'],
  'soupes & potages': ['soupe'],
  salades: ['salade'],
  'petits déjeuners': ['petit-dej'],
  'petits dejeuners': ['petit-dej'],
  goûters: ['gouter'],
  gouters: ['gouter'],
  apéritifs: ['apero'],
  aperitifs: ['apero'],
  boissons: ['boisson'],
  // Équipement
  cookéo: ['cookeo'],
  cookeo: ['cookeo'],
  airfryer: ['airfryer'],
  'air fryer': ['airfryer']
};

function mapTagToSlugs(rawTag: string): string[] {
  const normalized = rawTag.toLowerCase().trim();
  return TAG_TO_SLUGS[normalized] ?? [];
}

export type PersistResult = {
  status: 'created' | 'updated' | 'skipped' | 'not-a-recipe';
  recipeId?: number;
  ingredientsCount?: number;
  tagsCount?: number;
  categoriesCount?: number;
};

export async function persistRecipe(
  db: DB,
  parsed: ParsedRecipe,
  opts: { force?: boolean } = {}
): Promise<PersistResult> {
  // Check if recipe already exists by sourceUrl
  const existing: Recipe[] = await db
    .select()
    .from(recipes)
    .where(eq(recipes.sourceUrl, parsed.sourceUrl))
    .limit(1);

  if (existing.length && !opts.force) {
    return { status: 'skipped', recipeId: existing[0]!.id };
  }

  let recipeId: number;
  let status: 'created' | 'updated';

  const baseValues = {
    slug: parsed.slug,
    sourceUrl: parsed.sourceUrl,
    authorAttribution: 'Amandine Cooking',
    nameFr: parsed.nameFr,
    introMd: parsed.introMd || null,
    instructionsMd: parsed.instructionsMd,
    servings: parsed.servings,
    servingsUnit: parsed.servingsUnit,
    photoUrl: parsed.photoUrl,
    rawHtmlCache: parsed.rawHtmlCache,
    fetchedAt: new Date()
  };

  if (existing[0]) {
    recipeId = existing[0].id;
    await db.update(recipes).set(baseValues).where(eq(recipes.id, recipeId));
    status = 'updated';
    // Wipe child rows we will re-insert
    await db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId));
    await db.delete(recipeTags).where(eq(recipeTags.recipeId, recipeId));
    await db.delete(recipeCategories).where(eq(recipeCategories.recipeId, recipeId));
  } else {
    const [inserted] = await db.insert(recipes).values(baseValues).returning();
    if (!inserted) throw new Error('Insert recipe returned no row');
    recipeId = inserted.id;
    status = 'created';
  }

  // Ingredients
  if (parsed.ingredients.length) {
    await db.insert(recipeIngredients).values(
      parsed.ingredients.map((ing) => ({
        recipeId,
        rawText: ing.rawText,
        quantity: ing.quantity,
        unit: ing.unit,
        ingredientHint: ing.ingredientHint,
        position: ing.position
      }))
    );
  }

  // Raw tags
  if (parsed.tags.length) {
    await db
      .insert(recipeTags)
      .values(parsed.tags.map((tag) => ({ recipeId, tag })));
  }

  // Mapped categories
  const slugSet = new Set<string>();
  for (const t of parsed.tags) {
    for (const s of mapTagToSlugs(t)) slugSet.add(s);
  }
  const slugList = Array.from(slugSet);
  let categoriesCount = 0;
  if (slugList.length) {
    const cats = await db.select().from(categories).where(inArray(categories.slug, slugList));
    if (cats.length) {
      await db.insert(recipeCategories).values(cats.map((c) => ({ recipeId, categoryId: c.id })));
      categoriesCount = cats.length;
    }
  }

  return {
    status,
    recipeId,
    ingredientsCount: parsed.ingredients.length,
    tagsCount: parsed.tags.length,
    categoriesCount
  };
}
