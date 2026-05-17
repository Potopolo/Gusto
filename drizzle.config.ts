import type { Config } from 'drizzle-kit';

const url = process.env.LIBSQL_URL ?? 'file:./data/local.db';
const authToken = process.env.LIBSQL_AUTH_TOKEN;

export default {
  schema: './src/lib/server/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: url.startsWith('libsql') ? 'turso' : undefined,
  dbCredentials: url.startsWith('libsql')
    ? { url, authToken: authToken ?? '' }
    : { url }
} satisfies Config;
