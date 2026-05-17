import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { and, eq } from 'drizzle-orm';
import { households, users, profiles, equipment, categories } from './schema';
import {
  defaultMacroTargets,
  defaultDietaryPrefs,
  defaultPointsFormula,
  defaultProfileValues
} from './defaults';

const url = process.env.LIBSQL_URL ?? 'file:./data/local.db';
const authToken = process.env.LIBSQL_AUTH_TOKEN;
const client = createClient({ url, authToken });
const db = drizzle(client);

// Categories seed (global taxonomy used for recipe tagging)
const categoriesSeed = [
  // Temps
  { slug: 'rapide', nameFr: 'Rapide', kind: 'temps' },
  { slug: 'mijote', nameFr: 'Mijoté', kind: 'temps' },
  { slug: 'batch', nameFr: 'Batch', kind: 'temps' },
  // Régime
  { slug: 'vegetarien', nameFr: 'Végétarien', kind: 'régime' },
  { slug: 'vegetalien', nameFr: 'Végétalien', kind: 'régime' },
  { slug: 'poisson', nameFr: 'Poisson', kind: 'régime' },
  { slug: 'viande-blanche', nameFr: 'Viande blanche', kind: 'régime' },
  { slug: 'viande-rouge', nameFr: 'Viande rouge', kind: 'régime' },
  { slug: 'sans-gluten', nameFr: 'Sans gluten', kind: 'régime' },
  // Type
  { slug: 'plat', nameFr: 'Plat', kind: 'type' },
  { slug: 'entree', nameFr: 'Entrée', kind: 'type' },
  { slug: 'dessert', nameFr: 'Dessert', kind: 'type' },
  { slug: 'soupe', nameFr: 'Soupe', kind: 'type' },
  { slug: 'salade', nameFr: 'Salade', kind: 'type' },
  { slug: 'petit-dej', nameFr: 'Petit-déj', kind: 'type' },
  { slug: 'gouter', nameFr: 'Goûter', kind: 'type' },
  { slug: 'apero', nameFr: 'Apéro', kind: 'type' },
  { slug: 'boisson', nameFr: 'Boisson', kind: 'type' },
  // Saison
  { slug: 'printemps', nameFr: 'Printemps', kind: 'saison' },
  { slug: 'ete', nameFr: 'Été', kind: 'saison' },
  { slug: 'automne', nameFr: 'Automne', kind: 'saison' },
  { slug: 'hiver', nameFr: 'Hiver', kind: 'saison' },
  // Équipement
  { slug: 'cookeo', nameFr: 'Cookéo', kind: 'équipement' },
  { slug: 'airfryer', nameFr: 'Airfryer', kind: 'équipement' },
  { slug: 'mini-four', nameFr: 'Mini four', kind: 'équipement' },
  { slug: 'plaque', nameFr: 'Plaque', kind: 'équipement' },
  { slug: 'blender', nameFr: 'Blender', kind: 'équipement' }
];

// Equipment seed (owned reflects Paul's current kitchen, May 2026)
const equipmentSeed = [
  { nameFr: 'Mini four combiné', category: 'cooking', owned: true },
  { nameFr: 'Plaque électrique', category: 'cooking', owned: true },
  { nameFr: 'Cookéo', category: 'cooking', owned: true },
  { nameFr: 'Airfryer', category: 'cooking', owned: true },
  { nameFr: 'Blender', category: 'small_appliance', owned: true },
  { nameFr: 'Mixeur plongeant', category: 'small_appliance', owned: false },
  { nameFr: 'Four traditionnel', category: 'cooking', owned: false },
  { nameFr: 'Micro-ondes séparé', category: 'cooking', owned: false },
  { nameFr: 'Plaque induction', category: 'cooking', owned: false },
  { nameFr: 'Plaque vitrocéramique', category: 'cooking', owned: false },
  { nameFr: 'Robot pâtissier', category: 'small_appliance', owned: false },
  { nameFr: 'Autocuiseur traditionnel', category: 'cooking', owned: false },
  { nameFr: 'Friteuse', category: 'cooking', owned: false },
  { nameFr: 'Machine à pain', category: 'small_appliance', owned: false },
  { nameFr: 'Cuiseur vapeur', category: 'small_appliance', owned: false }
];

async function main() {
  // 1. Household — idempotent: reuse the first existing one if any
  const existingHouseholds = await db.select().from(households).limit(1);
  let householdId: number;
  if (existingHouseholds[0]) {
    householdId = existingHouseholds[0].id;
  } else {
    const [hh] = await db.insert(households).values({ name: 'Foyer Paul' }).returning();
    if (!hh) throw new Error('Failed to create default household');
    householdId = hh.id;
  }

  // 2. Users — idempotent: check by (householdId, labelFr)
  const defaultUserLabels = ['Paul', 'Autre'];
  let newUserCount = 0;
  for (const labelFr of defaultUserLabels) {
    const existing = await db
      .select()
      .from(users)
      .where(and(eq(users.householdId, householdId), eq(users.labelFr, labelFr)))
      .limit(1);
    if (existing[0]) continue;
    const [u] = await db.insert(users).values({ householdId, labelFr }).returning();
    if (!u) continue;
    newUserCount++;
    await db.insert(profiles).values({
      userId: u.id,
      ...defaultProfileValues,
      macroTargets: defaultMacroTargets,
      dietaryPrefs: defaultDietaryPrefs,
      pointsFormulaConfig: defaultPointsFormula
    });
  }

  // 4. Equipment
  for (const e of equipmentSeed) {
    await db.insert(equipment).values(e).onConflictDoNothing();
  }

  // 5. Categories
  for (const c of categoriesSeed) {
    await db.insert(categories).values(c).onConflictDoNothing();
  }

  console.log(
    `Seed done: household ${householdId}, ${newUserCount} new user(s), ${equipmentSeed.length} equipment items, ${categoriesSeed.length} categories.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
