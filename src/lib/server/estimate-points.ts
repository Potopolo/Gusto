/**
 * Rule-based WW-style points estimator for recipes that lack a computed
 * value (e.g. < 50% of their ingredients matched to CIQUAL).
 *
 * Output range is roughly 2–28 to mirror what the real formula yields
 * across a corpus. Calibrated against the 57 fully-computed recipes:
 *   median = 11, p25 = 7, p75 = 16.
 *
 * Signal sources (in order of weight):
 *   1. Category slugs   — broad bucket (dessert, salade, plat, ...)
 *   2. Style slugs      — léger / gourmand / réconfort modifiers
 *   3. Name keywords    — fritures, fromage, chocolat, légumes...
 */

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const CAT_BASE: Record<string, number> = {
  dessert: 13,
  gourmand: 13,
  plat: 11,
  reconfort: 11,
  soupe: 5,
  salade: 6,
  apero: 6,
  'petit-dej': 8,
  gouter: 9,
  boisson: 3
};

const STYLE_DELTA: Record<string, number> = {
  leger: -3,
  gourmand: +2,
  reconfort: +1
};

type NameRule = { re: RegExp; delta: number };
const NAME_RULES: NameRule[] = [
  { re: /\b(frit|frite|tempura|beignet|donut|nuggets?)\b/, delta: +3 },
  { re: /\b(chocolat|nutella|caramel|praline|speculoos|nougat|tiramisu)\b/, delta: +2 },
  { re: /\b(fromage|gruyere|comte|cheddar|raclette|mozzarella|parmesan|feta|chevre|brie|camembert|reblochon|roquefort)\b/, delta: +2 },
  { re: /\b(creme|beurre|mascarpone|ricotta)\b/, delta: +1 },
  { re: /\b(chorizo|lardon|bacon|saucisse|merguez|jambon cru|porc|magret|foie gras)\b/, delta: +2 },
  { re: /\b(boeuf|agneau|veau|canard)\b/, delta: +1 },
  { re: /\b(poulet|dinde|escalope|filet|cabillaud|saumon|colin|truite|crevette)\b/, delta: 0 },
  { re: /\b(salade verte|crudite|gaspacho|legumes? rotis?)\b/, delta: -2 },
  { re: /\b(courgette|brocoli|epinard|haricot vert|asperge|fenouil|concombre|tomate)\b/, delta: -1 },
  { re: /\b(gateau|tarte|tartelette|moelleux|fondant|cake|brownie|flan|crumble)\b/, delta: +2 },
  { re: /\b(pizza|burger|lasagne|gratin|tartiflette|raclette|fondue)\b/, delta: +3 },
  { re: /\b(quiche|tourte|cake sale)\b/, delta: +1 },
  { re: /\b(velou?te|veloute|smoothie)\b/, delta: -1 }
];

export function estimatePoints(
  nameFr: string,
  slugs: Iterable<string>
): number {
  const slugSet = new Set(slugs);
  const n = norm(nameFr);

  // 1. Base from category — pick the LARGEST base across matches.
  // A recipe tagged both `plat` and `dessert` is rare; if it happens, dessert wins.
  let base = 10; // fallback if no category at all
  for (const s of slugSet) {
    if (CAT_BASE[s] !== undefined && CAT_BASE[s] > (base === 10 ? -1 : base)) {
      base = CAT_BASE[s];
    }
  }
  if (base === 10 && !Object.keys(CAT_BASE).some((k) => slugSet.has(k))) {
    base = 10;
  }

  // 2. Style modifiers
  let delta = 0;
  for (const s of slugSet) {
    if (STYLE_DELTA[s] !== undefined) delta += STYLE_DELTA[s];
  }

  // 3. Name keyword rules (cumulative but capped)
  let nameDelta = 0;
  for (const r of NAME_RULES) {
    if (r.re.test(n)) nameDelta += r.delta;
  }
  nameDelta = Math.max(-4, Math.min(6, nameDelta));

  const total = base + delta + nameDelta;
  return Math.max(2, Math.min(28, Math.round(total)));
}
