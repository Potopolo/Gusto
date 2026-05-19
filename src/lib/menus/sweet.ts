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
 * Decide whether a recipe is appropriate for a given meal type.
 * Pure: takes the recipe's categories (slugs) + isSweet flag + (optionally) tags.
 */
export function isRecipeForMealType(
  recipe: { categories: { slug: string }[]; isSweet?: boolean },
  mealType: string
): boolean {
  const slugs = new Set(recipe.categories.map((c) => c.slug));
  const sweet = !!recipe.isSweet || slugs.has('dessert') || slugs.has('gourmand');

  switch (mealType) {
    case 'déjeuner':
    case 'dîner':
      if (sweet) return false;
      if (
        slugs.has('apero') ||
        slugs.has('petit-dej') ||
        slugs.has('boisson') ||
        slugs.has('gouter')
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
    case 'collation':
      return true;
    default:
      return true;
  }
}
