<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<section class="space-y-8">
  <header class="space-y-1">
    <h1 class="text-2xl font-semibold text-gusto-cream">Favoris</h1>
    <p class="text-sm text-gusto-cream/70">
      Tes recettes et aliments préférés, à portée de main.
    </p>
  </header>

  <section class="space-y-4">
    <header class="space-y-1">
      <h2 class="text-lg font-semibold text-gusto-cream">Recettes favorites</h2>
      <p class="text-sm text-gusto-cream/70">
        {data.favRecipes.length} recette{data.favRecipes.length > 1 ? 's' : ''} en favoris.
        Coche le ♥ sur une fiche recette pour l'ajouter.
      </p>
    </header>
    {#if data.favRecipes.length === 0}
      <p
        class="rounded-lg border border-dashed border-gusto-cream/30 bg-gusto-cream/5 p-4 text-sm text-gusto-cream/70"
      >
        Aucune recette en favori pour l'instant.
      </p>
    {:else}
      <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {#each data.favRecipes as r (r.id)}
          <li>
            <a
              href={`/recettes/${r.slug}`}
              class="group block overflow-hidden rounded-lg bg-gusto-cream transition hover:ring-2 hover:ring-gusto-pink"
            >
              {#if r.photoUrl}
                <div class="aspect-[4/3] overflow-hidden bg-gusto-green-50">
                  <img
                    src={r.photoUrl}
                    alt={r.nameFr}
                    loading="lazy"
                    class="h-full w-full object-cover transition group-hover:scale-105"
                  />
                </div>
              {:else}
                <div class="aspect-[4/3] bg-gusto-green-50"></div>
              {/if}
              <div class="p-2">
                <p class="line-clamp-2 text-xs font-medium leading-tight text-gusto-green-900">
                  {r.nameFr}
                </p>
              </div>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="space-y-4">
    <header class="space-y-1">
      <h2 class="text-lg font-semibold text-gusto-cream">Aliments favoris</h2>
      <p class="text-sm text-gusto-cream/70">
        {data.favIngredients.length} aliment{data.favIngredients.length > 1 ? 's' : ''} en favoris.
        Le ♥ apparaît sur chaque ligne d'ingrédient d'une recette quand l'aliment est reconnu (CIQUAL).
      </p>
    </header>
    {#if data.favIngredients.length === 0}
      <p
        class="rounded-lg border border-dashed border-gusto-cream/30 bg-gusto-cream/5 p-4 text-sm text-gusto-cream/70"
      >
        Aucun aliment en favori pour l'instant.
      </p>
    {:else}
      <ul class="flex flex-wrap gap-2">
        {#each data.favIngredients as ing (ing.id)}
          <li
            class="rounded-full bg-gusto-cream px-3 py-1 text-xs font-medium text-gusto-green-900"
          >
            <span aria-hidden="true" class="mr-1 text-gusto-pink-700">♥</span>
            {ing.nameFr}
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="space-y-4">
    <header class="space-y-1">
      <h2 class="text-lg font-semibold text-gusto-cream">Équipement de cuisine</h2>
      <p class="text-sm text-gusto-cream/70">
        Coche ce que tu possèdes. La génération de menus filtrera en fonction.
      </p>
    </header>

    <ul class="divide-y divide-gusto-green-100 rounded-lg bg-gusto-cream">
      {#each data.equipment as eq (eq.id)}
        <li class="flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <span class="font-medium text-gusto-green-900">{eq.nameFr}</span>
          <form method="post" action="?/toggleEquipment" use:enhance>
            <input type="hidden" name="id" value={eq.id} />
            <input type="hidden" name="owned" value={(!eq.owned).toString()} />
            <button
              type="submit"
              class="rounded-full px-3 py-1 text-xs font-medium {eq.owned
                ? 'bg-gusto-green text-gusto-cream hover:bg-gusto-green-700'
                : 'bg-gusto-green-50 text-gusto-green-700 hover:bg-gusto-green-100'}"
            >
              {eq.owned ? 'possédé' : 'absent'}
            </button>
          </form>
        </li>
      {/each}
    </ul>
  </section>
</section>
