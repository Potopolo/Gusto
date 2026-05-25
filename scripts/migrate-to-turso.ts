/**
 * One-shot data migration from the local SQLite (`./data/local.db`) to a
 * hosted Turso libSQL instance. Designed to be re-runnable: existing
 * rows on the destination are wiped before the copy so you can iterate
 * on the dump until it looks right.
 *
 * Usage
 * -----
 *
 *   # 1. Run the Drizzle migrations against Turso first so the schema
 *   #    matches what's in `drizzle/*.sql`:
 *   $env:LIBSQL_URL = "libsql://gusto-prod-...turso.io"
 *   $env:LIBSQL_AUTH_TOKEN = "eyJ..."
 *   npm run db:migrate
 *
 *   # 2. Then copy the data:
 *   npx tsx scripts/migrate-to-turso.ts
 *
 *   # Optional flags:
 *   --strip-html     Don't copy recipes.rawHtmlCache (≈ 200 MB saved on
 *                    1800 recipes; the field isn't needed at runtime
 *                    once backfill-fourchette-nutrition has run).
 *   --dry            Print the row counts that would be copied, no write.
 *
 * Notes
 * -----
 * - We DELETE FROM each destination table in reverse FK order before
 *   inserting, so re-running the script doesn't pile duplicates.
 * - Inserts are batched (200 rows / statement) — Turso has a soft limit
 *   on the SQL string length per request.
 * - Foreign keys are respected by inserting tables in dependency order.
 * - libSQL booleans come back as 0/1 integers; we cast them through the
 *   schema's `inferSelect` shape so Drizzle does the right thing on the
 *   destination side.
 */
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { sql } from 'drizzle-orm';
import * as schema from '../src/lib/server/db/schema';

const stripHtml = process.argv.includes('--strip-html');
const dry = process.argv.includes('--dry');

const destUrl = process.env.LIBSQL_URL;
const destToken = process.env.LIBSQL_AUTH_TOKEN;

if (!dry) {
  if (!destUrl || !destUrl.startsWith('libsql://')) {
    console.error('LIBSQL_URL must be a libsql:// URL pointing at your Turso DB.');
    process.exit(1);
  }
  if (!destToken) {
    console.error('LIBSQL_AUTH_TOKEN is required.');
    process.exit(1);
  }
}

const localClient = createClient({ url: 'file:./data/local.db' });
const localDb = drizzle(localClient, { schema });

const destClient = dry
  ? null
  : createClient({ url: destUrl!, authToken: destToken! });
const destDb = destClient ? drizzle(destClient, { schema }) : null;

/** Table copy order — parents BEFORE children so FK constraints are
 *  satisfied row-by-row. Reversed for the wipe pass. */
const TABLES = [
  { name: 'households', table: schema.households },
  { name: 'users', table: schema.users },
  { name: 'profiles', table: schema.profiles },
  { name: 'equipment', table: schema.equipment },
  { name: 'categories', table: schema.categories },
  { name: 'ingredients', table: schema.ingredients },
  { name: 'recipes', table: schema.recipes },
  { name: 'recipeIngredients', table: schema.recipeIngredients },
  { name: 'recipeEquipment', table: schema.recipeEquipment },
  { name: 'recipeCategories', table: schema.recipeCategories },
  { name: 'recipeTags', table: schema.recipeTags },
  { name: 'menus', table: schema.menus },
  { name: 'menuSlots', table: schema.menuSlots },
  { name: 'shoppingLists', table: schema.shoppingLists },
  { name: 'shoppingListItems', table: schema.shoppingListItems },
  { name: 'favoriteRecipes', table: schema.favoriteRecipes },
  { name: 'favoriteIngredients', table: schema.favoriteIngredients }
] as const;

async function main() {
  console.log(`Source:      file:./data/local.db`);
  console.log(`Destination: ${destUrl}`);
  if (stripHtml) console.log('Flag:        --strip-html (recipes.rawHtmlCache will be nulled)');
  if (dry) console.log('Flag:        --dry (no writes)');
  console.log();

  // --- Phase 1: counts -------------------------------------------------
  console.log('Source row counts:');
  for (const { name, table } of TABLES) {
    const [r] = await localDb.select({ n: sql<number>`count(*)` }).from(table);
    console.log(`  ${name.padEnd(22)} ${r.n}`);
  }

  if (dry) {
    console.log('\nDry run — no writes. Exiting.');
    process.exit(0);
  }

  if (!destDb) {
    console.error('Destination DB not initialised — internal error.');
    process.exit(1);
  }

  // --- Phase 2: wipe destination (reverse FK order) -------------------
  console.log('\nWiping destination tables...');
  for (const { name, table } of [...TABLES].reverse()) {
    await destDb.delete(table);
    process.stdout.write(`  cleared ${name}\n`);
  }

  // --- Phase 3: copy each table ---------------------------------------
  console.log('\nCopying rows...');
  for (const { name, table } of TABLES) {
    let rows = (await localDb.select().from(table)) as Record<string, unknown>[];
    if (rows.length === 0) {
      console.log(`  ${name.padEnd(22)} 0 rows — skipped`);
      continue;
    }

    if (stripHtml && name === 'recipes') {
      rows = rows.map((r) => ({ ...r, rawHtmlCache: null }));
    }

    // Drizzle's `.insert(...).values(rows)` builds a single INSERT with
    // N value lists. We chunk to keep Turso happy.
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      // Cast back to schema-typed insert rows. Trust the source.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await destDb.insert(table as any).values(chunk as any);
    }

    // Sanity check: dest count == source count.
    const [destCount] = await destDb.select({ n: sql<number>`count(*)` }).from(table);
    const match = Number(destCount.n) === rows.length ? '✓' : '✗';
    console.log(`  ${name.padEnd(22)} ${rows.length} rows  ${match} (dest=${destCount.n})`);
  }

  console.log('\nDone. Now point Cloudflare Pages at the same Turso DB via env vars:');
  console.log('  LIBSQL_URL         = (the libsql:// URL above)');
  console.log('  LIBSQL_AUTH_TOKEN  = (the token used here)');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
