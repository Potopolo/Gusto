/**
 * Words that almost always signal a sweet / dessert recipe.
 * Shared between the menu generator (server) and the picker UI (client).
 * Used to:
 *   - filter desserts out of déjeuner / dîner pools
 *   - filter mains out of dessert / goûter pools
 */
export const SWEET_RE =
  /\b(g[âa]teau|tarte|tartelette|entremet|mousse|cookie|muffin|moelleux|crumble|fondant|cheesecake|pancake|brioche|pain perdu|glace|sorbet|bavarois|cake|biscuit|cupcake|[ée]clair|profiterole|tiramisu|b[ûu]che|p[âa]tisserie|donut|fraisier|millefeuille|saint[- ]honor[ée]|cr[èe]me br[ûu]l[ée]e|cl[âa]foutis|chausson|mendiant|macaron|nougat|sucette|pralin[ée]|caramel|m[ée]ringue|sabl[ée]|paris[- ]brest|opera|charlotte|panna cotta|cr[èe]me dessert|kouign|baba|babka|cannel[ée]|madeleine|financier|verrine.*(fruit|fraise|framboise|chocolat|p[êe]che|abricot|fromage blanc))s?\b/i;

export function isSweetByName(text: string | null | undefined): boolean {
  if (!text) return false;
  return SWEET_RE.test(text);
}

/**
 * Recipes that are NOT a meal on their own — condiments, sauces, dips,
 * spreads, plain dairy, drinks, snacks. They shouldn't surface as a
 * déjeuner / dîner pick. Heuristic on the recipe name only (catches the
 * "Ketchup maison", "Yaourt grec", "Confiture de pêches" cases that no
 * category tag covers).
 */
export const NOT_A_MEAL_RE =
  /\b(ketchup|mayonnaise|moutarde|sauce(?!\s+(bolognaise|tomate\s+pour\s+p[âa]tes|au\s+poisson))[^,]*|vinaigrette|pesto|tapenade|houmous|guacamole|tartinade|confit(?:ure)?|gel[ée]e|coulis|sirop|caramel\s+liquide|pickles?|chutney|relish|condiment|marinade|ras\s+el\s+hanout|pain\s+(?:perdu\s+)?(?:de\s+mie|maison)|p[âa]te\s+(?:bris[ée]e|sabl[ée]e|feuillet[ée]e|[àa]\s+(?:tarte|pizza|cr[êe]pes?|gaufres?|tartiner))|pizza\s+dough|yaourt(?:\s+grec)?|fromage\s+blanc(?:\s+0%)?(?:\s+nature)?|skyr|kefir|smoothie|jus\s+de|infusion|th[ée](?:\s+glac[ée])?|tisane|caf[ée]\s+(?:glac[ée]|frapp[ée])|chocolat\s+chaud|cocktail|granola|m[üu]esli|porridge|barre\s+(?:de\s+c[ée]r[ée]ales|prot[ée]in[ée]e)|en[- ]cas|snack|gressins?|crackers?|chips?|popcorn|pop[- ]corn)\b/i;

/** True when the recipe name "leads with" a non-meal keyword — meaning
 *  the dish itself IS the condiment / drink / snack, as opposed to
 *  a real meal that merely contains one as an ingredient.
 *
 *  Examples:
 *    "Ketchup maison"         → true  (1st word matches)
 *    "Sauce ketchup pour…"    → true  (2nd word matches)
 *    "Pâtes au pesto"         → false (pesto is the 3rd word)
 *    "Bowl smoothie banane"   → false (smoothie is the 2nd word — TODO?)
 *    "Smoothie banane"        → true
 *    "Salade de yaourt grec"  → false (it's a salad that uses yaourt)
 *    "Yaourt grec maison"     → true
 *
 *  Implementation: keep only the first two words of the name and run
 *  the existing regex on that head. We strip accents so the regex's
 *  word-class \b works correctly on french.
 */
export function isNotAMeal(text: string | null | undefined): boolean {
  if (!text) return false;
  const head = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[\s,.;:!?()-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(' ');
  return NOT_A_MEAL_RE.test(head);
}

/**
 * Decide whether a recipe is appropriate for a given meal type.
 * Pure: takes the recipe's categories (slugs) + isSweet flag + name.
 *
 * The `name` argument is optional but recommended: it catches the
 * "Ketchup maison" / "Yaourt grec" / "Confiture de pêches" cases that
 * carry no category tag yet still aren't a real meal.
 */
export function isRecipeForMealType(
  recipe: { categories: { slug: string }[]; isSweet?: boolean; name?: string },
  mealType: string
): boolean {
  const slugs = new Set(recipe.categories.map((c) => c.slug));
  // Sweet detection has 3 sources: explicit flag from the parent, a
  // tagged-as-dessert/gourmand category, and the name itself (catches
  // "Mousse au chocolat", "Pancakes" that never got a dessert tag).
  const sweet =
    !!recipe.isSweet ||
    slugs.has('dessert') ||
    slugs.has('gourmand') ||
    isSweetByName(recipe.name);
  const notAMeal = isNotAMeal(recipe.name);

  switch (mealType) {
    case 'déjeuner':
    case 'dîner':
      if (sweet) return false;
      if (notAMeal) return false;
      if (
        slugs.has('apero') ||
        slugs.has('petit-dej') ||
        slugs.has('boisson') ||
        slugs.has('gouter') ||
        slugs.has('accompagnement')
      ) {
        return false;
      }
      return true;
    case 'dessert':
      return sweet;
    case 'apéro':
      return slugs.has('apero');
    case 'goûter':
      return slugs.has('gouter') || sweet;
    case 'petit-déj':
      return slugs.has('petit-dej');
    default:
      return true;
  }
}
