<script lang="ts">
  import { formatMinutes } from '$lib/format';
  import { pointsColor, singularizeUnit } from '$lib/points-color';
  import FavoriteHeart from '$lib/components/FavoriteHeart.svelte';
  import { INTENSITY_LEVELS } from '$lib/intensity';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let searchInput = $state(data.q);
  // Filter block collapse state — collapsed by default if no filters are active,
  // expanded if at least one is selected (so the user always sees what's active).
  let filtersOpen = $state(data.selectedCats.length > 0);

  function urlWithToggledCat(slug: string): string {
    const next = data.selectedCats.includes(slug)
      ? data.selectedCats.filter((c) => c !== slug)
      : [...data.selectedCats, slug];
    return buildUrl(data.q, next);
  }

  function buildUrl(q: string, cats: string[]): string {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (cats.length) params.set('cats', cats.join(','));
    const qs = params.toString();
    return qs ? `/recettes?${qs}` : '/recettes';
  }

  const hasFilters = $derived(Boolean(data.q || data.selectedCats.length));
</script>

<section class="space-y-6">
  <header class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-2xl font-semibold text-gusto-cream">Recettes</h1>
      <p class="text-sm text-gusto-cream/70">
        {data.recipes.length} recette{data.recipes.length > 1 ? 's' : ''}
        {hasFilters
          ? ' affichée' + (data.recipes.length > 1 ? 's' : '')
          : ' en bibliothèque'}.
      </p>
    </div>
    <a
      href="/menus"
      class="rounded-md bg-gusto-pink px-4 py-2 text-sm font-medium text-gusto-green-900 hover:bg-gusto-pink-200"
    >
      Faire un menu
    </a>
  </header>

  <form method="get" class="flex gap-2">
    <input
      type="search"
      name="q"
      placeholder="Rechercher par nom…"
      bind:value={searchInput}
      class="block w-full rounded-md text-gusto-green-900 placeholder:text-gusto-green-200 shadow-sm"
    />
    {#if data.selectedCats.length}
      <input type="hidden" name="cats" value={data.selectedCats.join(',')} />
    {/if}
    {#if hasFilters}
      <a
        href="/recettes?cats="
        class="rounded-md border border-gusto-cream/30 bg-transparent px-3 py-2 text-sm text-gusto-cream hover:bg-gusto-cream/10"
      >
        Effacer
      </a>
    {/if}
    <button
      type="submit"
      class="rounded-md bg-gusto-pink px-4 py-2 text-sm font-medium text-gusto-green-900 hover:bg-gusto-pink-200"
    >
      Chercher
    </button>
  </form>

  {#if data.groupedPills.length}
    <div class="space-y-2.5">
      <button
        type="button"
        onclick={() => (filtersOpen = !filtersOpen)}
        aria-expanded={filtersOpen}
        class="flex items-center gap-2 text-xs uppercase tracking-wide text-gusto-cream/70 hover:text-gusto-cream"
      >
        <span
          aria-hidden="true"
          class="text-[10px] transition-transform {filtersOpen ? 'rotate-90' : ''}"
        >
          ▶
        </span>
        <span>Filtres</span>
        {#if data.selectedCats.length > 0}
          <span class="rounded-full bg-gusto-pink px-1.5 py-0.5 text-[10px] font-semibold text-gusto-green-900">
            {data.selectedCats.length}
          </span>
        {/if}
      </button>

      {#if filtersOpen}
        {#if data.selectedCats.length > 0}
          <p class="text-xs text-gusto-cream/70">
            <a href={buildUrl(data.q, [])} class="underline hover:text-gusto-cream"
              >Tout désélectionner</a
            >
          </p>
        {/if}
        <!-- First row: virtual filter dimension derived from
             points_per_serving. Passive pills look like the rest of the
             list; active pills pick up the band colour from the
             points-badge scale (green / yellow / orange / brown). -->
        <div class="flex flex-wrap items-baseline gap-2">
          <span class="w-20 flex-none text-xs uppercase tracking-wide text-gusto-cream/60">
            Plaisir
          </span>
          <div class="flex flex-wrap gap-1.5">
            {#each INTENSITY_LEVELS as lvl (lvl.slug)}
              {@const stats = data.intensityPills.find((p) => p.slug === lvl.slug)}
              {@const active = data.selectedCats.includes(lvl.slug)}
              <a
                href={urlWithToggledCat(lvl.slug)}
                aria-current={active ? 'true' : undefined}
                class="rounded-full px-3 py-1 text-xs font-medium transition {active
                  ? lvl.pillActiveClass
                  : lvl.pillClass}"
              >
                {lvl.label}
                <span class="ml-1 opacity-60">{stats?.count ?? 0}</span>
              </a>
            {/each}
          </div>
        </div>

        {#each data.groupedPills as group (group.kind)}
          <div class="flex flex-wrap items-baseline gap-2">
            <span class="w-20 flex-none text-xs uppercase tracking-wide text-gusto-cream/60">
              {group.labelFr}
            </span>
            <div class="flex flex-wrap gap-1.5">
              {#each group.pills as pill (pill.slug)}
                {@const active = data.selectedCats.includes(pill.slug)}
                <a
                  href={urlWithToggledCat(pill.slug)}
                  aria-current={active ? 'true' : undefined}
                  class="rounded-full px-3 py-1 text-xs font-medium transition {active
                    ? 'bg-gusto-pink text-gusto-green-900'
                    : 'bg-gusto-cream/10 text-gusto-cream hover:bg-gusto-cream/20'}"
                >
                  {pill.nameFr}
                  <span class="ml-1 opacity-60">{pill.count}</span>
                </a>
              {/each}
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}

  {#if data.recipes.length === 0}
    <p
      class="rounded-lg border border-dashed border-gusto-cream/30 bg-gusto-cream/5 p-6 text-center text-sm text-gusto-cream/80"
    >
      {#if data.q && data.selectedCats.length}
        Aucune recette ne correspond à « {data.q} » avec ces filtres.
      {:else if data.q}
        Aucune recette ne correspond à « {data.q} ».
      {:else if data.selectedCats.length}
        Aucune recette ne combine toutes ces catégories. Essaie d'en retirer une.
      {:else}
        Aucune recette en bibliothèque.
      {/if}
    </p>
  {:else}
    <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each data.recipes as recipe (recipe.id)}
        <li>
          <a
            href={`/recettes/${recipe.slug}`}
            class="group block overflow-hidden rounded-lg bg-gusto-cream transition hover:ring-2 hover:ring-gusto-pink"
          >
            <div class="relative">
              {#if recipe.photoUrl}
                <div class="aspect-[4/3] overflow-hidden bg-gusto-green-50">
                  <img
                    src={recipe.photoUrl}
                    alt={recipe.nameFr}
                    loading="lazy"
                    class="h-full w-full object-cover transition group-hover:scale-105"
                  />
                </div>
              {:else}
                <div class="aspect-[4/3] bg-gusto-green-50"></div>
              {/if}

              {#if recipe.pointsPerServing != null}
                {@const c = pointsColor(recipe.pointsPerServing)}
                <div
                  class="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full {c.bg} {c.text} shadow-sm ring-2 ring-gusto-cream"
                  title="{recipe.pointsPerServing} points par {singularizeUnit(
                    recipe.servingsUnit
                  )}"
                >
                  <span class="text-base font-semibold leading-none"
                    >{recipe.pointsPerServing}</span
                  >
                </div>
              {/if}

              <div class="absolute left-2 top-2">
                <FavoriteHeart
                  kind="recipe"
                  id={recipe.id}
                  favorited={recipe.isFavorite}
                  variant="overlay"
                />
              </div>
            </div>

            <div class="space-y-1 p-4">
              <h2 class="font-normal leading-snug text-gusto-green-900">{recipe.nameFr}</h2>

              <p class="flex flex-wrap items-center gap-x-2 text-xs text-gusto-green-700/70">
                <span class="inline-flex items-center gap-1">
                  <span aria-hidden="true">⏱</span>
                  {formatMinutes(recipe.prepMinutes)}
                </span>
                {#if recipe.servings}
                  <span aria-hidden="true">·</span>
                  <span>
                    {recipe.servings}
                    {singularizeUnit(recipe.servingsUnit)}{recipe.servings > 1 ? 's' : ''}
                  </span>
                {/if}
                {#if recipe.pointsPerServing != null}
                  <span aria-hidden="true">·</span>
                  <span class="font-medium text-gusto-green-900">
                    {recipe.pointsPerServing} pts/{singularizeUnit(recipe.servingsUnit)}
                  </span>
                {/if}
              </p>
            </div>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</section>
