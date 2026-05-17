/**
 * Parser for raw ingredient text from scraped recipes.
 * Examples:
 *   "60g d'oignons nouveaux"     → { quantity: 60, unit: 'g', hint: "oignons nouveaux" }
 *   "2 carottes"                 → { quantity: 2, unit: null, hint: "carottes" }
 *   "0.5 feuille de gélatine"    → { quantity: 0.5, unit: null, hint: "feuille de gélatine" }
 *   "4 CS de sauce soja"         → { quantity: 4, unit: "CS", hint: "sauce soja" }
 *   "Sel, poivre"                → { quantity: null, unit: null, hint: "Sel, poivre" }
 */

export type ParsedIngredient = {
  rawText: string;
  quantity: number | null;
  unit: string | null;
  ingredientHint: string;
};

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5,
  '¼': 0.25,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅕': 0.2,
  '⅖': 0.4,
  '⅗': 0.6,
  '⅘': 0.8,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875
};

// Order matters: longer/multiword patterns first
const UNIT_PATTERNS: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /^cuill[èe]res?\s+[àa]\s+soupe$/i, canonical: 'CS' },
  { pattern: /^cuill[èe]res?\s+[àa]\s+caf[ée]$/i, canonical: 'cc' },
  { pattern: /^kg$/i, canonical: 'kg' },
  { pattern: /^g$|^gr$|^grammes?$/i, canonical: 'g' },
  { pattern: /^mg$/i, canonical: 'mg' },
  { pattern: /^l$|^litres?$/i, canonical: 'l' },
  { pattern: /^cl$/i, canonical: 'cl' },
  { pattern: /^dl$/i, canonical: 'dl' },
  { pattern: /^ml$/i, canonical: 'ml' },
  { pattern: /^cs$/i, canonical: 'CS' },
  { pattern: /^cc$/i, canonical: 'cc' },
  { pattern: /^pinc[ée]es?$/i, canonical: 'pincée' },
  { pattern: /^gousses?$/i, canonical: 'gousse' },
  { pattern: /^sachets?$/i, canonical: 'sachet' },
  { pattern: /^bo[îi]tes?$/i, canonical: 'boîte' },
  { pattern: /^paquets?$/i, canonical: 'paquet' },
  { pattern: /^tasses?$/i, canonical: 'tasse' },
  { pattern: /^verres?$/i, canonical: 'verre' },
  { pattern: /^pots?$/i, canonical: 'pot' },
  { pattern: /^tranches?$/i, canonical: 'tranche' },
  { pattern: /^pi[èe]ces?$/i, canonical: 'pièce' }
];

/** Replace fractions, slash-fractions, and "X à Y" ranges with a single decimal. */
function normalizeNumbers(text: string): string {
  let out = text;
  // "X à Y unit" range → keep X (lower bound). Handles "1 à 2 CS", "400 à 500g".
  out = out.replace(
    /(\d+(?:[.,]\d+)?)\s+(?:à|a)\s+\d+(?:[.,]\d+)?/g,
    (_, first) => first
  );
  // "1½" or "1 ½" → "1.5"
  for (const [frac, val] of Object.entries(UNICODE_FRACTIONS)) {
    out = out.replace(new RegExp(`(\\d+)\\s*${frac}`, 'g'), (_, n) => `${parseInt(n, 10) + val}`);
    out = out.replace(new RegExp(frac, 'g'), `${val}`);
  }
  // "1/2" → "0.5"
  out = out.replace(/(\d+)\s*\/\s*(\d+)/g, (_, a, b) => `${parseInt(a, 10) / parseInt(b, 10)}`);
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}

export function parseIngredient(raw: string): ParsedIngredient {
  const rawText = raw.replace(/\s+/g, ' ').trim();
  if (!rawText) {
    return { rawText, quantity: null, unit: null, ingredientHint: '' };
  }

  // Normalize curly apostrophes to straight so the "d'X" detection works on both forms
  const cleaned = rawText.replace(/[‘’‛`´]/g, "'");
  const normalized = normalizeNumbers(cleaned);

  // 1) Leading number — required for a quantity to be parsed
  const qtyMatch = normalized.match(/^([\d]+(?:[.,][\d]+)?)\s*(.*)$/);
  if (!qtyMatch) {
    return { rawText, quantity: null, unit: null, ingredientHint: rawText };
  }

  const quantity = parseFloat(qtyMatch[1]!.replace(',', '.'));
  if (!Number.isFinite(quantity)) {
    return { rawText, quantity: null, unit: null, ingredientHint: rawText };
  }

  const afterQty = qtyMatch[2]!.trim();
  if (!afterQty) {
    return { rawText, quantity, unit: null, ingredientHint: rawText };
  }

  // 2) Try to match a unit at the start of the remaining text.
  //    A "unit candidate" is the first 1-4 word(s), possibly followed by "de" / "d'".
  //    We only commit to a unit if it matches one of the known patterns.
  const unitMatch = afterQty.match(
    /^([a-zàâéèêëïîôùûüçœ]+(?:\s+[àa]\s+[a-zàâéèêëïîôùûüç]+)?)\s*(?:de\s+|d')?(.*)$/i
  );

  if (unitMatch) {
    const candidate = unitMatch[1]!.trim();
    const matched = UNIT_PATTERNS.find((p) => p.pattern.test(candidate));
    if (matched) {
      const hint = unitMatch[2]!.trim();
      return {
        rawText,
        quantity,
        unit: matched.canonical,
        ingredientHint: hint || rawText
      };
    }
  }

  // Candidate didn't match a real unit → it's part of the ingredient name; keep full afterQty
  return {
    rawText,
    quantity,
    unit: null,
    ingredientHint: afterQty
  };
}
