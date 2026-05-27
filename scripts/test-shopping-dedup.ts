/**
 * Smoke-test the shopping-list aggregation logic against synthetic inputs.
 * No DB access — we feed the same shapes that generateShoppingItems
 * normally pulls from Drizzle and validate the resulting buckets.
 */

// Re-import the pure helpers by re-implementing the tiny core. Anything
// else is just typed boilerplate — we want to assert behaviour on the
// stem + unit aggregation, not the SQL pull.
const WEIGHTS_TO_G: Record<string, number> = { g: 1, kg: 1000, mg: 0.001, gr: 1 };
const VOLUMES_TO_ML: Record<string, number> = {
  ml: 1, cl: 10, dl: 100, l: 1000,
  cs: 15, cc: 5
};

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

// Mini in-memory aggregator — same shape & behaviour as the production
// `generateShoppingItems`. Stems-only keys, sub-grouping per base unit,
// primary pick = largest gram/ml total.
type Line = { name: string; qty: number | null; unit: string | null };
function aggregate(lines: Line[]) {
  type Sub = { qty: number | null; baseUnit: string | null };
  type Bucket = { nameFr: string; subs: Sub[] };
  const buckets = new Map<string, Bucket>();
  for (const l of lines) {
    const { qty, baseUnit } = toBaseUnit(l.qty, l.unit);
    const key = stemName(l.name);
    const ex = buckets.get(key);
    if (ex) {
      ex.subs.push({ qty, baseUnit });
      if (l.name.length < ex.nameFr.length) ex.nameFr = l.name;
    } else buckets.set(key, { nameFr: l.name, subs: [{ qty, baseUnit }] });
  }
  return Array.from(buckets.values()).map((b) => {
    const byBaseUnit = new Map<string, number>();
    let hasUnknown = false;
    for (const s of b.subs) {
      if (s.qty == null) {
        hasUnknown = true;
        continue;
      }
      const k = s.baseUnit ?? '';
      byBaseUnit.set(k, (byBaseUnit.get(k) ?? 0) + s.qty);
    }
    if (byBaseUnit.size === 0 && hasUnknown) {
      return { name: b.nameFr, qty: null, unit: null };
    }
    let primary = '';
    let best = -Infinity;
    for (const [u, q] of byBaseUnit) {
      const score = u === 'g' || u === 'ml' ? q + 1e9 : q;
      if (score > best) {
        best = score;
        primary = u;
      }
    }
    const { qty, unit } = fromBaseUnit(byBaseUnit.get(primary) ?? null, primary || null);
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
    label: 'CS + ml on the same item — folded',
    lines: [
      { name: 'Sauce soja', qty: 4, unit: 'CS' },
      { name: 'Sauce soja', qty: 100, unit: 'ml' }
    ],
    expected: [{ name: 'Sauce soja', qty: 16, unit: 'cl' }]
  },
  {
    label: 'qty-less variant dropped when another has qty',
    lines: [
      { name: "Huile d'olive vierge extra", qty: 1, unit: 'CS' },
      { name: "huile d'olive", qty: null, unit: null }
    ],
    expected: [{ name: "huile d'olive", qty: 15, unit: 'ml' }]
  },
  {
    label: 'qty-less only → stays unit-less',
    lines: [{ name: 'Sel', qty: null, unit: null }, { name: 'sel', qty: null, unit: null }],
    expected: [{ name: 'Sel', qty: null, unit: null }]
  },
  {
    label: 'g + CS on flour → unified row',
    lines: [
      { name: 'Farine', qty: 120, unit: 'g' },
      { name: 'Farine', qty: 1, unit: 'CS' }
    ],
    // 120 g vs 15 ml — different base units. Gram wins (real metric).
    expected: [{ name: 'Farine', qty: 120, unit: 'g' }]
  },
  {
    label: 'two flavours of mustard stay separate',
    lines: [
      { name: 'Moutarde', qty: 2, unit: 'CS' },
      { name: "Moutarde à l'ancienne", qty: 1, unit: 'CS' }
    ],
    expected: [
      { name: 'Moutarde', qty: 30, unit: 'ml' },
      { name: "Moutarde à l'ancienne", qty: 15, unit: 'ml' }
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
