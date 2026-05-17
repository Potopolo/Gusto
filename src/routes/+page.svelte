<script lang="ts">
  import { pointsColor, singularizeUnit } from '$lib/points-color';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<section class="space-y-8">
  <header class="space-y-3">
    <h1 class="text-2xl font-semibold text-gusto-cream">
      Bonjour {data.currentUser?.labelFr ?? ''}.
    </h1>
    <p class="text-gusto-cream/80">
      Cherche une recette, fais un menu, dresse ta liste de courses.
    </p>
  </header>

  <form action="/recettes" method="get" class="flex flex-col gap-2 sm:flex-row sm:items-stretch">
    <input
      type="search"
      name="q"
      placeholder="Chercher une recette…"
      autocomplete="off"
      class="block w-full rounded-md text-gusto-green-900 placeholder:text-gusto-green-200 shadow-sm"
    />
    <button
      type="submit"
      class="rounded-md bg-gusto-pink px-5 py-2 text-sm font-medium text-gusto-green-900 hover:bg-gusto-pink-200"
    >
      Chercher
    </button>
    <a
      href="/menus"
      class="rounded-md border border-gusto-cream/30 bg-transparent px-5 py-2 text-center text-sm font-medium text-gusto-cream hover:bg-gusto-cream/10"
    >
      Faire un menu
    </a>
  </form>

  {#if data.recentRecipes.length}
    <section class="space-y-4">
      <div class="flex items-baseline justify-between">
        <h2 class="text-lg font-semibold text-gusto-cream">Recettes récentes</h2>
        <a href="/recettes" class="text-sm text-gusto-cream/70 hover:text-gusto-cream">
          Voir tout →
        </a>
      </div>
      <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each data.recentRecipes as recipe (recipe.id)}
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
              </div>
              <div class="space-y-1 p-3">
                <h3 class="text-sm font-medium leading-snug text-gusto-green-900">
                  {recipe.nameFr}
                </h3>
                {#if recipe.servings}
                  <p class="text-xs text-gusto-green-700/70">
                    {recipe.servings}
                    {singularizeUnit(recipe.servingsUnit)}{recipe.servings > 1 ? 's' : ''}
                  </p>
                {/if}
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
      Aucune recette en base. Lance <code class="rounded bg-gusto-cream/10 px-1.5 py-0.5"
        >npm run scrape:amandine -- --limit=10</code
      > pour importer un premier lot.
    </p>
  {/if}
</section>
