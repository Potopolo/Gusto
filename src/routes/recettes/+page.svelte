<script lang="ts">
  import { formatMinutes } from '$lib/format';
  import { pointsColor, singularizeUnit } from '$lib/points-color';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let searchInput = $state(data.q);

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
        href="/recettes"
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
      {#if data.selectedCats.length > 0}
        <p class="text-xs text-gusto-cream/70">
          Filtre actif : {data.selectedCats.length} catégorie{data.selectedCats.length > 1
            ? 's'
            : ''} —
          <a href={buildUrl(data.q, [])} class="underline hover:text-gusto-cream"
            >tout désélectionner</a
          >
        </p>
      {/if}
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
              </p>
            </div>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</section>
