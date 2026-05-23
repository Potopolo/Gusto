<script lang="ts">
  import { formatMinutes } from '$lib/format';
  import { pointsColor, singularizeUnit } from '$lib/points-color';
  import FavoriteHeart from '$lib/components/FavoriteHeart.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const SEASON_LABELS: Record<string, string> = {
    printemps: 'printemps',
    ete: 'été',
    automne: 'automne',
    hiver: 'hiver'
  };

  const BUCKET_LABELS: Record<string, string> = {
    plat: 'plat',
    apero: 'apéro',
    dessert: 'dessert'
  };
</script>

<section class="space-y-8">
  <header class="space-y-3">
    <h1 class="text-3xl font-normal text-gusto-pink">
      Bonjour {data.currentUser?.labelFr ?? ''} !
    </h1>
    <p class="text-gusto-cream/80">
      Buffet d'idées de l'apéro au dessert
      <br />
      <span class="text-sm italic text-gusto-cream/60">
        (à picorer sans modération)
      </span>
    </p>
  </header>

  <a
    href="/menus"
    class="block w-full rounded-md bg-gusto-pink px-5 py-2.5 text-center text-sm font-medium text-gusto-green-900 hover:bg-gusto-pink-200"
  >
    Faire un menu
  </a>

  {#if data.suggestions.length}
    <section class="space-y-4">
      <div class="flex items-baseline justify-between">
        <h2 class="text-lg font-semibold text-gusto-cream">
          Suggestions de {SEASON_LABELS[data.season] ?? data.season}
        </h2>
        <a href="/recettes" class="text-sm text-gusto-cream/70 hover:text-gusto-cream">
          Voir tout →
        </a>
      </div>

      <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each data.suggestions as recipe (recipe.id)}
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
                    class="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full {c.bg} {c.text} shadow-sm ring-2 ring-gusto-cream"
                  >
                    <span class="text-sm font-semibold leading-none"
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
                <span
                  class="absolute bottom-2 left-2 rounded-full bg-gusto-green-900/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gusto-cream backdrop-blur-sm"
                >
                  {BUCKET_LABELS[recipe.bucket] ?? recipe.bucket}
                </span>
              </div>
              <div class="space-y-1 p-3">
                <h3 class="text-base font-normal leading-snug text-gusto-green-900">
                  {recipe.nameFr}
                </h3>
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
    </section>
  {:else}
    <p
      class="rounded-lg border border-dashed border-gusto-cream/30 bg-gusto-cream/5 p-6 text-sm text-gusto-cream/80"
    >
      Aucune recette de saison dans la base pour l'instant.
    </p>
  {/if}
</section>
