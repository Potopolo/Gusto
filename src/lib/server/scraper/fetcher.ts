/**
 * Polite, rate-limited HTTP fetcher for Amandine Cooking.
 * - Minimum 6 s between requests (above the 5 s crawl-delay observed in robots.txt)
 * - Identifying User-Agent
 * - Retry with exponential backoff on 429 / 5xx (max 3 attempts)
 */

const MIN_DELAY_MS = 6000;
const MAX_RETRIES = 3;
const USER_AGENT = 'meal-planner-personal/0.1 (private use; contact: paul@example.local)';

let lastFetchAt = 0;

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = lastFetchAt + MIN_DELAY_MS - now;
  if (wait > 0) await sleep(wait);
  lastFetchAt = Date.now();
}

export async function fetchHtml(url: string): Promise<string> {
  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    await throttle();
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5'
        }
      });
      if (res.ok) return await res.text();
      if (res.status === 429 || res.status >= 500) {
        // retry
        attempt++;
        const backoff = MIN_DELAY_MS * Math.pow(2, attempt);
        console.warn(`  ⚠ HTTP ${res.status} for ${url} — retry in ${backoff / 1000}s`);
        await sleep(backoff);
        continue;
      }
      throw new Error(`HTTP ${res.status} for ${url}`);
    } catch (err) {
      attempt++;
      if (attempt >= MAX_RETRIES) throw err;
      const backoff = MIN_DELAY_MS * Math.pow(2, attempt);
      console.warn(`  ⚠ fetch error ${(err as Error).message} — retry in ${backoff / 1000}s`);
      await sleep(backoff);
    }
  }
  throw new Error(`Max retries exceeded for ${url}`);
}

/** Parse a sitemap.xml or sitemap-index.xml and return all recipe-page URLs. */
export async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  const xml = await fetchHtml(sitemapUrl);

  // If it's a sitemap index, recurse into sub-sitemaps (skipping tags/news/pages variants we
  // already know aren't recipe-focused; sitemap-news.xml is fresh recipes — keep it).
  if (/<sitemapindex/i.test(xml)) {
    const subSitemaps = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g))
      .map((m) => m[1])
      .filter((u) => /sitemap-news\.xml|sitemap\d+\.xml/i.test(u));
    const all: string[] = [];
    for (const sub of subSitemaps) {
      const urls = await fetchSitemapUrls(sub);
      all.push(...urls);
    }
    return all;
  }

  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g))
    .map((m) => m[1])
    .filter(
      (u) =>
        u.startsWith('https://www.amandinecooking.com/') &&
        u.endsWith('.html') &&
        !u.includes('/tag/') &&
        !/\/menu-/i.test(u) &&
        !/\/menu-de-la-semaine/i.test(u)
    );
}
