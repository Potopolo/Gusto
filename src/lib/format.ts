/** Format a numeric quantity in French notation (comma decimal, max 1 decimal). */
export function formatQty(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '';
  if (Number.isInteger(n)) return n.toString();
  const rounded = Math.round(n * 10) / 10;
  if (Number.isInteger(rounded)) return rounded.toString();
  return rounded.toString().replace('.', ',');
}
