<script lang="ts">
  /**
   * Recipe photo with a graceful fallback. When `src` is null/missing we
   * paint a soft gradient and overlay a category emoji so the recipe
   * cards still read visually without a real photo. Picks a stable
   * emoji + tint from the recipe's first known category slug.
   */

  type Props = {
    /** The recipe's photoUrl. `null` / `undefined` → fallback artwork. */
    src: string | null | undefined;
    /** Alt text (recipe name). */
    alt: string;
    /** Optional set of category slugs to drive the emoji picker. */
    categorySlugs?: string[];
    /** Extra Tailwind classes applied to the outer element. */
    class?: string;
  };

  let { src, alt, categorySlugs = [], class: extraClass = '' }: Props = $props();

  // First non-null slug we recognise — order matters: type wins over saison.
  const PALETTE: Record<string, { from: string; to: string; emoji: string }> = {
    dessert: { from: '#F5D7E5', to: '#EFBFD5', emoji: '🍰' },
    gourmand: { from: '#F5D7E5', to: '#EFBFD5', emoji: '🍰' },
    apero: { from: '#FDE7D0', to: '#F5D6B2', emoji: '🥂' },
    soupe: { from: '#D9E8DE', to: '#B7D2C0', emoji: '🍲' },
    salade: { from: '#DCE8C5', to: '#BAD09A', emoji: '🥗' },
    plat: { from: '#E5D9CE', to: '#D2BFAC', emoji: '🍽️' },
    boisson: { from: '#D4E4F0', to: '#B0CCE3', emoji: '🥤' },
    'petit-dej': { from: '#FBE6C6', to: '#F2D198', emoji: '🥐' },
    gouter: { from: '#F0DCE6', to: '#DDB8C9', emoji: '🍪' },
    accompagnement: { from: '#E0E8D2', to: '#C2D2A6', emoji: '🥦' },
    // saisons (fallback gradient when no type matched)
    printemps: { from: '#E0EAD0', to: '#C2D49A', emoji: '🌱' },
    ete: { from: '#FDE2C0', to: '#F4C176', emoji: '☀️' },
    automne: { from: '#F2D1B0', to: '#D8A266', emoji: '🍂' },
    hiver: { from: '#D6E0E8', to: '#A7BBCB', emoji: '❄️' }
  };

  const fallback = $derived.by(() => {
    for (const s of categorySlugs) {
      if (PALETTE[s]) return PALETTE[s];
    }
    return { from: '#EAF1ED', to: '#CBDAD0', emoji: '🍴' };
  });
</script>

{#if src}
  <img
    {src}
    {alt}
    loading="lazy"
    class={`object-cover ${extraClass}`}
  />
{:else}
  <div
    role="img"
    aria-label={alt}
    class={`flex items-center justify-center ${extraClass}`}
    style={`background: linear-gradient(135deg, ${fallback.from} 0%, ${fallback.to} 100%);`}
  >
    <span aria-hidden="true" class="text-4xl opacity-75 sm:text-5xl">{fallback.emoji}</span>
  </div>
{/if}
