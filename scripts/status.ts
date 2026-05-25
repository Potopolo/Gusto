import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { sql, like } from 'drizzle-orm';
import * as schema from '../src/lib/server/db/schema';

const client = createClient({ url: 'file:./data/local.db' });
const db = drizzle(client, { schema });

const [t] = await db
  .select({ total: sql<number>`count(*)` })
  .from(schema.recipes);
const [a] = await db
  .select({ n: sql<number>`count(*)` })
  .from(schema.recipes)
  .where(like(schema.recipes.sourceUrl, '%amandinecooking.com%'));
const [f] = await db
  .select({ n: sql<number>`count(*)` })
  .from(schema.recipes)
  .where(like(schema.recipes.sourceUrl, '%fourchette-et-bikini%'));
const [latest] = await db
  .select({ when: sql<string>`max(${schema.recipes.createdAt})` })
  .from(schema.recipes);

console.log(`Total recipes: ${t.total}`);
console.log(`  Amandine:    ${a.n}`);
console.log(`  Fourchette:  ${f.n}`);
const ts = Number(latest.when);
if (ts) console.log(`Latest insert: ${new Date(ts * 1000).toISOString()}`);
