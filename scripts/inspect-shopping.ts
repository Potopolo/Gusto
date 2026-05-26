/** Dump the aggregated shopping list of a menu to surface duplicate keys. */
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '../src/lib/server/db/schema';
import { generateShoppingItems } from '../src/lib/server/menus/shopping-list';

const menuId = parseInt(process.argv[2] ?? '12', 10);
const client = createClient({ url: 'file:./data/local.db' });
const db = drizzle(client, { schema });
// generateShoppingItems uses the singleton db from $lib/server/db — we
// don't need to inject ours, this is just to verify the file exists.
void db;

const items = await generateShoppingItems(menuId);
console.log(`Menu #${menuId} → ${items.length} aggregated items.\n`);

// Surface near-duplicates by sharing a token in the first word.
const byHead = new Map<string, typeof items>();
for (const it of items) {
  const head = it.nameFr
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[\s,]+/)
    .filter((w) => w.length > 3)[0] ?? '?';
  const list = byHead.get(head) ?? [];
  list.push(it);
  byHead.set(head, list);
}

console.log('Likely-duplicate groups (same head word, multiple rows):');
for (const [head, group] of byHead) {
  if (group.length < 2) continue;
  console.log(`  [${head}]`);
  for (const it of group) console.log(`    - ${(it.qty ?? '?').toString().padStart(6)} ${it.unit ?? ''.padEnd(4)}  ${it.nameFr}`);
}
