/**
 * Dump the aggregated shopping list of a menu (using the SAME stem/unit
 * helpers as production) to surface near-duplicate buckets that the
 * current dedup misses. Reads directly from the local SQLite — no
 * SvelteKit / $env required.
 *
 *   npx tsx scripts/dump-shopping.ts [menuId]
 */
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq, inArray } from 'drizzle-orm';
import * as schema from '../src/lib/server/db/schema';

const menuId = parseInt(process.argv[2] ?? '12', 10);
const client = createClient({ url: 'file:./data/local.db' });
const db = drizzle(client, { schema });

// --- Helpers, mirroring src/lib/server/menus/shopping-list.ts -------

const STEM_STOPWORDS = new Set([
  'rouge', 'rouges', 'vert', 'verts', 'verte', 'vertes',
  'jaune', 'jaunes', 'blanc', 'blanche', 'blancs', 'blanches',
  'noir', 'noirs', 'noire', 'noires',
  'cru', 'crue', 'crus', 'crues',
  'cuit', 'cuite', 'cuits', 'cuites',
  'frais', 'fraiche', 'fraiches',
  'bio', 'extra', 'nature', 'naturel', 'naturelle',
  'entier', 'entiere', 'entieres',
  'liquide', 'epaisse', 'epais',
  'vierge', 'vierges', 'pression', 'premiere', 'demi', 'demie',
  'en', 'de', 'du', 'des', 'la', 'le', 'les',
  'a', 'au', 'aux', 'et', 'ou',
  'poudre', 'morceau', 'morceaux', 'pot', 'tube',
  'conserve', 'surgele', 'surgeles', 'surgelee', 'surgelees',
  'sechee', 'sechees', 'seche', 'seches',
  'ciselee', 'ciselees', 'ciseles', 'cisele',
  'haches', 'hachees', 'hachee', 'hache'
]);

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

function stemName(name: string): string {
  const words = normalize(name)
    .split(/[\s,()/-]+/)
    .filter(Boolean)
    .filter((w) => !STEM_STOPWORDS.has(w) && !/^\d/.test(w));
  if (words.length === 0) return normalize(name);
  return words.map((w) => w.replace(/[sx]$/, '')).join(' ');
}

const WEIGHTS_TO_G: Record<string, number> = { g: 1, kg: 1000, mg: 0.001, gr: 1 };
const VOLUMES_TO_ML: Record<string, number> = {
  ml: 1, cl: 10, dl: 100, l: 1000,
  cs: 15, cc: 5,
  cuillere: 15, cuilleres: 15
};

function toBaseUnit(qty: number | null, unit: string | null) {
  if (qty == null) return { qty: null, baseUnit: unit };
  if (!unit) return { qty, baseUnit: null };
  const u = unit.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (WEIGHTS_TO_G[u] != null) return { qty: qty * WEIGHTS_TO_G[u]!, baseUnit: 'g' };
  if (VOLUMES_TO_ML[u] != null) return { qty: qty * VOLUMES_TO_ML[u]!, baseUnit: 'ml' };
  return { qty, baseUnit: u };
}

// --- Pull data ------------------------------------------------------

const slots = await db
  .select({
    slotId: schema.menuSlots.id,
    slotServings: schema.menuSlots.servings,
    recipeId: schema.menuSlots.recipeId,
    recipeServings: schema.recipes.servings
  })
  .from(schema.menuSlots)
  .leftJoin(schema.recipes, eq(schema.menuSlots.recipeId, schema.recipes.id))
  .where(eq(schema.menuSlots.menuId, menuId));

const recipeIds = Array.from(new Set(slots.map((s) => s.recipeId).filter((id): id is number => id != null)));
if (recipeIds.length === 0) {
  console.log(`Menu #${menuId} has no slots.`);
  process.exit(0);
}

const lines = await db
  .select({
    recipeId: schema.recipeIngredients.recipeId,
    rawText: schema.recipeIngredients.rawText,
    quantity: schema.recipeIngredients.quantity,
    unit: schema.recipeIngredients.unit,
    optional: schema.recipeIngredients.optional,
    canonicalName: schema.ingredients.nameFr
  })
  .from(schema.recipeIngredients)
  .leftJoin(schema.ingredients, eq(schema.recipeIngredients.ingredientId, schema.ingredients.id))
  .where(inArray(schema.recipeIngredients.recipeId, recipeIds));

// --- Aggregate (same shape as production: key = stem only) ----------

type Sub = { qty: number | null; baseUnit: string | null; source: string };
type Bucket = { stem: string; display: string; subs: Sub[] };
const buckets = new Map<string, Bucket>();

for (const slot of slots) {
  if (slot.recipeId == null) continue;
  const baseServings = slot.recipeServings ?? slot.slotServings ?? 1;
  const factor = baseServings > 0 ? slot.slotServings / baseServings : 1;
  const recipeLines = lines.filter((l) => l.recipeId === slot.recipeId);
  for (const line of recipeLines) {
    if (line.optional) continue;
    const name = line.canonicalName ?? line.rawText.trim();
    if (!name) continue;
    const scaled = line.quantity != null ? line.quantity * factor : null;
    const { qty, baseUnit } = toBaseUnit(scaled, line.unit);
    const key = stemName(name);
    const ex = buckets.get(key);
    if (ex) {
      ex.subs.push({ qty, baseUnit, source: line.rawText });
      if (name.length < ex.display.length) ex.display = name;
    } else {
      buckets.set(key, {
        stem: key,
        display: name,
        subs: [{ qty, baseUnit, source: line.rawText }]
      });
    }
  }
}

console.log(`Menu #${menuId} → ${buckets.size} aggregated rows.\n`);
console.log('Buckets that combine multiple base units (the new dedup folds these):\n');
let foldedCount = 0;
const sorted = Array.from(buckets.values()).sort((a, b) => a.stem.localeCompare(b.stem));
for (const b of sorted) {
  const byBaseUnit = new Map<string, number>();
  for (const s of b.subs) {
    if (s.qty == null) continue;
    const k = s.baseUnit ?? '';
    byBaseUnit.set(k, (byBaseUnit.get(k) ?? 0) + s.qty);
  }
  if (byBaseUnit.size >= 2 || b.subs.length >= 2) {
    foldedCount++;
    const summary = Array.from(byBaseUnit.entries())
      .map(([u, q]) => `${Math.round(q * 100) / 100} ${u || '(no unit)'}`)
      .join(' + ');
    console.log(`  [${b.stem}]  display="${b.display}"`);
    console.log(`    Sums: ${summary || '(qty-less)'}`);
    for (const s of b.subs.slice(0, 4)) {
      console.log(`        ← ${s.source}`);
    }
    if (b.subs.length > 4) console.log(`        …+${b.subs.length - 4} more`);
  }
}
console.log(`\n${foldedCount} bucket(s) merge multiple sources into a single shopping row.`);
