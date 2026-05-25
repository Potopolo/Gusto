import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as s from '../src/lib/server/db/schema';

const c = createClient({ url: 'file:./data/local.db' });
const db = drizzle(c, { schema: s });
const rows = await db.select().from(s.users);
for (const r of rows) {
  console.log(`#${r.id}  ${r.labelFr.padEnd(20)}  household=${r.householdId}`);
}
