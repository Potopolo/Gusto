/**
 * CLI entry: crawl fourchette-et-bikini.fr by category and persist recipes.
 *
 * Strategy
 * --------
 * 1. The site has no sitemap.xml — instead it exposes one index page per
 *    category (e.g. /recettes/soupes/index.html) with `?page=N` pagination.
 *    We walk every category, fetch each page, and collect distinct recipe
 *    URLs until two pages in a row yield no new URLs.
 * 2. Then we run the same skip-known-urls trick as the Amandine runner so
 *    a re-run picks up only the new recipes.
 * 3. Each recipe page is parsed via fourchette-parser.ts (JSON-LD + the
 *    rendered HTML ingredient list) and persisted with the existing
 *    `persistRecipe`.
 *
 * Usage:
 *   npm run scrape:fourchette
 *   npm run scrape:fourchette -- --limit=20
 *   npm run scrape:fourchette -- --force
 *   npm run scrape:fourchette -- --url=https://www.fourchette-et-bikini.fr/recettes/<slug>.html
 */

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { fetchHtml } from './fetcher';
import { parseFourchetteHTML } from './fourchette-parser';
import { persistRecipe } from './persist';
import * as schema from '../db/schema';
import { recipes } from '../db/schema';

const BASE = 'https://www.fourchette-et-bikini.fr';
const CATEGORIES = [
  'petit-dejeuner-et-gouter',
  'aperitifs',
  'entrees',
  'plats',
  'soupes',
  'salades',
  'desserts',
  'boissons'
];

const dbUrl = process.env.LIBSQL_URL ?? 'file:./data/local.db';
const authToken = process.env.LIBSQL_AUTH_TOKEN;
const client = createClient({ url: dbUrl, authToken });
const db = drizzle(client, { schema });

type Args = { limit?: number; force?: boolean; singleUrl?: string };

function parseArgs(): Args {
  const args: Args = {};
  for (const a of process.argv.slice(2)) {
    if (a === '--force') args.force = true;
    else if (a.startsWith('--limit=')) args.limit = parseInt(a.slice('--limit='.length), 10);
    else if (a.startsWith('--url=')) args.singleUrl = a.slice('--url='.length);
  }
  return args;
}

/** Pull every recipe URL from one category by walking pages. The site
 *  paginates as `?page=N`; we stop after 2 consecutive pages that bring
 *  zero new URLs (cheaper than chasing the "last page" link, which the
 *  template doesn't always render). */
async function crawlCategory(category: string, seen: Set<string>): Promise<string[]> {
  const indexUrl = `${BASE}/recettes/${category}/index.html`;
  const added: string[] = [];
  let page = 1;
  let emptyStreak = 0;

  while (emptyStreak < 2 && page < 50) {
    const url = page === 1 ? indexUrl : `${indexUrl}?page=${page}`;
    let html: string;
    try {
      html = await fetchHtml(url);
    } catch (err) {
      console.warn(`  ⚠ page ${page} of ${category} failed: ${(err as Error).message}`);
      break;
    }

    const matches = Array.from(
      html.matchAll(/href="\/recettes\/([a-z0-9-]+-\d+)\.html"/g)
    );
    let newOnPage = 0;
    for (const m of matches) {
      const slug = m[1]!;
      // Skip URLs that are themselves a category index — only recipe slugs.
      if (CATEGORIES.includes(slug)) continue;
      const full = `${BASE}/recettes/${slug}.html`;
      if (seen.has(full)) continue;
      seen.add(full);
      added.push(full);
      newOnPage++;
    }
    console.log(
      `  [${category}] page ${page}: ${newOnPage} new (${added.length} total in this category)`
    );
    if (newOnPage === 0) emptyStreak++;
    else emptyStreak = 0;
    page++;
  }
  return added;
}

async function main() {
  const args = parseArgs();
  console.log('fourchette-et-bikini scraper — start');

  // --- Phase 1: gather candidate URLs ---------------------------------
  let urls: string[];
  if (args.singleUrl) {
    urls = [args.singleUrl];
    console.log(`Single URL mode: ${args.singleUrl}`);
  } else {
    const seen = new Set<string>();
    for (const cat of CATEGORIES) {
      console.log(`\nCrawling category: ${cat}`);
      await crawlCategory(cat, seen);
    }
    urls = Array.from(seen);
    console.log(`\nTotal distinct recipe URLs across categories: ${urls.length}`);
    if (args.limit) {
      urls = urls.slice(0, args.limit);
      console.log(`  → limited to ${urls.length}`);
    }
  }

  // --- Phase 2: skip URLs already in DB (unless --force) --------------
  const knownUrls = args.force
    ? new Set<string>()
    : new Set(
        (await db.select({ url: recipes.sourceUrl }).from(recipes))
          .map((r) => r.url)
          .filter((u): u is string => u != null)
      );
  if (knownUrls.size > 0) {
    console.log(`\n  → ${knownUrls.size} URLs déjà en base — seront ignorées sans fetch.`);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let notARecipe = 0;
  let errors = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!;
    const label = `[${i + 1}/${urls.length}]`;

    if (knownUrls.has(url)) {
      skipped++;
      console.log(`${label} = (déjà en base, skip sans fetch)`);
      continue;
    }

    try {
      const html = await fetchHtml(url);
      const parsed = parseFourchetteHTML(html, url);
      if (!parsed) {
        notARecipe++;
        console.log(`${label} ✗ pas une recette: ${url.split('/').pop()}`);
        continue;
      }
      const res = await persistRecipe(db, parsed, { force: args.force });
      if (res.status === 'created') {
        created++;
        console.log(
          `${label} ✓ ${parsed.nameFr} — ${res.ingredientsCount} ingr, ${res.tagsCount} tags, ${res.categoriesCount} catégories`
        );
      } else if (res.status === 'updated') {
        updated++;
        console.log(`${label} ↻ ${parsed.nameFr} (mis à jour)`);
      } else if (res.status === 'skipped') {
        skipped++;
        console.log(`${label} = ${parsed.nameFr} (déjà en base)`);
      }
    } catch (err) {
      errors++;
      console.error(`${label} ✗ ERREUR sur ${url}: ${(err as Error).message}`);
    }
  }

  console.log('\n— Crawl terminé —');
  console.log(`  Créées:        ${created}`);
  console.log(`  Mises à jour:  ${updated}`);
  console.log(`  Déjà en base:  ${skipped}`);
  console.log(`  Non-recettes:  ${notARecipe}`);
  console.log(`  Erreurs:       ${errors}`);

  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
