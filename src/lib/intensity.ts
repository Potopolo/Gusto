/**
 * Virtual filter dimension on /recettes that buckets recipes by their
 * point cost per serving. Mirrors the point-badge colour scale so a
 * pill in "Copieuse" looks orange just like the badges on copieux
 * recipe cards.
 *
 * The bands match src/lib/points-color.ts so the visual language stays
 * consistent across badges, pills and the future shopping mode.
 */
export type IntensitySlug = 'legere' | 'equilibree' | 'copieuse' | 'gourmande';

export type IntensityLevel = {
  slug: IntensitySlug;
  label: string;
  /** Inclusive lower bound */
  min: number;
  /** Inclusive upper bound */
  max: number;
  /** Tailwind class set used by the pill */
  pillClass: string;
  pillActiveClass: string;
};

export const INTENSITY_LEVELS: IntensityLevel[] = [
  {
    slug: 'legere',
    label: 'Légère',
    min: 0,
    max: 5,
    pillClass: 'bg-gusto-scale-green/30 text-gusto-cream hover:bg-gusto-scale-green/50',
    pillActiveClass: 'bg-gusto-scale-green text-gusto-green-900 ring-2 ring-gusto-scale-green'
  },
  {
    slug: 'equilibree',
    label: 'Équilibrée',
    min: 6,
    max: 12,
    pillClass: 'bg-gusto-scale-yellow/30 text-gusto-cream hover:bg-gusto-scale-yellow/50',
    pillActiveClass: 'bg-gusto-scale-yellow text-gusto-green-900 ring-2 ring-gusto-scale-yellow'
  },
  {
    slug: 'copieuse',
    label: 'Copieuse',
    min: 13,
    max: 22,
    pillClass: 'bg-gusto-scale-orange/30 text-gusto-cream hover:bg-gusto-scale-orange/50',
    pillActiveClass: 'bg-gusto-scale-orange text-gusto-cream ring-2 ring-gusto-scale-orange'
  },
  {
    slug: 'gourmande',
    label: 'Gourmande',
    min: 23,
    max: 999,
    pillClass: 'bg-gusto-scale-brown/40 text-gusto-cream hover:bg-gusto-scale-brown/60',
    pillActiveClass: 'bg-gusto-scale-brown text-gusto-cream ring-2 ring-gusto-scale-brown'
  }
];

export const INTENSITY_SLUGS: ReadonlySet<IntensitySlug> = new Set(
  INTENSITY_LEVELS.map((l) => l.slug)
);

export function isIntensitySlug(s: string): s is IntensitySlug {
  return (INTENSITY_SLUGS as Set<string>).has(s);
}

/** Bucket a recipe by its point cost. Returns null if the recipe has no points yet. */
export function bucketFor(points: number | null | undefined): IntensitySlug | null {
  if (points == null) return null;
  for (const lvl of INTENSITY_LEVELS) {
    if (points >= lvl.min && points <= lvl.max) return lvl.slug;
  }
  return null;
}
