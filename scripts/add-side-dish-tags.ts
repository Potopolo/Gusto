/**
 * Ensures the `salade`, `soupe`, `accompagnement` type categories exist
 * and rule-based-tags the existing Amandine recipes whose names look like
 * one of those. Idempotent: re-running won't duplicate links.
 *
 *   npx tsx scripts/add-side-dish-tags.ts            # dry run, prints what would change
 *   npx tsx scripts/add-side-dish-tags.ts --apply    # actually writes
 */
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { and, eq } from 'drizzle-orm';
import * as schema from '../src/lib/server/db/schema';

const apply = process.argv.includes('--apply');
const client = createClient({ url: 'file:./data/local.db' });
const db = drizzle(client, { schema });
const { categories, recipes, recipeCategories } = schema;

// 1. Ensure the 3 categories exist (idempotent).
const wanted = [
  { slug: 'salade', nameFr: 'Salade', kind: 'type' as const },
  { slug: 'soupe', nameFr: 'Soupe', kind: 'type' as const },
  { slug: 'accompagnement', nameFr: 'Accompagnement', kind: 'type' as const }
];

const catBySlug = new Map<string, number>();
for (const w of wanted) {
  const [existing] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, w.slug))
    .limit(1);
  if (existing) {
    catBySlug.set(w.slug, existing.id);
    console.log(`  ✓ category "${w.slug}" already exists (id=${existing.id})`);
    continue;
  }
  if (apply) {
    const [ins] = await db.insert(categories).values(w).returning({ id: categories.id });
    catBySlug.set(w.slug, ins!.id);
    console.log(`  + created category "${w.slug}" (id=${ins!.id})`);
  } else {
    console.log(`  · would create category "${w.slug}"`);
    catBySlug.set(w.slug, -1);
  }
}

// 2. Rule-based tagging from recipe name. We err on the side of recall:
//    a wrong "soupe" tag is easier to live with than a missing one.
const rules: Array<{ slug: string; re: RegExp }> = [
  {
    slug: 'soupe',
    re: /\b(soupe|velout[ée]e?|gaspacho|chowder|bouillon|consomm[ée]|minestrone|cr[èe]me\s+de\s+l[ée]gumes?)\b/i
  },
  {
    slug: 'salade',
    re: /\b(salade|taboul[ée]|coleslaw|wrap)\b/i
  },
  {
    slug: 'accompagnement',
    // Loose side-dish pattern: starches, roasted/braised vegetables, etc.
    // We pre-screen out names that clearly mention a main protein later
    // (see `proteinKill`) to keep the recall high without too many full
    // meals leaking in.
    re: /\b(pur[ée]es?|riz|polenta|semoule|boulgour|quinoa|p[ôo]el[ée]e|tian|ratatouille|caponata|coleslaw|gratin\s+de\s+(courge|courgette|chou|c[ée]leri|f[ée]nouil|brocoli|poireaux?|aubergines?|patate|p[ôo]m)|l[ée]gumes\s+(r[ôo]tis|grill[ée]s?|au\s+four|vapeur|farcis?|saut[ée]s)|frites?\s+de\s+(patate|carotte|courgette|c[ée]leri|panais)|chou\s+(rouge|fris[ée]|romanesco)|pommes?\s+de\s+terre\s+(saut[ée]es?|r[ôo]ties?|au\s+four|vapeur|grenaille|farcies?))\b/i
  }
];

/** Names that clearly look like a full meal should NOT be tagged as a
 *  side dish. Used only for the `accompagnement` rule. */
const proteinKill =
  /\b(poulet|dinde|canard|caille|pintade|magret|cailles?|veau|bœuf|boeuf|porc|jambon|saucisses?|merguez|chorizo|bacon|lardons|agneau|mouton|gigot|saumon|cabillaud|colin|thon|truite|crevettes?|gambas|moules|st\s*jacques|noix\s+de\s+saint|seitan|tofu|oeufs?|œufs?|fromage|feta|mozzarella|ch[èe]vre|reblochon|comt[ée]|cheddar|halloumi|bacon|boursin|parmesan|ricotta|b[ée]chamel|cr[èe]me\s+fra[îi]che|poisson)\b/i;

/** Sweet preparations that share keywords with savory side dishes
 *  (riz au lait, gâteau de semoule, etc.) should NOT be flagged as
 *  accompagnement either. */
const dessertKill =
  /\b(riz\s+au\s+lait|g[âa]teau\s+de\s+semoule|au\s+chocolat|au\s+caramel|aux?\s+pommes?|aux?\s+poires?|aux?\s+fraises?|aux?\s+framboises?|aux?\s+abricots?|aux?\s+myrtilles?|aux?\s+cerises?|sucre|p[âa]te\s+[àa]\s+tartiner|nutella|spec(u|ú)loos|nougat|caramel|chocolat|miel|confiture|sirop\s+d[’']?agave|crumble|tartelette|tarte|muffin|cookie|brownie|cake|gâteau|moelleux|flan(?!\s+de\s+l[ée]gumes)|crème\s+dessert|panna\s+cotta|tiramisu|charlotte|brioche|pancake|gaufres?|crêpes?|gnocchis?)\b/i;

const allRecipes = await db
  .select({ id: recipes.id, name: recipes.nameFr })
  .from(recipes);

let added = 0;
let alreadyTagged = 0;

for (const r of allRecipes) {
  for (const rule of rules) {
    if (!rule.re.test(r.name)) continue;
    // The accompagnement rule is loose — drop it if the recipe also
    // mentions a main protein (full meal) or sweet keywords (dessert).
    if (rule.slug === 'accompagnement') {
      if (proteinKill.test(r.name)) continue;
      if (dessertKill.test(r.name)) continue;
    }

    const catId = catBySlug.get(rule.slug)!;

    // Dry-run for not-yet-existing categories: we can't query the join
    // (no id yet) but we still want to advertise what WOULD be added.
    if (catId < 0) {
      added++;
      console.log(`  · ${rule.slug.padEnd(15)} → #${r.id}  ${r.name}  (cat to create)`);
      continue;
    }

    // Check if the link already exists.
    const [exists] = await db
      .select({ recipeId: recipeCategories.recipeId })
      .from(recipeCategories)
      .where(
        and(
          eq(recipeCategories.recipeId, r.id),
          eq(recipeCategories.categoryId, catId)
        )
      )
      .limit(1);
    if (exists) {
      alreadyTagged++;
      continue;
    }

    if (apply) {
      await db.insert(recipeCategories).values({ recipeId: r.id, categoryId: catId });
      added++;
      console.log(`  + ${rule.slug.padEnd(15)} → #${r.id}  ${r.name}`);
    } else {
      added++;
      console.log(`  · ${rule.slug.padEnd(15)} → #${r.id}  ${r.name}`);
    }
  }
}

console.log(`\n— ${apply ? 'Applied' : 'Dry run'} —`);
console.log(`  Already tagged: ${alreadyTagged}`);
console.log(`  ${apply ? 'Added' : 'Would add'}:       ${added}`);
if (!apply) console.log(`\nRe-run with --apply to commit.`);
