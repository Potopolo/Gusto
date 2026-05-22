<script lang="ts">
  import { formatQty } from '$lib/format';
  import { pointsColor, singularizeUnit } from '$lib/points-color';
  import FavoriteHeart from '$lib/components/FavoriteHeart.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  let chosenServings = $state(data.recipe.servings ?? 1);
  let factor = $derived(
    data.recipe.servings && data.recipe.servings > 0
      ? chosenServings / data.recipe.servings
      : 1
  );

  let steps = $derived(
    data.recipe.instructionsMd
      .split('\n')
      .map((line) => line.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean)
  );

  function decServings() {
    chosenServings = Math.max(1, chosenServings - 1);
  }
  function incServings() {
    chosenServings = Math.min(99, chosenServings + 1);
  }

  let perServing = $derived(data.recipe.nutritionPerServing?.per_serving ?? null);
  let scaledPoints = $derived(
    data.recipe.pointsPerServing != null
      ? Math.round(data.recipe.pointsPerServing * factor)
      : null
  );
  let badgeColors = $derived(scaledPoints != null ? pointsColor(scaledPoints) : null);
  let unitLabel = $derived(singularizeUnit(data.recipe.servingsUnit));

  let matchPct = $derived(
    data.matchStats.total > 0
      ? Math.round((data.matchStats.matched / data.matchStats.total) * 100)
      : 0
  );
</script>

<article class="space-y-8">
  <nav class="text-sm">
    <a href="/recettes" class="text-gusto-cream/70 hover:text-gusto-cream">← Recettes</a>
  </nav>

  {#if data.recipe.photoUrl}
    <figure class="overflow-hidden rounded-lg">
      <img
        src={data.recipe.photoUrl}
        alt={data.recipe.nameFr}
        class="h-64 w-full object-cover sm:h-80 lg:h-96"
      />
    </figure>
  {/if}

  <header class="space-y-3 text-center sm:text-left">
    <div class="flex items-start justify-center gap-3 sm:justify-start">
      <h1 class="text-3xl font-semibold leading-tight text-gusto-cream">
        {data.recipe.nameFr}
      </h1>
      <FavoriteHeart kind="recipe" id={data.recipe.id} favorited={data.isFavorite} size="lg" />
    </div>

    <div class="flex flex-wrap items-center justify-center gap-1.5 text-xs sm:justify-start">
      {#each data.categories as cat (cat.slug)}
        <span class="rounded-full bg-gusto-cream/10 px-2 py-0.5 text-gusto-cream/90"
          >{cat.nameFr}</span
        >
      {/each}
      {#each data.tags.filter((t) => !data.categories.some((c) => c.nameFr.toLowerCase() === t.toLowerCase())) as tag (tag)}
        <span class="text-gusto-cream/50">{tag}</span>
      {/each}
    </div>

    {#if data.recipe.sourceUrl}
      <p class="text-xs text-gusto-cream/60">
        Source :
        <a
          href={data.recipe.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="underline hover:text-gusto-cream"
        >
          {data.recipe.authorAttribution ?? data.recipe.sourceUrl}
        </a>
      </p>
    {/if}
  </header>

  {#if scaledPoints != null && perServing && badgeColors}
    <section class="flex flex-wrap items-stretch gap-3 rounded-lg bg-gusto-cream p-4">
      <div
        class="flex flex-none items-center justify-center rounded-md px-4 py-3 {badgeColors.bg} {badgeColors.text}"
      >
        <div class="text-center">
          <div class="text-3xl font-semibold leading-none">{scaledPoints}</div>
          <div class="mt-0.5 text-[10px] uppercase tracking-wide opacity-80">
            pts / {unitLabel}
          </div>
        </div>
      </div>
      <div class="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gusto-green-700">
        <span><span class="font-medium">{Math.round(perServing.kcal * factor)}</span> kcal</span>
        <span><span class="font-medium">{perServing.protein_g.toFixed(0)}</span> g protéines</span>
        <span><span class="font-medium">{perServing.fat_g.toFixed(0)}</span> g lipides</span>
        <span><span class="font-medium">{perServing.carbs_g.toFixed(0)}</span> g glucides</span>
        <span><span class="font-medium">{perServing.fiber_g.toFixed(1)}</span> g fibres</span>
      </div>
      <p class="basis-full text-xs text-gusto-green-700/70">
        Calcul approximatif via CIQUAL — {matchPct}% des ingrédients reconnus.
        {#if matchPct < 80}
          <span class="text-gusto-pink-700">Précision réduite, à corriger plus tard.</span>
        {/if}
      </p>
    </section>
  {:else}
    <section
      class="rounded-lg border border-dashed border-gusto-cream/30 bg-gusto-cream/5 p-4 text-sm text-gusto-cream/80"
    >
      {#if !data.recipe.servings}
        Points non calculés — nombre de portions manquant dans la recette source. À renseigner
        manuellement plus tard.
      {:else if matchPct < 50}
        Points non calculés — seulement {matchPct}% des ingrédients reconnus (seuil 50%). À
        corriger manuellement plus tard.
      {:else}
        Points non calculés pour cette recette.
      {/if}
    </section>
  {/if}

  {#if data.recipe.introMd}
    <section class="space-y-3 text-sm text-gusto-cream/90">
      {#each data.recipe.introMd.split('\n\n') as para}
        <p>{para}</p>
      {/each}
    </section>
  {/if}

  <section class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-lg font-semibold text-gusto-cream">Ingrédients</h2>

      {#if data.recipe.servings}
        <div class="flex items-center gap-2 text-sm">
          <span class="text-gusto-cream/70">Pour</span>
          <div class="flex items-center rounded-md bg-gusto-cream">
            <button
              type="button"
              onclick={decServings}
              aria-label="Diminuer"
              class="px-3 py-1.5 text-lg leading-none text-gusto-green hover:bg-gusto-green-50 disabled:opacity-30"
              disabled={chosenServings <= 1}>−</button
            >
            <input
              type="number"
              min="1"
              max="99"
              bind:value={chosenServings}
              class="w-12 border-x border-gusto-green-100 bg-transparent text-center text-sm text-gusto-green-900 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              onclick={incServings}
              aria-label="Augmenter"
              class="px-3 py-1.5 text-lg leading-none text-gusto-green hover:bg-gusto-green-50"
              >+</button
            >
          </div>
          <span class="text-gusto-cream/70">{unitLabel}{chosenServings > 1 ? 's' : ''}</span>
        </div>
      {/if}
    </div>

    <ul class="divide-y divide-gusto-green-100 rounded-lg bg-gusto-cream">
      {#each data.ingredients as ing (ing.id)}
        <li class="flex items-center gap-2 px-4 py-2.5 text-sm">
          <span class="min-w-0 flex-1">
            {#if ing.quantity != null}
              <span class="font-medium text-gusto-green-900">
                {formatQty(ing.quantity * factor)}{ing.unit ? ' ' + ing.unit : ''}
              </span>
              <span class="text-gusto-green-700">{ing.ingredientHint}</span>
            {:else}
              <span class="text-gusto-green-700">{ing.rawText}</span>
            {/if}
          </span>
          {#if ing.ingredientId != null}
            <FavoriteHeart
              kind="ingredient"
              id={ing.ingredientId}
              favorited={ing.isFavorite}
              size="sm"
            />
          {/if}
        </li>
      {/each}
    </ul>
  </section>

  {#if steps.length}
    <section class="space-y-3">
      <h2 class="text-lg font-semibold text-gusto-cream">Préparation</h2>
      <ol class="space-y-3 rounded-lg bg-gusto-cream p-4 text-sm text-gusto-green-700">
        {#each steps as step, i (i)}
          <li class="flex gap-3">
            <span
              class="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-gusto-green text-xs font-semibold text-gusto-cream"
            >
              {i + 1}
            </span>
            <span class="pt-0.5 leading-relaxed">{step}</span>
          </li>
        {/each}
      </ol>
    </section>
  {/if}
</article>
