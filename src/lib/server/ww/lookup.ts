/**
 * Match a free-text ingredient name (as written in a recipe) against the
 * WeightWatchers SmartPoints catalogue compiled from Paul's xlsx.
 *
 * The catalogue is small (~200 entries) and queried thousands of times
 * during `compute:nutrition`, so the regexes are pre-compiled once at
 * module load.
 *
 * Matching rules
 * --------------
 * - Strings are normalized: lowercase, NFD-stripped accents, curly
 *   apostrophes folded to straight, whitespace collapsed.
 * - A WW entry matches when its normalized name appears as a whole
 *   word inside the normalized ingredient name (so "Bar" doesn't
 *   match "barbecue" but "saumon" matches "pavé de saumon").
 * - When several entries match, the LONGEST one wins ("saumon fumé"
 *   over "saumon"). This keeps the UI label specific.
 * - Entries shorter than 3 chars are ignored — too risky.
 */
import { WW_ENTRIES, type WwEntry } from './data';

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

type CompiledEntry = {
  entry: WwEntry;
  /** Normalized form used for length-based tie-breaking. */
  norm: string;
  /** Pre-compiled \b...\b regex. */
  re: RegExp;
};

const COMPILED: CompiledEntry[] = WW_ENTRIES.map((entry) => {
  const norm = normalize(entry.name);
  // Allow common French plural / feminine endings on the LAST token.
  // "fraise" → matches "fraise", "fraises", "fraisée"; "haricot" matches
  // "haricots". The flexion is applied only at the trailing word
  // boundary so it doesn't bleed into "fraisier" (gâteau).
  return {
    entry,
    norm,
    re: new RegExp(`\\b${escapeRegex(norm)}(s|e|es)?\\b`)
  };
})
  // Skip ultra-short entries (would over-match).
  .filter((c) => c.norm.length >= 3)
  // Longest first so the first hit is the most specific.
  .sort((a, b) => b.norm.length - a.norm.length);

const COMPILED_ZERO: CompiledEntry[] = COMPILED.filter(
  (c) => c.entry.points === 0
);

/** Look up the most specific WW entry that matches this ingredient name,
 *  or `null` when nothing matches. */
export function findWwEntry(ingredientName: string): WwEntry | null {
  const n = normalize(ingredientName);
  if (!n) return null;
  for (const c of COMPILED) {
    if (c.re.test(n)) return c.entry;
  }
  return null;
}

/** Same as findWwEntry but restricted to ZeroPoints entries. */
export function findZeroPointsEntry(ingredientName: string): WwEntry | null {
  const n = normalize(ingredientName);
  if (!n) return null;
  for (const c of COMPILED_ZERO) {
    if (c.re.test(n)) return c.entry;
  }
  return null;
}

/** Convenience boolean wrapper. */
export function isZeroPoints(ingredientName: string): boolean {
  return findZeroPointsEntry(ingredientName) !== null;
}

/** Count of compiled entries — handy for diagnostics / `npm run check`. */
export const WW_CATALOGUE_SIZE = COMPILED.length;
export const WW_ZEROPOINTS_SIZE = COMPILED_ZERO.length;

/**
 * Neutral / negligible ingredients: salt, pepper, water, vinegar, dried
 * herbs, common spices — things WW would never count as a real point
 * contributor in a normal portion. Used so the "all-ZeroPoints recipe"
 * heuristic doesn't get killed by every recipe having salt or thyme.
 *
 * Match logic is the same as ZeroPoints: case-insensitive, accent-free,
 * whole-word inside the ingredient name.
 */
const NEUTRAL_TOKENS = [
  'sel',
  'poivre',
  'piment',
  'paprika',
  'cumin',
  'curcuma',
  'curry',
  'muscade',
  'cannelle',
  'gingembre',
  'safran',
  'eau',
  'glacons',
  'glace',
  'vinaigre',
  'jus de citron',
  'zeste',
  'thym',
  'romarin',
  'persil',
  'basilic',
  'ciboulette',
  'menthe',
  'aneth',
  'coriandre',
  'estragon',
  'laurier',
  'sauge',
  'origan',
  'cerfeuil',
  'marjolaine',
  'fines herbes',
  'herbes de provence',
  'bouquet garni',
  'ail',
  'echalote',
  'levure',
  'levure chimique',
  'bicarbonate',
  'vanille',
  'gelatine',
  'agar-agar',
  'colorant',
  'edulcorant',
  'stevia',
  'aspartame'
];

const NEUTRAL_RE = NEUTRAL_TOKENS.map((t) => ({
  token: t,
  re: new RegExp(`\\b${escapeRegex(t)}(s|e|es)?\\b`)
}));

/** True when the ingredient name is "free" — neutral or WW ZeroPoints.
 *  Used by the recipe-level "all ZeroPoints" check. */
export function isFreeIngredient(ingredientName: string): boolean {
  const n = normalize(ingredientName);
  if (!n) return true; // empty / placeholder rows shouldn't block the flag
  if (findZeroPointsEntry(ingredientName) !== null) return true;
  for (const { re } of NEUTRAL_RE) {
    if (re.test(n)) return true;
  }
  return false;
}
