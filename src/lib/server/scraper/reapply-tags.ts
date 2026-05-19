/**
 * Re-apply TAG_TO_SLUGS to existing recipe_tags rows so new mappings (added
 * to persist.ts) get reflected in recipe_categories without re-scraping.
 *
 * Idempotent: each (recipe_id, category_id) row is only inserted if missing.
 */

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq, and } from 'drizzle-orm';
import { categories, recipeCategories, recipeTags } from '../db/schema';

// Re-export the canonical mapping so it stays in sync with the scraper.
// Keep this list lowercase.
const TAG_TO_SLUGS: Record<string, string[]> = {
  végetarien: ['vegetarien'],
  vegetarien: ['vegetarien'],
  végétarien: ['vegetarien'],
  vegan: ['vegetalien', 'vegetarien'],
  végétalien: ['vegetalien', 'vegetarien'],
  'sans gluten': ['sans-gluten'],
  'recettes été': ['ete'],
  'recettes hiver': ['hiver'],
  'recettes printemps': ['printemps'],
  'recettes automne': ['automne'],
  plats: ['plat'],
  'plats principaux': ['plat'],
  desserts: ['dessert'],
  'desserts divers': ['dessert'],
  'desserts: crèmes, mousses et flans': ['dessert'],
  'desserts : crème - mousse & flan': ['dessert'],
  soupes: ['soupe', 'reconfort'],
  'soupes & potages': ['soupe', 'reconfort'],
  'soupes & veloutés': ['soupe', 'reconfort'],
  salades: ['salade'],
  'petits déjeuners': ['petit-dej'],
  'petits dejeuners': ['petit-dej'],
  'petit-déjeuner': ['petit-dej'],
  goûters: ['gouter'],
  gouters: ['gouter'],
  apéritifs: ['apero'],
  aperitifs: ['apero'],
  apéritif: ['apero'],
  boissons: ['boisson'],
  cookéo: ['cookeo'],
  cookeo: ['cookeo'],
  airfryer: ['airfryer'],
  'air fryer': ['airfryer'],
  "recettes à l'air fryer": ['airfryer'],
  'recettes thermomix salées': ['thermomix'],
  'recettes thermomix sucrées': ['thermomix'],
  thermomix: ['thermomix'],
  weightwatchers: ['leger'],
  'weight watchers': ['leger'],
  ww: ['leger'],
  'plats mijotés': ['reconfort', 'mijote'],
  'plats mijotes': ['reconfort', 'mijote'],
  gratins: ['reconfort'],
  grâtins: ['reconfort'],
  gâteaux: ['gourmand'],
  gateaux: ['gourmand'],
  'petits gâteaux': ['gourmand'],
  cake: ['gourmand'],
  cakes: ['gourmand'],
  'entremets - bavarois & gâteaux de fêtes': ['gourmand'],
  entremets: ['gourmand'],
  'sorbets & glaces': ['gourmand'],
  'crêpes, gaufres et beignets': ['gourmand'],
  'tartes sucrées': ['gourmand'],
  'confiseries & chocolats': ['gourmand'],
  'biscuits & sablés': ['gourmand'],
  'boulangerie & viennoiserie': ['gourmand'],
  pâtisseries: ['gourmand'],
  patisseries: ['gourmand'],
  'noël et réveillon': ['noel'],
  'noel et reveillon': ['noel'],
  'bûches de noël': ['noel', 'gourmand'],
  'buches de noel': ['noel', 'gourmand']
};

async function main() {
  const url = process.env.LIBSQL_URL ?? 'file:./data/local.db';
  const authToken = process.env.LIBSQL_AUTH_TOKEN;
  const client = createClient({ url, authToken });
  const db = drizzle(client);

  // Slug → category.id
  const allCats = await db.select().from(categories);
  const catBySlug = new Map(allCats.map((c) => [c.slug, c.id]));

  const allTagRows = await db.select().from(recipeTags);

  let inserted = 0;
  let skipped = 0;

  for (const row of allTagRows) {
    const key = row.tag.toLowerCase().trim();
    const slugs = TAG_TO_SLUGS[key];
    if (!slugs) continue;

    for (const slug of slugs) {
      const catId = catBySlug.get(slug);
      if (!catId) continue;

      // Insert if missing
      const existing = await db
        .select()
        .from(recipeCategories)
        .where(
          and(eq(recipeCategories.recipeId, row.recipeId), eq(recipeCategories.categoryId, catId))
        )
        .limit(1);

      if (existing.length) {
        skipped++;
        continue;
      }

      await db.insert(recipeCategories).values({ recipeId: row.recipeId, categoryId: catId });
      inserted++;
    }
  }

  console.log(`Tag mapping re-applied:`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Already present (skipped): ${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
