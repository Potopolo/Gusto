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

/**
 * Find the first section marker in scope matching any of the patterns.
 *
 * Amandine pages use one of three conventions:
 *   1. real headings (h1/h2/h3) — modern template
 *   2. bold text inside a heading wrapper: <h2><strong>Ingrédients:</strong></h2>
 *   3. bold text inside a plain block element: <div><strong>Ingrédients:</strong></div>
 *
 * We try real headings first, then fall back to <div>/<p> with bold content.
 */
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
  if (found.length) return found;

  // Fallback: <div> or <p> opening with a <strong>/<b> whose text matches.
  // Some pages append a parenthetical comment after the bold label
  // (e.g. "Ingrédients: (pour 6 verrines - j'ai utilisé ces verrines d'IKEA…)")
  // so we test the strong's own text, not the whole block's text.
  scope.find('div, p').each((_, el) => {
    const $el = $(el);
    const $strong = $el.find('strong, b').first();
    if (!$strong.length) return;
    const strongTxt = $strong.text();
    if (!patterns.some((p) => p.test(strongTxt))) return;
    // Skip body paragraphs that merely mention the keyword in passing:
    // require the strong text to start the block.
    const blockText = $el.text().trim();
    if (!blockText.startsWith(strongTxt.trim().slice(0, Math.min(4, strongTxt.trim().length)))) {
      return;
    }
    found = $el;
    return false;
  });
  return found;
}

/**
 * Collect text from every <li> inside elements of `listType` that appear AFTER the
 * start heading and BEFORE the next heading.
 *
 * Amandine recipes come in two template variants:
 *   - Old layout: heading and UL are direct siblings (.ob-section-html > h2 + ul).
 *   - New layout: heading is nested inside a wrapper div (.ob-section-html > div > h2),
 *     and the UL is the NEXT sibling of that wrapper div, not of the heading itself.
 *
 * To handle both, we walk up from the heading until we reach a node whose parent
 * is `scope` (the .ob-section-html container) — call this the "section anchor".
 * We then collect lists from anchor.nextAll() until we hit a sibling that either
 * IS a heading or CONTAINS a heading (which would mean we've reached the next
 * recipe section, e.g. "Préparation").
 */
function collectListItemsBetweenHeadings(
  $: cheerio.CheerioAPI,
  scope: cheerio.Cheerio<any>,
  startHeading: cheerio.Cheerio<any>,
  listType: 'ul' | 'ol'
): string[] {
  const items: string[] = [];
  if (!startHeading.length || !scope.length) return items;

  // Walk up until startHeading's ancestor is a direct child of scope.
  let anchor: cheerio.Cheerio<any> = startHeading;
  while (anchor.length && anchor.parent()[0] !== scope[0]) {
    const parent = anchor.parent();
    if (!parent.length) break;
    anchor = parent;
  }
  if (!anchor.length) return items;

  const collectFromUl = ($ul: cheerio.Cheerio<any>) => {
    $ul.find('> li').each((_, li) => {
      const t = cleanText($(li).text());
      if (t) items.push(t);
    });
  };

  // Major section markers that end the ingredients block. Subsection labels like
  // "Pour la pâte:", "Pour le coulis:" must NOT stop the walk — recipes often
  // split ingredients across multiple ULs under such sub-labels.
  const NEXT_SECTION_RE =
    /^(pr[éeèê]paration|[ée]tapes?|instructions?|astuces?|conseils?|foire aux questions|faq|d[’']autres|autres recettes|partager|commenter|vous aimerez|d[ée]tails nutritionnels)\b/i;

  const looksLikeSectionLabel = ($el: cheerio.Cheerio<any>): boolean => {
    if ($el.is('h1, h2, h3, h4')) return true;
    if ($el.find('h1, h2, h3, h4').length > 0) return true;
    if ($el.is('div, p')) {
      const $strong = $el.find('strong, b').first();
      if (!$strong.length) return false;
      const strongTxt = $strong.text().trim();
      if (strongTxt.length > 60) return false;
      if (!NEXT_SECTION_RE.test(strongTxt)) return false;
      const blockText = $el.text().trim();
      return blockText.startsWith(strongTxt.slice(0, Math.min(4, strongTxt.length)));
    }
    return false;
  };

  anchor.nextAll().each((_, el) => {
    const $el = $(el);
    if (looksLikeSectionLabel($el)) return false;
    if ($el.is(listType)) {
      collectFromUl($el);
    } else {
      $el.find(listType).each((_, ul) => collectFromUl($(ul)));
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
  const ingredientLines = collectListItemsBetweenHeadings($, body, ingredientsHeading, 'ul');
  if (ingredientLines.length === 0) return null;

  const ingredients: Array<ParsedIngredient & { position: number }> = ingredientLines.map(
    (raw, position) => ({ ...parseIngredient(raw), position })
  );

  // Instructions: every <li> in every <ol> between "Préparation" and the next heading
  const prepHeading = findHeadingByKeyword($, body, PREPARATION_PATTERNS);
  const instructions = prepHeading.length
    ? collectListItemsBetweenHeadings($, body, prepHeading, 'ol')
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
