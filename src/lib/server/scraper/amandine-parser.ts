import * as cheerio from 'cheerio';
import { parseIngredient, type ParsedIngredient } from './parse-ingredient';

export type ParsedRecipe = {
  sourceUrl: string;
  slug: string;
  nameFr: string;
  introMd: string;
  instructionsMd: string;
  servings: number | null;
  servingsUnit: string | null;
  photoUrl: string | null;
  tags: string[];
  ingredients: Array<ParsedIngredient & { position: number }>;
  rawHtmlCache: string;
  publishedDateRaw: string | null;
};

/** Slug from the trailing URL segment, e.g. "tarte-fraise-rhubarbe". */
function slugFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop() ?? '';
    return last.replace(/\.html?$/i, '');
  } catch {
    return '';
  }
}

/** Normalize whitespace incl. non-breaking spaces (U+00A0) and trim. */
function cleanText(s: string): string {
  return s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

/** Find first h1/h2/h3 in scope whose text matches any of the keyword patterns. */
function findHeadingByKeyword(
  $: cheerio.CheerioAPI,
  scope: cheerio.Cheerio<any>,
  patterns: RegExp[]
): cheerio.Cheerio<any> {
  let found: cheerio.Cheerio<any> = $();
  scope.find('h1, h2, h3').each((_, el) => {
    if (patterns.some((p) => p.test($(el).text()))) {
      found = $(el);
      return false;
    }
  });
  return found;
}

/**
 * Collect text from every <li> inside elements of `listType` between the start heading
 * and the next heading at any level. Handles recipes with sub-sections like
 * "pour la pâte / pour la garniture" that span multiple ULs.
 */
function collectListItemsBetweenHeadings(
  $: cheerio.CheerioAPI,
  startHeading: cheerio.Cheerio<any>,
  listType: 'ul' | 'ol'
): string[] {
  const items: string[] = [];
  let after = false;
  startHeading
    .parent()
    .children()
    .each((_, el) => {
      const $el = $(el);
      if ($el[0] === startHeading[0]) {
        after = true;
        return;
      }
      if (!after) return;
      if ($el.is('h1, h2, h3, h4')) return false;
      if ($el.is(listType)) {
        $el.find('> li').each((_, li) => {
          const t = cleanText($(li).text());
          if (t) items.push(t);
        });
      }
    });
  return items;
}

/** Collect intro paragraphs (text from <p>) appearing before the start heading. */
function collectIntroBefore(
  $: cheerio.CheerioAPI,
  scope: cheerio.Cheerio<any>,
  stopHeading: cheerio.Cheerio<any>
): string[] {
  const parts: string[] = [];
  scope.children().each((_, el) => {
    const $el = $(el);
    if (stopHeading.length && $el[0] === stopHeading[0]) return false;
    if ($el.is('p')) {
      const t = cleanText($el.text());
      if (t) parts.push(t);
    }
  });
  return parts;
}

const INGREDIENTS_PATTERNS = [/ingr[éeèê]dients?/i];
const PREPARATION_PATTERNS = [/pr[éeèê]paration/i, /\b[ée]tapes?\b/i, /\binstructions?\b/i];

/**
 * Parse an Amandine Cooking recipe page.
 * Returns null if the page doesn't look like a recipe (e.g. weekly menu, sponsored post).
 */
export function parseAmandineHTML(html: string, sourceUrl: string): ParsedRecipe | null {
  const $ = cheerio.load(html);

  const post = $('div.Post.Post--OB').first();
  if (!post.length) return null;

  const nameFr = post.find('h2.Post-title').text().trim();
  if (!nameFr) return null;

  const body = post.find('.Post-body .ob-section-html').first();
  if (!body.length) return null;

  // Detect recipe presence via "Ingrédients" heading
  const ingredientsHeading = findHeadingByKeyword($, body, INGREDIENTS_PATTERNS);
  if (!ingredientsHeading.length) return null;

  // Servings: "Ingrédients pour X personnes/parts/verres/portions"
  let servings: number | null = null;
  let servingsUnit: string | null = null;
  const servingsMatch = ingredientsHeading.text().match(/pour\s+(\d+)\s*([a-zàâéèêëïîôùûüçœ]+)?/i);
  if (servingsMatch) {
    servings = parseInt(servingsMatch[1], 10);
    servingsUnit = (servingsMatch[2] ?? 'personnes').toLowerCase();
  }

  // Ingredients: every <li> in every <ul> between "Ingrédients" and the next heading
  const ingredientLines = collectListItemsBetweenHeadings($, ingredientsHeading, 'ul');
  if (ingredientLines.length === 0) return null;

  const ingredients: Array<ParsedIngredient & { position: number }> = ingredientLines.map(
    (raw, position) => ({ ...parseIngredient(raw), position })
  );

  // Instructions: every <li> in every <ol> between "Préparation" and the next heading
  const prepHeading = findHeadingByKeyword($, body, PREPARATION_PATTERNS);
  const instructions = prepHeading.length
    ? collectListItemsBetweenHeadings($, prepHeading, 'ol')
    : [];
  const instructionsMd = instructions.map((s, i) => `${i + 1}. ${s}`).join('\n');

  // Intro: paragraphs before "Ingrédients" heading
  const introParts = collectIntroBefore($, body, ingredientsHeading);
  const introMd = introParts.join('\n\n');

  // Main photo: first <figure> img in body
  const photoUrl = body.find('figure img').first().attr('src') ?? null;

  // Raw tags from Post-tags
  const tags: string[] = [];
  post.find('span.Post-tags a.Post-tag').each((_, a) => {
    const t = $(a).text().trim();
    if (t) tags.push(t);
  });

  const publishedDateRaw = post.find('p.Post-date').text().trim() || null;

  return {
    sourceUrl,
    slug: slugFromUrl(sourceUrl),
    nameFr,
    introMd,
    instructionsMd,
    servings,
    servingsUnit,
    photoUrl,
    tags,
    ingredients,
    rawHtmlCache: html,
    publishedDateRaw
  };
}
