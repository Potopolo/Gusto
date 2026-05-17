/** Format a numeric quantity in French notation (comma decimal, max 1 decimal). */
export function formatQty(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '';
  if (Number.isInteger(n)) return n.toString();
  const rounded = Math.round(n * 10) / 10;
  if (Number.isInteger(rounded)) return rounded.toString();
  return rounded.toString().replace('.', ',');
}

/** Format a minute count as "30 min" or "1h30" (hours abbreviated). */
export function formatMinutes(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min) || min <= 0) return '—';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m.toString().padStart(2, '0')}`;
}
