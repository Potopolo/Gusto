/**
 * Map a point value to a color scheme.
 * Uses only the brand palette (green for light meals, pink for indulgent).
 * Thresholds calibrated against a 30 pts/day baseline budget.
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
      bg: 'bg-gusto-green',
      text: 'text-gusto-cream',
      ring: 'ring-gusto-green-100',
      label: 'léger'
    };
  }
  if (pts <= 10) {
    return {
      bg: 'bg-gusto-green-700',
      text: 'text-gusto-cream',
      ring: 'ring-gusto-green-100',
      label: 'modéré'
    };
  }
  if (pts <= 15) {
    return {
      bg: 'bg-gusto-pink-200',
      text: 'text-gusto-green-900',
      ring: 'ring-gusto-pink-100',
      label: 'copieux'
    };
  }
  if (pts <= 25) {
    return {
      bg: 'bg-gusto-pink',
      text: 'text-gusto-green-900',
      ring: 'ring-gusto-pink-100',
      label: 'riche'
    };
  }
  return {
    bg: 'bg-gusto-pink-700',
    text: 'text-gusto-cream',
    ring: 'ring-gusto-pink-100',
    label: 'indulgent'
  };
}

/**
 * Convert a `servingsUnit` ("personnes", "parts", "tranches", ...) into a short uppercase label
 * for the points badge. Singularizes plurals and falls back to "PORTION".
 */
export function singularizeUnit(unit: string | null | undefined): string {
  if (!unit) return 'portion';
  const trimmed = unit.trim().toLowerCase();
  if (!trimmed) return 'portion';
  // Crude singularization: drop trailing s on words longer than 3 chars
  if (trimmed.length > 3 && trimmed.endsWith('s')) return trimmed.slice(0, -1);
  return trimmed;
}
