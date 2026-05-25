/** Quick category dump for the codebase. */
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { asc, sql } from 'drizzle-orm';
import * as schema from '../src/lib/server/db/schema';

const client = createClient({ url: 'file:./data/local.db' });
const db = drizzle(client, { schema });

const rows = await db
  .select({
    id: schema.categories.id,
    slug: schema.categories.slug,
    nameFr: schema.categories.nameFr,
    kind: schema.categories.kind,
    n: sql<number>`(select count(*) from recipe_categories rc where rc.category_id = ${schema.categories.id})`
  })
  .from(schema.categories)
  .orderBy(asc(schema.categories.kind), asc(schema.categories.slug));

for (const r of rows) {
  console.log(`  ${r.kind.padEnd(12)} ${r.slug.padEnd(28)} ${r.nameFr.padEnd(30)} ${r.n}`);
}
