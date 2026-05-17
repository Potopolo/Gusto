/**
 * Scan recipe instructions to estimate total time and persist in `prepMinutes`.
 * Amandine doesn't structure prep/cook time, so we sum "X min" and "Xh" mentions
 * from the step text. This is approximate — re-runnable when the algo improves.
 */

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { eq } from 'drizzle-orm';
import { recipes } from '../db/schema';

/** Extract total minutes by summing every "X min"/"Xh" mention in the text. */
export function extractMinutes(text: string | null | undefined): number {
  if (!text) return 0;
  let total = 0;
  // "X min" or "X minutes" — handles "5 min", "15 minutes", "30min"
  const minRe = /(\d+)\s*min(?:utes?)?\b/gi;
  let m: RegExpExecArray | null;
  while ((m = minRe.exec(text)) !== null) {
    total += parseInt(m[1]!, 10);
  }
  // "Xh" or "X heures" or "X h 30" (treats hours; we ignore the "30" part since `min` regex catches it separately)
  const hRe = /(\d+)\s*h(?:eures?)?\b/gi;
  while ((m = hRe.exec(text)) !== null) {
    total += parseInt(m[1]!, 10) * 60;
  }
  return total;
}

async function main() {
  const url = process.env.LIBSQL_URL ?? 'file:./data/local.db';
  const authToken = process.env.LIBSQL_AUTH_TOKEN;
  const client = createClient({ url, authToken });
  const db = drizzle(client);

  const rows = await db
    .select({ id: recipes.id, nameFr: recipes.nameFr, instructionsMd: recipes.instructionsMd })
    .from(recipes);

  let updated = 0;
  let withTime = 0;
  let estimated = 0;
  for (const r of rows) {
    const parsed = extractMinutes(r.instructionsMd);
    let minutes: number;
    if (parsed > 0) {
      minutes = parsed;
      withTime++;
    } else {
      // Estimate from step count: ~4 min per step + 10 min base
      const stepCount = (r.instructionsMd ?? '').split('\n').filter(Boolean).length;
      minutes = Math.max(15, 10 + stepCount * 4);
      estimated++;
    }
    await db.update(recipes).set({ prepMinutes: minutes }).where(eq(recipes.id, r.id));
    updated++;
  }
  console.log(`Updated ${updated} recipes:`);
  console.log(`  With explicit time mentions: ${withTime}`);
  console.log(`  Estimated from step count:   ${estimated}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
