/**
 * Smoke-test the shopping-list aggregation logic against synthetic inputs.
 * No DB access — we feed the same shapes that generateShoppingItems
 * normally pulls from Drizzle and validate the resulting buckets.
 */

// Re-import the pure helpers by re-implementing the tiny core. Anything
// else is just typed boilerplate — we want to assert behaviour on the
// stem + unit aggregation, not the SQL pull.
const WEIGHTS_TO_G: Record<string, number> = { g: 1, kg: 1000, mg: 0.001, gr: 1 };
const VOLUMES_TO_ML: Record<string, number> = { ml: 1, cl: 10, dl: 100, l: 1000 };

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
  'en', 'de', 'du', 'des', 'la', 'le', 'les',
  'a', 'au', 'aux', 'et', 'ou',
  'poudre', 'morceau', 'morceaux', 'pot', 'tube',
  'conserve', 'surgele', 'surgeles', 'surgelee', 'surgelees'
]);

function normalizeKey(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

function stemName(name: string): string {
  const words = normalizeKey(name).split(/[\s,()/-]+/).filter(Boolean)
    .filter((w) => !STEM_STOPWORDS.has(w) && !/^\d/.test(w));
  if (words.length === 0) return normalizeKey(name);
  return words.map((w) => w.replace(/[sx]$/, '')).join(' ');
}

function toBaseUnit(qty: number | null, unit: string | null) {
  if (qty == null) return { qty: null, baseUnit: unit };
  if (!unit) return { qty, baseUnit: null };
  const u = unit.toLowerCase().trim();
  if (WEIGHTS_TO_G[u] != null) return { qty: qty * WEIGHTS_TO_G[u]!, baseUnit: 'g' };
  if (VOLUMES_TO_ML[u] != null) return { qty: qty * VOLUMES_TO_ML[u]!, baseUnit: 'ml' };
  return { qty, baseUnit: u };
}

function fromBaseUnit(qty: number | null, baseUnit: string | null) {
  if (qty == null) return { qty: null, unit: baseUnit };
  if (baseUnit === 'g') {
    if (qty >= 1000) return { qty: Math.round((qty / 1000) * 100) / 100, unit: 'kg' };
    return { qty: Math.round(qty), unit: 'g' };
  }
  if (baseUnit === 'ml') {
    if (qty >= 1000) return { qty: Math.round((qty / 1000) * 100) / 100, unit: 'L' };
    if (qty >= 100 && qty % 10 === 0) return { qty: qty / 10, unit: 'cl' };
    return { qty: Math.round(qty), unit: 'ml' };
  }
  return { qty: Math.round(qty * 10) / 10, unit: baseUnit };
}

// Mini in-memory aggregator that mirrors generateShoppingItems
type Line = { name: string; qty: number | null; unit: string | null };
function aggregate(lines: Line[]) {
  type Bucket = { nameFr: string; qty: number | null; baseUnit: string | null };
  const buckets = new Map<string, Bucket>();
  for (const l of lines) {
    const { qty, baseUnit } = toBaseUnit(l.qty, l.unit);
    const key = `${stemName(l.name)}|${baseUnit ?? ''}`;
    const ex = buckets.get(key);
    if (ex) {
      if (ex.qty != null && qty != null) ex.qty += qty;
      else if (ex.qty == null) ex.qty = qty;
      if (l.name.length < ex.nameFr.length) ex.nameFr = l.name;
    } else buckets.set(key, { nameFr: l.name, qty, baseUnit });
  }
  return Array.from(buckets.values()).map((b) => {
    const { qty, unit } = fromBaseUnit(b.qty, b.baseUnit);
    return { name: b.nameFr, qty, unit };
  });
}

// Test cases — each block represents ingredient lines coming from
// different recipes in the same menu. The expected output is the
// aggregated shopping list.
type Test = { label: string; lines: Line[]; expected: Array<{ name: string; qty: number | null; unit: string | null }> };

const tests: Test[] = [
  {
    label: 'same item same unit',
    lines: [
      { name: 'Oignon', qty: 100, unit: 'g' },
      { name: 'Oignon', qty: 200, unit: 'g' }
    ],
    expected: [{ name: 'Oignon', qty: 300, unit: 'g' }]
  },
  {
    label: 'g vs kg merged',
    lines: [
      { name: 'Farine', qty: 500, unit: 'g' },
      { name: 'Farine', qty: 1, unit: 'kg' }
    ],
    expected: [{ name: 'Farine', qty: 1.5, unit: 'kg' }]
  },
  {
    label: 'cl + ml merged',
    lines: [
      { name: 'Lait', qty: 30, unit: 'cl' },
      { name: 'Lait', qty: 200, unit: 'ml' }
    ],
    expected: [{ name: 'Lait', qty: 50, unit: 'cl' }]
  },
  {
    label: 'qualifier variations folded',
    lines: [
      { name: 'Oignon, rouge, cru', qty: 100, unit: 'g' },
      { name: 'Oignons rouges', qty: 50, unit: 'g' },
      { name: 'Oignon', qty: 50, unit: 'g' }
    ],
    expected: [{ name: 'Oignon', qty: 200, unit: 'g' }]
  },
  {
    label: 'plurals folded',
    lines: [
      { name: 'Tomate', qty: 200, unit: 'g' },
      { name: 'Tomates', qty: 100, unit: 'g' }
    ],
    expected: [{ name: 'Tomate', qty: 300, unit: 'g' }]
  },
  {
    label: 'incompatible units stay separate',
    lines: [
      { name: 'Sucre', qty: 100, unit: 'g' },
      { name: 'Sucre vanillé', qty: 1, unit: 'sachet' }
    ],
    expected: [
      { name: 'Sucre', qty: 100, unit: 'g' },
      { name: 'Sucre vanillé', qty: 1, unit: 'sachet' }
    ]
  }
];

let pass = 0;
let fail = 0;
for (const t of tests) {
  const got = aggregate(t.lines);
  const ok =
    got.length === t.expected.length &&
    got.every((g, i) =>
      g.name === t.expected[i]!.name &&
      g.qty === t.expected[i]!.qty &&
      g.unit === t.expected[i]!.unit
    );
  const status = ok ? '✓' : '✗';
  console.log(`  ${status} ${t.label}`);
  if (!ok) {
    console.log(`    expected: ${JSON.stringify(t.expected)}`);
    console.log(`    got:      ${JSON.stringify(got)}`);
  }
  if (ok) pass++;
  else fail++;
}
console.log(`\n${pass}/${pass + fail} passing`);
process.exit(fail > 0 ? 1 : 0);
