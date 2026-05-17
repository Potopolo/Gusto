/** Text normalization helpers shared by CIQUAL import + ingredient matching. */

/** Lowercase, expand ligatures, normalize fancy quotes, strip accents, strip parenthesized content. */
export function canonicalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[‘’‛`´]/g, "'") // curly apostrophes → straight
    .replace(/[“”„]/g, '"') // curly quotes → straight
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-z0-9 ,'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set([
  'de',
  'du',
  'des',
  'le',
  'la',
  'les',
  'un',
  'une',
  'au',
  'aux',
  "l'",
  "d'",
  'en',
  'et',
  'ou',
  'a',
  'avec',
  'sans',
  'pour'
]);

/** Tokenize: canonicalize, split on spaces/commas/apostrophes, drop stop words and short tokens. */
export function tokenize(s: string): string[] {
  const canon = canonicalize(s);
  return canon
    .split(/[\s,'-]+/)
    .map((t) => t.replace(/s$/, '')) // crude singularization
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}
