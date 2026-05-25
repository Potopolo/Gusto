<script lang="ts">
  import { formatMinutes } from '$lib/format';
  import { pointsColor, singularizeUnit } from '$lib/points-color';
  import FavoriteHeart from '$lib/components/FavoriteHeart.svelte';
  import RecipeImage from '$lib/components/RecipeImage.svelte';
  import { INTENSITY_LEVELS } from '$lib/intensity';
  import { untrack } from 'svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  // Local input state — seeded from the URL once. SvelteKit re-mounts this
  // page on full navigation, so a stale capture is fine; untrack() makes
  // the intent explicit and silences the state_referenced_locally warning.
  let searchInput = $state(untrack(() => data.q));
  // Filter block collapse state — collapsed by default if no filters are active,
  // expanded if at least one is selected (so the user always sees what's active).
  let filtersOpen = $state(untrack(() => data.selectedCats.length > 0));

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

  <form method="get" class="flex gap-4">
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
    <button
      type="submit"
      aria-label="Chercher"
      title="Chercher"
      class="flex flex-none items-center justify-center rounded-md bg-gusto-pink px-3.5 text-gusto-green-900 hover:bg-gusto-pink-200"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="h-5 w-5"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    </button>
  </form>

  {#if data.groupedPills.length}
    <div class="space-y-1.5">
      <div class="flex items-center gap-3">
        <button
          type="button"
          onclick={() => (filtersOpen = !filtersOpen)}
          aria-expanded={filtersOpen}
          class="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gusto-cream/70 hover:text-gusto-cream"
        >
          <span
            aria-hidden="true"
            class="text-[9px] transition-transform {filtersOpen ? 'rotate-90' : ''}"
          >
            ▶
          </span>
          <span>Filtres</span>
          {#if data.selectedCats.length > 0}
            <span class="rounded-full bg-gusto-pink px-1.5 py-0.5 text-[9px] font-semibold text-gusto-green-900">
              {data.selectedCats.length}
            </span>
          {/if}
        </button>
        {#if filtersOpen && data.selectedCats.length > 0}
          <a
            href={buildUrl(data.q, [])}
            class="text-[11px] text-gusto-cream/60 underline-offset-2 hover:text-gusto-cream hover:underline"
          >
            Tout désélectionner
          </a>
        {/if}
      </div>

      {#if filtersOpen}
        <!-- Virtual "Plaisir" group first, derived from points_per_serving. -->
        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <span class="text-[10px] uppercase tracking-wide text-gusto-cream/60">
              Plaisir
            </span>
            <div class="h-px flex-1 bg-gusto-cream/15" aria-hidden="true"></div>
          </div>
          <div class="flex flex-wrap gap-1.5">
            {#each INTENSITY_LEVELS as lvl (lvl.slug)}
              {@const stats = data.intensityPills.find((p) => p.slug === lvl.slug)}
              {@const active = data.selectedCats.includes(lvl.slug)}
              <a
                href={urlWithToggledCat(lvl.slug)}
                aria-current={active ? 'true' : undefined}
                class="rounded-full px-2.5 py-0.5 text-[11px] font-medium transition {active
                  ? lvl.pillActiveClass
                  : lvl.pillClass}"
              >
                {lvl.label}<span class="ml-1 opacity-60">{stats?.count ?? 0}</span>
              </a>
            {/each}
          </div>
        </div>

        {#each data.groupedPills as group (group.kind)}
          <div class="space-y-1.5">
            <div class="flex items-center gap-2">
              <span class="text-[10px] uppercase tracking-wide text-gusto-cream/60">
                {group.labelFr}
              </span>
              <div class="h-px flex-1 bg-gusto-cream/15" aria-hidden="true"></div>
            </div>
            <div class="flex flex-wrap gap-1.5">
              {#each group.pills as pill (pill.slug)}
                {@const active = data.selectedCats.includes(pill.slug)}
                <a
                  href={urlWithToggledCat(pill.slug)}
                  aria-current={active ? 'true' : undefined}
                  class="rounded-full px-2.5 py-0.5 text-[11px] font-medium transition {active
                    ? 'bg-gusto-pink text-gusto-green-900'
                    : 'bg-gusto-cream/10 text-gusto-cream hover:bg-gusto-cream/20'}"
                >
                  {pill.nameFr}<span class="ml-1 opacity-60">{pill.count}</span>
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
              <RecipeImage
                src={recipe.photoUrl}
                alt={recipe.nameFr}
                categorySlugs={recipe.categories.map((c) => c.slug)}
                class="aspect-[4/3] w-full transition group-hover:scale-105"
              />

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
