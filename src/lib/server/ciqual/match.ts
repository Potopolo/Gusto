import { canonicalize, tokenize } from './text';

export type MatchCandidate = {
  id: number;
  nameFr: string;
  tokens: Set<string>;
  canon: string;
};

/** Build a lookup-ready candidate from a CIQUAL row. */
export function buildCandidate(id: number, nameFr: string): MatchCandidate {
  return {
    id,
    nameFr,
    tokens: new Set(tokenize(nameFr)),
    canon: canonicalize(nameFr)
  };
}

/** F1 score: 2·P·R / (P+R) on token sets. Returns 0 when no overlap. */
export function scoreF1(input: Set<string>, candidate: Set<string>): number {
  if (input.size === 0 || candidate.size === 0) return 0;
  let common = 0;
  for (const t of input) if (candidate.has(t)) common++;
  if (common === 0) return 0;
  const p = common / candidate.size;
  const r = common / input.size;
  return (2 * p * r) / (p + r);
}

/**
 * Find the best CIQUAL candidate.
 * Score = F1 token overlap + 0.2 bonus if candidate canonical starts with the input canonical.
 * The bonus rescues cases like "huile d'olive" where the F1 short-candidate bias picks
 * "Olive noire à l'huile" over the obviously-correct "Huile d'olive vierge extra".
 */
export function findBestMatch(
  inputText: string,
  candidates: MatchCandidate[]
): { candidate: MatchCandidate; score: number } | null {
  const inputTokens = new Set(tokenize(inputText));
  if (inputTokens.size === 0) return null;
  const inputCanon = canonicalize(inputText);

  let best: MatchCandidate | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const f1 = scoreF1(inputTokens, c.tokens);
    if (f1 === 0) continue;
    let s = f1;
    if (inputCanon && c.canon.startsWith(inputCanon)) s = Math.min(1, s + 0.2);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return best ? { candidate: best, score: bestScore } : null;
}
