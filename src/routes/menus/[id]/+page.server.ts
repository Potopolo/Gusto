import { error, fail, redirect, type Actions } from '@sveltejs/kit';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
  menus,
  menuSlots,
  recipes,
  recipeCategories,
  recipeTags,
  categories,
  shoppingLists,
  shoppingListItems
} from '$lib/server/db/schema';
import { generateMenu } from '$lib/server/menus/generate';
import { generateShoppingItems } from '$lib/server/menus/shopping-list';
import { SWEET_RE, isRecipeForMealType } from '$lib/menus/sweet';
import type { PageServerLoad } from './$types';

const MAIN_MEAL_TYPES = ['petit-déj', 'déjeuner', 'dîner'] as const;

const ALLOWED_MEAL_TYPES = [
  'petit-déj',
  'déjeuner',
  'goûter',
  'apéro',
  'dîner',
  'dessert',
  'collation'
] as const;
type MealType = (typeof ALLOWED_MEAL_TYPES)[number];

function isValidMealType(s: string): s is MealType {
  return (ALLOWED_MEAL_TYPES as readonly string[]).includes(s);
}

async function recipeExists(id: number): Promise<boolean> {
  const found = await db.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, id)).limit(1);
  return !!found[0];
}

export const load: PageServerLoad = async ({ params }) => {
  const menuId = parseInt(params.id ?? "", 10);
  if (!Number.isFinite(menuId)) throw error(404, 'Menu introuvable');

  const [menu] = await db.select().from(menus).where(eq(menus.id, menuId)).limit(1);
  if (!menu) throw error(404, 'Menu introuvable');

  const slotRows = await db
    .select({
      slot: menuSlots,
      recipe: {
        id: recipes.id,
        slug: recipes.slug,
        nameFr: recipes.nameFr,
        photoUrl: recipes.photoUrl,
        servings: recipes.servings,
        servingsUnit: recipes.servingsUnit,
        pointsPerServing: recipes.pointsPerServing,
        prepMinutes: recipes.prepMinutes
      }
    })
    .from(menuSlots)
    .leftJoin(recipes, eq(menuSlots.recipeId, recipes.id))
    .where(eq(menuSlots.menuId, menuId))
    .orderBy(asc(menuSlots.date), asc(menuSlots.position));

  const recipeRows = await db
    .select({
      id: recipes.id,
      nameFr: recipes.nameFr,
      photoUrl: recipes.photoUrl,
      pointsPerServing: recipes.pointsPerServing,
      prepMinutes: recipes.prepMinutes
    })
    .from(recipes)
    .orderBy(asc(recipes.nameFr));

  // Per-recipe categories for client-side filtering
  const recipeCatRows = await db
    .select({
      recipeId: recipeCategories.recipeId,
      slug: categories.slug,
      nameFr: categories.nameFr,
      kind: categories.kind
    })
    .from(recipeCategories)
    .innerJoin(categories, eq(recipeCategories.categoryId, categories.id));

  const catsByRecipe = new Map<number, Array<{ slug: string; nameFr: string; kind: string }>>();
  for (const c of recipeCatRows) {
    const list = catsByRecipe.get(c.recipeId) ?? [];
    list.push({ slug: c.slug, nameFr: c.nameFr, kind: c.kind });
    catsByRecipe.set(c.recipeId, list);
  }

  // Raw tags per recipe — used to compute the isSweet flag (some sweet
  // recipes aren't categorized, e.g. when their Amandine tag has no
  // mapping in persist.ts/reapply-tags.ts yet).
  const tagRows = await db.select().from(recipeTags);
  const tagsByRecipe = new Map<number, string[]>();
  for (const t of tagRows) {
    const list = tagsByRecipe.get(t.recipeId) ?? [];
    list.push(t.tag);
    tagsByRecipe.set(t.recipeId, list);
  }

  const allRecipes = recipeRows.map((r) => {
    const cats = catsByRecipe.get(r.id) ?? [];
    const tags = tagsByRecipe.get(r.id) ?? [];
    const isSweet =
      SWEET_RE.test(r.nameFr) ||
      tags.some((t) => SWEET_RE.test(t)) ||
      cats.some((c) => c.slug === 'dessert' || c.slug === 'gourmand');
    return { ...r, categories: cats, isSweet };
  });

  // Distinct categories present in the corpus, grouped + sorted for filter pills
  const usedCategoryRows = await db
    .select({
      slug: categories.slug,
      nameFr: categories.nameFr,
      kind: categories.kind,
      count: sql<number>`count(${recipeCategories.recipeId})`
    })
    .from(categories)
    .innerJoin(recipeCategories, eq(recipeCategories.categoryId, categories.id))
    .groupBy(categories.id, categories.slug, categories.nameFr, categories.kind)
    .orderBy(sql`count(${recipeCategories.recipeId}) desc`);

  const allCategories = usedCategoryRows.map((r) => ({
    slug: r.slug,
    nameFr: r.nameFr,
    kind: r.kind,
    count: Number(r.count)
  }));

  // Existing shopping list for this menu (if any) — surfaces a "Voir la liste"
  // link in the UI instead of "Générer la liste".
  const [existingList] = await db
    .select({ id: shoppingLists.id })
    .from(shoppingLists)
    .where(eq(shoppingLists.menuId, menuId))
    .limit(1);

  return {
    menu,
    slots: slotRows,
    allRecipes,
    allCategories,
    shoppingListId: existingList?.id ?? null
  };
};

export const actions: Actions = {
  add: async ({ request, params }) => {
    const menuId = parseInt(params.id ?? "", 10);
    if (!Number.isFinite(menuId)) return fail(404, { error: 'Menu introuvable.' });

    const data = await request.formData();
    const dateStr = (data.get('date') ?? '').toString();
    const mealType = (data.get('mealType') ?? '').toString();
    const recipeIdStr = (data.get('recipeId') ?? '').toString();
    const servings = Math.max(
      1,
      Math.min(50, parseInt((data.get('servings') ?? '2').toString(), 10) || 2)
    );

    const date = new Date(dateStr + 'T00:00:00');
    if (!Number.isFinite(date.getTime())) return fail(400, { error: 'Date invalide.' });
    if (!isValidMealType(mealType)) return fail(400, { error: 'Type de plat invalide.' });

    const recipeId = recipeIdStr ? parseInt(recipeIdStr, 10) : NaN;
    if (!Number.isFinite(recipeId)) return fail(400, { error: 'Choisis une recette.' });
    if (!(await recipeExists(recipeId))) return fail(400, { error: 'Recette introuvable.' });

    const [last] = await db
      .select({ position: menuSlots.position })
      .from(menuSlots)
      .where(eq(menuSlots.menuId, menuId))
      .orderBy(desc(menuSlots.position))
      .limit(1);

    await db.insert(menuSlots).values({
      menuId,
      date,
      mealType,
      recipeId,
      servings,
      position: (last?.position ?? -1) + 1
    });

    return { added: true };
  },

  update: async ({ request, params }) => {
    const menuId = parseInt(params.id ?? "", 10);
    if (!Number.isFinite(menuId)) return fail(404, { error: 'Menu introuvable.' });

    const data = await request.formData();
    const slotId = parseInt((data.get('slotId') ?? '').toString(), 10);
    const mealType = (data.get('mealType') ?? '').toString();
    const recipeIdStr = (data.get('recipeId') ?? '').toString();
    const servings = Math.max(
      1,
      Math.min(50, parseInt((data.get('servings') ?? '2').toString(), 10) || 2)
    );

    if (!Number.isFinite(slotId)) return fail(400, { error: 'Slot invalide.' });
    if (!isValidMealType(mealType)) return fail(400, { error: 'Type de plat invalide.' });

    const recipeId = recipeIdStr ? parseInt(recipeIdStr, 10) : NaN;
    if (!Number.isFinite(recipeId)) return fail(400, { error: 'Choisis une recette.' });
    if (!(await recipeExists(recipeId))) return fail(400, { error: 'Recette introuvable.' });

    await db
      .update(menuSlots)
      .set({ mealType, recipeId, servings })
      .where(and(eq(menuSlots.id, slotId), eq(menuSlots.menuId, menuId)));

    return { updated: true };
  },

  remove: async ({ request, params }) => {
    const menuId = parseInt(params.id ?? "", 10);
    if (!Number.isFinite(menuId)) return fail(404);
    const data = await request.formData();
    const slotId = parseInt((data.get('slotId') ?? '').toString(), 10);
    if (!Number.isFinite(slotId)) return fail(400);
    await db
      .delete(menuSlots)
      .where(and(eq(menuSlots.id, slotId), eq(menuSlots.menuId, menuId)));
    return { removed: true };
  },

  /**
   * Pick a random alternative recipe for an existing slot, respecting the
   * slot's meal type (no desserts in déjeuner/dîner, etc.). Excludes the
   * current recipe so the user always sees something new.
   */
  reroll: async ({ request, params }) => {
    const menuId = parseInt(params.id ?? "", 10);
    if (!Number.isFinite(menuId)) return fail(404, { error: 'Menu introuvable.' });
    const data = await request.formData();
    const slotId = parseInt((data.get('slotId') ?? '').toString(), 10);
    if (!Number.isFinite(slotId)) return fail(400, { error: 'Slot invalide.' });

    const [slot] = await db
      .select()
      .from(menuSlots)
      .where(and(eq(menuSlots.id, slotId), eq(menuSlots.menuId, menuId)))
      .limit(1);
    if (!slot) return fail(404, { error: 'Slot introuvable.' });

    // Build the eligible pool — same logic as the picker UI
    const allRecipes = await db
      .select({ id: recipes.id, nameFr: recipes.nameFr })
      .from(recipes);

    const catRows = await db
      .select({ recipeId: recipeCategories.recipeId, slug: categories.slug })
      .from(recipeCategories)
      .innerJoin(categories, eq(recipeCategories.categoryId, categories.id));
    const slugsByR = new Map<number, Set<string>>();
    for (const c of catRows) {
      const set = slugsByR.get(c.recipeId) ?? new Set<string>();
      set.add(c.slug);
      slugsByR.set(c.recipeId, set);
    }

    const tagRows = await db.select().from(recipeTags);
    const tagsByR = new Map<number, string[]>();
    for (const t of tagRows) {
      const list = tagsByR.get(t.recipeId) ?? [];
      list.push(t.tag);
      tagsByR.set(t.recipeId, list);
    }

    const candidates = allRecipes.filter((r) => {
      if (r.id === slot.recipeId) return false; // always pick something new
      const slugs = slugsByR.get(r.id) ?? new Set<string>();
      const tags = tagsByR.get(r.id) ?? [];
      const isSweet =
        SWEET_RE.test(r.nameFr) ||
        tags.some((t) => SWEET_RE.test(t)) ||
        slugs.has('dessert') ||
        slugs.has('gourmand');
      return isRecipeForMealType(
        { categories: Array.from(slugs).map((slug) => ({ slug })), isSweet },
        slot.mealType
      );
    });

    if (!candidates.length) {
      return fail(400, {
        error: `Aucune autre recette adaptée à un ${slot.mealType}.`
      });
    }

    const picked = candidates[Math.floor(Math.random() * candidates.length)]!;
    await db.update(menuSlots).set({ recipeId: picked.id }).where(eq(menuSlots.id, slotId));

    return { rerolled: true };
  },

  /**
   * Wipe and regenerate ALL main-meal slots of the menu (petit-déj/déjeuner/dîner)
   * using the menu's original generation params. Manually-added extras
   * (desserts, apéros, goûters…) are preserved.
   */
  regenerate: async ({ params, locals }) => {
    if (!locals.currentUser) return fail(401, { error: 'Non authentifié.' });

    const menuId = parseInt(params.id ?? "", 10);
    if (!Number.isFinite(menuId)) return fail(404, { error: 'Menu introuvable.' });

    const [menu] = await db.select().from(menus).where(eq(menus.id, menuId)).limit(1);
    if (!menu) return fail(404, { error: 'Menu introuvable.' });

    // Fall back to a sensible default for legacy menus saved before
    // generationParams was added to the schema.
    const gen = menu.generationParams ?? {
      peopleCount: 2,
      mealsPerDay: ['déjeuner', 'dîner'],
      days: 7
    };

    const mainMealsPerDay = gen.mealsPerDay.filter((m) =>
      (MAIN_MEAL_TYPES as readonly string[]).includes(m)
    );
    if (mainMealsPerDay.length === 0) {
      return fail(400, {
        error: 'Aucun repas principal à régénérer dans ce menu.'
      });
    }

    // Drop current main-meal slots, keep "Plats en plus" intact
    await db
      .delete(menuSlots)
      .where(
        and(
          eq(menuSlots.menuId, menuId),
          inArray(menuSlots.mealType, mainMealsPerDay)
        )
      );

    // Next position must follow whatever extras remain
    const [last] = await db
      .select({ position: menuSlots.position })
      .from(menuSlots)
      .where(eq(menuSlots.menuId, menuId))
      .orderBy(desc(menuSlots.position))
      .limit(1);
    let nextPos = (last?.position ?? -1) + 1;

    const newSlots = await generateMenu({
      startDate: menu.startDate,
      days: gen.days,
      mealsPerDay: mainMealsPerDay,
      peopleCount: gen.peopleCount,
      userId: locals.currentUser.id,
      householdId: menu.householdId
    });

    if (newSlots.length) {
      await db.insert(menuSlots).values(
        newSlots.map((s) => ({
          menuId,
          date: s.date,
          mealType: s.mealType,
          recipeId: s.recipeId,
          servings: s.servings,
          position: nextPos++
        }))
      );
    }

    return { regenerated: true };
  },

  /**
   * Generate (or regenerate) the shopping list for this menu.
   * One list per menu — re-running overwrites the previous one.
   */
  generateShoppingList: async ({ params }) => {
    const menuId = parseInt(params.id ?? "", 10);
    if (!Number.isFinite(menuId)) return fail(404, { error: 'Menu introuvable.' });

    const [menu] = await db.select().from(menus).where(eq(menus.id, menuId)).limit(1);
    if (!menu) return fail(404, { error: 'Menu introuvable.' });

    const items = await generateShoppingItems(menuId);
    if (items.length === 0) {
      return fail(400, {
        error:
          "Aucun ingrédient à mettre dans la liste. Ajoute d'abord des recettes au menu."
      });
    }

    // Replace any pre-existing list for this menu (cascade clears items).
    await db.delete(shoppingLists).where(eq(shoppingLists.menuId, menuId));

    const [created] = await db
      .insert(shoppingLists)
      .values({
        menuId,
        householdId: menu.householdId,
        name: `Liste — ${menu.name}`
      })
      .returning();

    if (!created) return fail(500, { error: 'Création de la liste impossible.' });

    await db.insert(shoppingListItems).values(
      items.map((it, position) => ({
        listId: created.id,
        nameFr: it.nameFr,
        qty: it.qty,
        unit: it.unit,
        note: it.note,
        ingredientId: it.ingredientId,
        category: it.category,
        position
      }))
    );

    throw redirect(303, `/listes-de-courses/${created.id}`);
  }
};
