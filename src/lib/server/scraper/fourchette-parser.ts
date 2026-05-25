/**
 * Parser for fourchette-et-bikini.fr recipe pages.
 *
 * Layout: each recipe page embeds a `<script type="application/ld+json">`
 * block with a schema.org Recipe object alongside its sibling lists. We
 * pull the structured fields (name, description, instructions, image,
 * nutrition, prep/cook times) from the JSON-LD and the ingredient list
 * from the rendered HTML, because the site systematically leaves the
 * Recipe.recipeIngredient array empty (rendered server-side instead).
 */
import * as cheerio from 'cheerio';
import { parseIngredient } from './parse-ingredient';
import type { ParsedRecipe } from './amandine-parser';

type LdRecipe = {
  '@type'?: string | string[];
  name?: string;
  description?: string;
  image?: string | { url?: string } | Array<string | { url?: string }>;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeYield?: string | number;
  recipeCategory?: string | string[];
  recipeCuisine?: string;
  keywords?: string;
  author?: { '@type'?: string; name?: string } | string;
  datePublished?: string;
  recipeIngredient?: string[];
  recipeInstructions?:
    | string
    | Array<string | { '@type'?: string; name?: string; text?: string }>;
};

function slugFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop() ?? '';
    return last.replace(/\.html?$/i, '');
  } catch {
    return '';
  }
}

/** Strip the trailing numeric id from the slug, "panna-cotta-...-40238" → "panna-cotta-...". */
function cleanSlug(rawSlug: string): string {
  return rawSlug.replace(/-\d+$/, '');
}

/** Find the first JSON-LD object whose @type contains "Recipe". */
function findRecipeLd($: cheerio.CheerioAPI): LdRecipe | null {
  const blocks = $('script[type="application/ld+json"]');
  for (const el of blocks.toArray()) {
    const raw = $(el).contents().text();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const candidates: unknown[] = [];
    const flatten = (v: unknown) => {
      if (!v) return;
      if (Array.isArray(v)) {
        v.forEach(flatten);
        return;
      }
      if (typeof v === 'object') {
        const obj = v as Record<string, unknown>;
        if ('@graph' in obj && Array.isArray(obj['@graph'])) {
          (obj['@graph'] as unknown[]).forEach(flatten);
        }
        candidates.push(obj);
      }
    };
    flatten(parsed);
    for (const c of candidates) {
      const obj = c as LdRecipe;
      const t = obj['@type'];
      const types = Array.isArray(t) ? t : [t];
      if (types.some((x) => typeof x === 'string' && /recipe/i.test(x))) {
        return obj;
      }
    }
  }
  return null;
}

/** "PT20M" → 20, "PT1H30M" → 90, missing/invalid → null. */
function isoDurationToMinutes(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/);
  if (!m) return null;
  const h = parseInt(m[1] ?? '0', 10);
  const min = parseInt(m[2] ?? '0', 10);
  const total = h * 60 + min;
  return total > 0 ? total : null;
}

function firstString(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    for (const x of v) {
      const s = firstString(x);
      if (s) return s;
    }
  }
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    if (typeof obj.url === 'string') return obj.url;
    if (typeof obj.contentUrl === 'string') return obj.contentUrl as string;
  }
  return null;
}

/** Decode `&#xE9;` and a few common HTML entities the JSON-LD escapes. */
function decodeHtml(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

/** Strip basic HTML tags from a description string. */
function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/** Map fourchette-et-bikini URL paths + keywords to our internal tag set.
 *  These are stored as raw tags; persist.ts/reapply-tags.ts will map them
 *  to canonical category slugs via TAG_TO_SLUGS. */
function tagsFromContext(url: string, ld: LdRecipe | null): string[] {
  const out = new Set<string>();
  // From the URL path: /recettes/<category>/<slug>.html — when present
  // the category segment tells us soupes / salades / plats / desserts...
  try {
    const u = new URL(url);
    const segs = u.pathname.split('/').filter(Boolean);
    if (segs[0] === 'recettes' && segs.length >= 3) {
      out.add(segs[1]); // e.g. "soupes", "salades", "plats"
    }
  } catch {
    /* noop */
  }
  // From the LD recipeCategory + keywords (case-insensitive).
  const dumpKeyword = (s: string) => {
    s.split(/[,;]/).forEach((kw) => {
      const t = kw.trim().toLowerCase();
      if (t && t.length < 40) out.add(t);
    });
  };
  if (typeof ld?.recipeCategory === 'string') dumpKeyword(ld.recipeCategory);
  if (Array.isArray(ld?.recipeCategory)) ld!.recipeCategory.forEach(dumpKeyword);
  if (typeof ld?.keywords === 'string') dumpKeyword(ld.keywords);
  return Array.from(out);
}

/** Parse the rendered HTML ingredient list into ParsedRecipe-compatible
 *  rows. Each `<li class="ingredient_item">` has a label span + a qty
 *  span; we join them and feed the result to the existing
 *  parse-ingredient.ts so the unit/quantity heuristics stay shared. */
function parseIngredientsHtml(
  $: cheerio.CheerioAPI
): Array<ReturnType<typeof parseIngredient> & { position: number }> {
  const out: Array<ReturnType<typeof parseIngredient> & { position: number }> = [];
  $('ul.ingredient_list li.ingredient_item').each((idx, li) => {
    const label = $(li).find('.ingredient_label').text().trim();
    const qty = $(li).find('.ingredient_qte').text().trim();
    if (!label) return;
    const raw = qty ? `${qty} ${label}` : label;
    out.push({ ...parseIngredient(raw), position: idx });
  });
  return out;
}

/** Servings: e.g. "4 pers." or "6 personnes". Defaults to null when absent. */
function parseServings($: cheerio.CheerioAPI): {
  count: number | null;
  unit: string | null;
} {
  const txt = $('#LblRecetteNombre').first().text().trim();
  if (!txt) return { count: null, unit: null };
  const m = txt.match(/(\d+)\s*(\S.*)?$/);
  if (!m) return { count: null, unit: null };
  const count = parseInt(m[1]!, 10);
  const unit = (m[2] ?? '').replace(/\.?$/, '').trim() || 'pers.';
  return { count: Number.isFinite(count) ? count : null, unit };
}

/** Convert recipeInstructions (string or HowToStep[]) into a single
 *  markdown-numbered list compatible with `recipes.instructionsMd`. */
function instructionsMd(ld: LdRecipe | null): string {
  const ri = ld?.recipeInstructions;
  if (!ri) return '';
  if (typeof ri === 'string') {
    return ri
      .split(/\n+/)
      .map((s: string, i: number) => `${i + 1}. ${decodeHtml(stripTags(s))}`)
      .filter((l: string) => l.length > 3)
      .join('\n');
  }
  return ri
    .map((step) => {
      if (typeof step === 'string') return decodeHtml(stripTags(step));
      if (step && typeof step === 'object') {
        const text = step.text ?? step.name ?? '';
        return decodeHtml(stripTags(text));
      }
      return '';
    })
    .filter((t) => t.length > 0)
    .map((t, i) => `${i + 1}. ${t}`)
    .join('\n');
}

export function parseFourchetteHTML(html: string, url: string): ParsedRecipe | null {
  const $ = cheerio.load(html);
  const ld = findRecipeLd($);

  // Title — prefer LD name, fall back to <h1>.
  const nameRaw = ld?.name ?? $('h1').first().text();
  const nameFr = decodeHtml(stripTags(nameRaw ?? '')).trim();
  if (!nameFr) return null;

  // Skip pages that don't carry a real recipe (legal/about pages occasionally
  // sit under /recettes/ but lack the ingredient list).
  const ingredients = parseIngredientsHtml($);
  if (ingredients.length === 0) return null;

  const intro = ld?.description ? decodeHtml(stripTags(ld.description)) : '';
  const instr = instructionsMd(ld);

  const { count: servings, unit: servingsUnit } = parseServings($);

  // Photo — LD image first, then OG meta as fallback.
  const photoUrl =
    firstString(ld?.image) ?? $('meta[property="og:image"]').attr('content') ?? null;

  const tags = tagsFromContext(url, ld);

  const slugRaw = slugFromUrl(url);
  const slug = cleanSlug(slugRaw);

  return {
    sourceUrl: url,
    slug,
    nameFr,
    introMd: intro,
    instructionsMd: instr,
    servings,
    servingsUnit,
    photoUrl,
    tags,
    ingredients,
    rawHtmlCache: html,
    publishedDateRaw: ld?.datePublished ?? null
  };
}

/** Optional helper: extract prep/cook minutes from the LD for callers that
 *  want to set `prepMinutes` / `cookMinutes` on the recipe row. The main
 *  parser returns a ParsedRecipe (no time fields) because the upstream
 *  persist.ts ignores them today; this is here for forward-compat. */
export function parseFourchetteTimes(html: string): {
  prepMinutes: number | null;
  cookMinutes: number | null;
} {
  const $ = cheerio.load(html);
  const ld = findRecipeLd($);
  const prep = isoDurationToMinutes(ld?.prepTime);
  const cook = isoDurationToMinutes(ld?.cookTime);
  return { prepMinutes: prep, cookMinutes: cook };
}
