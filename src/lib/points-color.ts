/**
 * Map a point value to a color scheme using the Gusto DA "COLOR SCALE" tokens
 * (vert vif → jaune → orange → brun). Food-coded: low = vibrant green, high = brown.
 * Thresholds calibrated against a 30 pts/day baseline budget (WW SmartPoints-aligned).
 */
export type PointsColor = {
  bg: string;
  text: string;
  ring: string;
  label: string;
};

export function pointsColor(pts: number): PointsColor {
  if (pts <= 5) {
    return {
      bg: 'bg-gusto-scale-green',
      text: 'text-gusto-green-900',
      ring: 'ring-gusto-green-100',
      label: 'léger'
    };
  }
  if (pts <= 12) {
    return {
      bg: 'bg-gusto-scale-yellow',
      text: 'text-gusto-green-900',
      ring: 'ring-gusto-green-100',
      label: 'modéré'
    };
  }
  if (pts <= 22) {
    return {
      bg: 'bg-gusto-scale-orange',
      text: 'text-gusto-cream',
      ring: 'ring-gusto-pink-100',
      label: 'copieux'
    };
  }
  return {
    bg: 'bg-gusto-scale-brown',
    text: 'text-gusto-cream',
    ring: 'ring-gusto-pink-100',
    label: 'indulgent'
  };
}

/**
 * Convert a `servingsUnit` ("personnes", "parts", "tranches", ...) into a short uppercase label
 * for the points badge. Singularizes plurals and falls back to "portion".
 */
export function singularizeUnit(unit: string | null | undefined): string {
  if (!unit) return 'portion';
  const trimmed = unit.trim().toLowerCase();
  if (!trimmed) return 'portion';
  if (trimmed.length > 3 && trimmed.endsWith('s')) return trimmed.slice(0, -1);
  return trimmed;
}
