/**
 * CLI entry: crawl Amandine Cooking and persist recipes.
 *
 * Usage:
 *   npm run scrape:amandine
 *   npm run scrape:amandine -- --limit=5
 *   npm run scrape:amandine -- --force
 *   npm run scrape:amandine -- --url=https://www.amandinecooking.com/<slug>.html
 */

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { fetchHtml, fetchSitemapUrls } from './fetcher';
import { parseAmandineHTML } from './amandine-parser';
import { persistRecipe } from './persist';
import * as schema from '../db/schema';

const SITEMAP_URL = 'https://www.amandinecooking.com/sitemap.xml';

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

async function main() {
  const args = parseArgs();
  console.log('Amandine Cooking scraper — start');

  let urls: string[];
  if (args.singleUrl) {
    urls = [args.singleUrl];
    console.log(`Single URL mode: ${args.singleUrl}`);
  } else {
    console.log(`Fetching sitemap: ${SITEMAP_URL}`);
    urls = await fetchSitemapUrls(SITEMAP_URL);
    // Dedupe (sitemap-news.xml + sitemapN.xml can overlap)
    urls = Array.from(new Set(urls));
    console.log(`  → ${urls.length} candidate URLs`);
    if (args.limit) {
      urls = urls.slice(0, args.limit);
      console.log(`  → limited to ${urls.length}`);
    }
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let notARecipe = 0;
  let errors = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!;
    const label = `[${i + 1}/${urls.length}]`;
    try {
      const html = await fetchHtml(url);
      const parsed = parseAmandineHTML(html, url);
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
