import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

const url = process.env.LIBSQL_URL ?? 'file:./data/local.db';
const authToken = process.env.LIBSQL_AUTH_TOKEN;

const client = createClient({ url, authToken });
const db = drizzle(client);

await migrate(db, { migrationsFolder: './drizzle' });
console.log('Migrations applied to', url);
process.exit(0);
