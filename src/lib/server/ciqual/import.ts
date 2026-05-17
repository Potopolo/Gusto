/**
 * Import the CIQUAL nutritional composition table (Excel) into the ingredients table.
 *
 * Setup:
 *   1. Download CIQUAL XLSX from https://entrepot.recherche.data.gouv.fr (DOI 10.57745/RDMHWY)
 *   2. Save as data/ciqual.xlsx
 *   3. npm run import:ciqual
 *
 * Idempotent: upserts by alim_code (ciqualCode). Re-runs are safe.
 */

import * as XLSX from 'xlsx';
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { ingredients, type NutritionPer100g } from '../db/schema';
import { canonicalize } from './text';

const XLSX_PATH = './data/ciqual.xlsx';
const SHEET_NAME = 'composition nutritionnelle';

// Column indices verified against "Table Ciqual 2025_FR_2025_11_03.xlsx"
const COL = {
  alim_code: 6,
  alim_nom_fr: 7,
  kcal: 10,
  protein: 14,
  carbs: 16,
  fat: 17,
  sugar: 18,
  fiber: 26,
  sat_fat: 31,
  salt: 49
};

/** Parse a CIQUAL cell. Plain numbers as-is; "<X" / "traces" / "-" → 0 or null. */
function parseValue(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim();
  if (!s || s === '-' || s.toLowerCase() === 'nd') return null;
  if (s.toLowerCase().startsWith('trace')) return 0;
  if (s.startsWith('<')) return 0; // below detection limit
  const n = parseFloat(s.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

async function main() {
  if (!existsSync(XLSX_PATH)) {
    console.error(`✗ ${XLSX_PATH} introuvable. Voir l'en-tête de import.ts pour la procédure.`);
    process.exit(1);
  }

  console.log(`Lecture de ${XLSX_PATH}...`);
  const buf = readFileSync(XLSX_PATH);
  const wb = XLSX.read(buf, { type: 'buffer', cellNF: false });
  const ws = wb.Sheets[SHEET_NAME];
  if (!ws) {
    console.error(`✗ Sheet "${SHEET_NAME}" introuvable. Présentes : ${wb.SheetNames.join(', ')}`);
    process.exit(1);
  }

  const range = XLSX.utils.decode_range(ws['!ref']!);
  console.log(`  → ${range.e.r} lignes de données`);

  const url = process.env.LIBSQL_URL ?? 'file:./data/local.db';
  const authToken = process.env.LIBSQL_AUTH_TOKEN;
  const client = createClient({ url, authToken });
  const db = drizzle(client);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (let r = 1; r <= range.e.r; r++) {
    const get = (c: number) => ws[XLSX.utils.encode_cell({ r, c })]?.v;

    const alimCode = get(COL.alim_code);
    const nameRaw = get(COL.alim_nom_fr);
    if (!alimCode || !nameRaw) {
      skipped++;
      continue;
    }

    const ciqualCode = String(alimCode);
    const nameFr = String(nameRaw).trim();
    const nameCanonical = canonicalize(nameFr);

    const nutrition: NutritionPer100g = {
      kcal: parseValue(get(COL.kcal)) ?? 0,
      protein_g: parseValue(get(COL.protein)) ?? 0,
      fat_g: parseValue(get(COL.fat)) ?? 0,
      sat_fat_g: parseValue(get(COL.sat_fat)) ?? 0,
      carbs_g: parseValue(get(COL.carbs)) ?? 0,
      sugar_g: parseValue(get(COL.sugar)) ?? 0,
      fiber_g: parseValue(get(COL.fiber)) ?? 0,
      salt_g: parseValue(get(COL.salt)) ?? 0
    };

    const existing = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.ciqualCode, ciqualCode))
      .limit(1);

    if (existing[0]) {
      await db
        .update(ingredients)
        .set({
          nameFr,
          nameCanonical,
          nutritionPer100g: nutrition,
          nutritionSource: 'ciqual',
          fetchedAt: new Date()
        })
        .where(eq(ingredients.id, existing[0].id));
      updated++;
    } else {
      await db.insert(ingredients).values({
        nameFr,
        nameCanonical,
        ciqualCode,
        nutritionPer100g: nutrition,
        nutritionSource: 'ciqual',
        fetchedAt: new Date()
      });
      inserted++;
    }

    if ((inserted + updated) % 500 === 0 && inserted + updated > 0) {
      console.log(`  ${inserted + updated} traités…`);
    }
  }

  console.log(`\n— Import CIQUAL terminé —`);
  console.log(`  Insérés:    ${inserted}`);
  console.log(`  Mis à jour: ${updated}`);
  console.log(`  Ignorés:    ${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
