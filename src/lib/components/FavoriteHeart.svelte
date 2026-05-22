<script lang="ts">
  /**
   * Toggleable heart icon. Hits POST /api/favorites and updates the local
   * `favorited` state optimistically. Rolls back on network/HTTP failure.
   *
   * Usage:
   *   <FavoriteHeart kind="recipe" id={recipe.id} favorited={recipe.isFavorite} />
   *   <FavoriteHeart kind="ingredient" id={ing.id} favorited={ing.isFavorite} size="sm" />
   *
   * `size`:
   *   - 'sm' → 24 px hit box, smaller heart (for ingredient rows)
   *   - 'md' → 32 px (default, for recipe cards)
   *   - 'lg' → 40 px (recipe detail header)
   *
   * `variant`:
   *   - 'default' → outline heart on light bg, filled pink when favorited
   *   - 'overlay' → semi-transparent disc for use over recipe photos
   */
  type Props = {
    kind: 'recipe' | 'ingredient';
    id: number;
    favorited?: boolean;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'default' | 'overlay';
    /** Optional callback after a successful toggle */
    onToggle?: (favorited: boolean) => void;
  };

  let {
    kind,
    id,
    favorited = $bindable(false),
    size = 'md',
    variant = 'default',
    onToggle
  }: Props = $props();

  let busy = $state(false);

  // Tailwind sizing per "size" prop — Tailwind needs literal class names,
  // not template-interpolated, so use a small lookup.
  const BOX = { sm: 'h-6 w-6', md: 'h-8 w-8', lg: 'h-10 w-10' } as const;
  const ICON = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' } as const;

  async function toggle(e: MouseEvent) {
    // Don't let the surrounding card link/button intercept the click
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const prev = favorited;
    favorited = !prev;
    busy = true;
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, id })
      });
      if (!res.ok) {
        favorited = prev;
      } else {
        const body = (await res.json()) as { favorited: boolean };
        favorited = body.favorited;
        onToggle?.(favorited);
      }
    } catch {
      favorited = prev;
    } finally {
      busy = false;
    }
  }
</script>

<button
  type="button"
  onclick={toggle}
  aria-label={favorited ? 'Retirer des favoris' : 'Ajouter aux favoris'}
  aria-pressed={favorited}
  title={favorited ? 'Retirer des favoris' : 'Ajouter aux favoris'}
  disabled={busy}
  class="{BOX[size]} flex flex-none items-center justify-center rounded-full transition {variant ===
  'overlay'
    ? 'bg-gusto-green-900/40 text-gusto-cream backdrop-blur-sm hover:bg-gusto-green-900/60'
    : 'text-gusto-green-700/60 hover:bg-gusto-pink/30 hover:text-gusto-pink-700'} {favorited
    ? variant === 'overlay'
      ? 'text-gusto-pink'
      : 'text-gusto-pink-700 hover:bg-transparent'
    : ''} disabled:opacity-60"
>
  <span aria-hidden="true" class={ICON[size]}>{favorited ? '♥' : '♡'}</span>
</button>
