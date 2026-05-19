<script lang="ts">
  import { enhance } from '$app/forms';
  import { format } from 'date-fns';
  import { fr } from 'date-fns/locale';
  import { formatMinutes } from '$lib/format';
  import { pointsColor, singularizeUnit } from '$lib/points-color';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  type SlotRow = (typeof data.slots)[number];

  const MEAL_TYPES = [
    { value: 'petit-déj', label: 'Petit-déj' },
    { value: 'déjeuner', label: 'Déjeuner' },
    { value: 'goûter', label: 'Goûter' },
    { value: 'apéro', label: 'Apéro' },
    { value: 'dîner', label: 'Dîner' },
    { value: 'dessert', label: 'Dessert' },
    { value: 'collation', label: 'Collation' }
  ];

  // Days enumerated from menu range — used by the top "Ajouter un plat" form
  let menuDates = $derived.by(() => {
    const list: { key: string; label: string }[] = [];
    const dayMs = 24 * 60 * 60 * 1000;
    const start = new Date(data.menu.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(data.menu.endDate);
    end.setHours(0, 0, 0, 0);
    for (let t = start.getTime(); t <= end.getTime(); t += dayMs) {
      const d = new Date(t);
      list.push({
        key: format(d, 'yyyy-MM-dd'),
        label: format(d, 'EEEE d MMMM', { locale: fr })
      });
    }
    return list;
  });

  let slotsByDate = $derived.by(() => {
    const map = new Map<string, SlotRow[]>();
    for (const { key } of menuDates) map.set(key, []);
    for (const row of data.slots) {
      const key = format(row.slot.date, 'yyyy-MM-dd');
      const list = map.get(key);
      if (list) list.push(row);
      else map.set(key, [row]);
    }
    return Array.from(map.entries());
  });

  function dayTotalPoints(daySlots: SlotRow[]): number {
    return daySlots.reduce((sum, r) => sum + (r.recipe?.pointsPerServing ?? 0), 0);
  }

  // --- Add form (top of page) ---
  let adding = $state(false);
  let addDate = $state('');
  let addMealType = $state('dîner');
  let addRecipeId = $state('');
  let addServings = $state(2);
  let addSearchQ = $state('');
  let addSelectedCats = $state<string[]>([]);

  function startAdd() {
    adding = true;
    addDate = menuDates[0]?.key ?? '';
    addMealType = 'dîner';
    addRecipeId = '';
    addServings = data.menu.generationParams?.peopleCount ?? 2;
    addSearchQ = '';
    addSelectedCats = [];
  }

  function toggleAddCat(slug: string) {
    if (addSelectedCats.includes(slug)) {
      addSelectedCats = addSelectedCats.filter((s) => s !== slug);
    } else {
      addSelectedCats = [...addSelectedCats, slug];
    }
  }

  // Filtered recipe list for the picker
  let addFilteredRecipes = $derived.by(() => {
    const q = addSearchQ.trim().toLowerCase();
    return data.allRecipes.filter((r) => {
      if (q && !r.nameFr.toLowerCase().includes(q)) return false;
      if (addSelectedCats.length > 0) {
        const rSlugs = new Set(r.categories.map((c) => c.slug));
        if (!addSelectedCats.every((s) => rSlugs.has(s))) return false;
      }
      return true;
    });
  });

  // --- Edit form (inline per slot) ---
  let editingSlotId = $state<number | null>(null);
  let editMealType = $state('');
  let editRecipeId = $state('');
  let editServings = $state(2);

  function startEdit(slotId: number) {
    const row = data.slots.find((r) => r.slot.id === slotId);
    if (!row) return;
    editMealType = row.slot.mealType;
    editRecipeId = row.slot.recipeId != null ? String(row.slot.recipeId) : '';
    editServings = row.slot.servings;
    editingSlotId = slotId;
  }
</script>

<section class="space-y-6">
  <nav class="text-sm">
    <a href="/menus" class="text-gusto-cream/70 hover:text-gusto-cream">← Menus</a>
  </nav>

  <header class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-2xl font-semibold text-gusto-cream">{data.menu.name}</h1>
      <p class="text-sm text-gusto-cream/70">
        Du {format(data.menu.startDate, 'EEEE d MMMM', { locale: fr })}
        au {format(data.menu.endDate, 'EEEE d MMMM yyyy', { locale: fr })}
        {#if data.menu.generationParams}
          · {data.menu.generationParams.peopleCount} personne{data.menu.generationParams.peopleCount > 1 ? 's' : ''}
        {/if}
      </p>
    </div>
    {#if !adding}
      <button
        type="button"
        onclick={startAdd}
        class="rounded-md bg-gusto-pink px-4 py-2 text-sm font-medium text-gusto-green-900 hover:bg-gusto-pink-200"
      >
        + Ajouter un plat
      </button>
    {/if}
  </header>

  {#if adding}
    <form
      method="post"
      action="?/add"
      use:enhance={() => {
        return async ({ update }) => {
          await update();
          adding = false;
          addRecipeId = '';
        };
      }}
      class="space-y-4 rounded-lg bg-gusto-cream p-4 text-gusto-green-900"
    >
      <!-- Jour -->
      <label class="block text-xs font-medium text-gusto-green-700">
        Jour
        <select
          name="date"
          bind:value={addDate}
          required
          class="mt-1 block w-full rounded-md text-sm shadow-sm"
        >
          {#each menuDates as d (d.key)}
            <option value={d.key}>{d.label}</option>
          {/each}
        </select>
      </label>

      <!-- Type de plat — radio chips -->
      <fieldset>
        <legend class="mb-1.5 block text-xs font-medium text-gusto-green-700">Type de plat</legend>
        <div class="flex flex-wrap gap-1.5">
          {#each MEAL_TYPES as t (t.value)}
            <label class="cursor-pointer">
              <input
                type="radio"
                name="mealType"
                value={t.value}
                checked={addMealType === t.value}
                onchange={(e) => {
                  if ((e.currentTarget as HTMLInputElement).checked) addMealType = t.value;
                }}
                required
                class="peer sr-only"
              />
              <span
                class="block rounded-full border border-gusto-green-200 bg-white px-3 py-1 text-xs font-medium text-gusto-green-700 transition peer-checked:border-gusto-pink peer-checked:bg-gusto-pink peer-checked:text-gusto-green-900 hover:bg-gusto-green-50"
              >
                {t.label}
              </span>
            </label>
          {/each}
        </div>
      </fieldset>

      <!-- Recette — search + tag filter + grid preview -->
      <div class="space-y-2">
        <span class="block text-xs font-medium text-gusto-green-700">Recette</span>

        <input
          type="search"
          bind:value={addSearchQ}
          placeholder="Rechercher par nom…"
          class="block w-full rounded-md text-sm shadow-sm"
        />

        {#if data.allCategories.length}
          <div class="flex flex-wrap gap-1">
            {#each data.allCategories as c (c.slug)}
              {@const active = addSelectedCats.includes(c.slug)}
              <button
                type="button"
                onclick={() => toggleAddCat(c.slug)}
                aria-pressed={active}
                class="rounded-full px-2.5 py-0.5 text-[10px] font-medium transition {active
                  ? 'bg-gusto-pink text-gusto-green-900'
                  : 'bg-gusto-green-50 text-gusto-green-700 hover:bg-gusto-green-100'}"
              >
                {c.nameFr}<span class="ml-1 opacity-60">{c.count}</span>
              </button>
            {/each}
          </div>
        {/if}

        <input type="hidden" name="recipeId" value={addRecipeId} required />

        <div class="max-h-80 overflow-auto rounded-md border border-gusto-green-100 bg-white p-2">
          {#if addFilteredRecipes.length === 0}
            <p class="p-4 text-center text-xs text-gusto-green-700/70">
              Aucune recette ne correspond.
            </p>
          {:else}
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {#each addFilteredRecipes as r (r.id)}
                {@const selected = addRecipeId === String(r.id)}
                {@const c = r.pointsPerServing != null ? pointsColor(r.pointsPerServing) : null}
                <button
                  type="button"
                  onclick={() => (addRecipeId = String(r.id))}
                  aria-pressed={selected}
                  class="overflow-hidden rounded-md text-left transition {selected
                    ? 'ring-2 ring-gusto-pink'
                    : 'ring-1 ring-gusto-green-100 hover:ring-gusto-green'}"
                >
                  <div class="relative">
                    {#if r.photoUrl}
                      <img
                        src={r.photoUrl}
                        alt={r.nameFr}
                        loading="lazy"
                        class="aspect-[4/3] w-full object-cover"
                      />
                    {:else}
                      <div class="aspect-[4/3] bg-gusto-green-50"></div>
                    {/if}
                    {#if c && r.pointsPerServing != null}
                      <span
                        class="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full {c.bg} {c.text} text-xs font-semibold shadow-sm ring-1 ring-white/70"
                      >
                        {r.pointsPerServing}
                      </span>
                    {/if}
                  </div>
                  <div class="p-1.5">
                    <p class="line-clamp-2 text-[11px] font-medium leading-tight text-gusto-green-900">
                      {r.nameFr}
                    </p>
                    {#if r.prepMinutes}
                      <p class="mt-0.5 text-[10px] text-gusto-green-700/70">
                        ⏱ {formatMinutes(r.prepMinutes)}
                      </p>
                    {/if}
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Portions + buttons -->
      <div class="flex items-end gap-3">
        <label class="block text-xs font-medium text-gusto-green-700">
          Portions
          <div class="mt-1 inline-flex items-center rounded-md border border-gusto-green-200 bg-white">
            <button
              type="button"
              onclick={() => (addServings = Math.max(1, addServings - 1))}
              class="px-2 py-1 text-base leading-none text-gusto-green hover:bg-gusto-green-50"
              aria-label="Diminuer"
            >−</button>
            <span class="border-x border-gusto-green-200 px-3 py-1 text-sm font-medium">
              {addServings}
            </span>
            <button
              type="button"
              onclick={() => (addServings = Math.min(50, addServings + 1))}
              class="px-2 py-1 text-base leading-none text-gusto-green hover:bg-gusto-green-50"
              aria-label="Augmenter"
            >+</button>
          </div>
          <input type="hidden" name="servings" value={addServings} />
        </label>

        <div class="ml-auto flex gap-2">
          <button
            type="button"
            onclick={() => {
              adding = false;
              addRecipeId = '';
            }}
            class="rounded-md px-3 py-1.5 text-sm text-gusto-green-700 hover:text-gusto-green-900"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!addRecipeId}
            class="rounded-md bg-gusto-pink px-3 py-1.5 text-sm font-medium text-gusto-green-900 hover:bg-gusto-pink-200 disabled:opacity-50"
          >
            Ajouter
          </button>
        </div>
      </div>
    </form>
  {/if}

  {#if form?.error}
    <p class="text-sm text-gusto-pink-700">{form.error}</p>
  {/if}

  <div class="space-y-4">
    {#each slotsByDate as [dateKey, daySlots] (dateKey)}
      {@const dayTotal = dayTotalPoints(daySlots)}
      <section class="rounded-lg bg-gusto-cream p-4">
        <header class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="text-lg font-semibold text-gusto-green-900">
            {format(new Date(dateKey), 'EEEE d MMMM', { locale: fr })}
          </h2>
          {#if dayTotal > 0}
            <span class="text-xs text-gusto-green-700/70">Total : {dayTotal} pts</span>
          {/if}
        </header>

        {#if daySlots.length}
          <ul class="space-y-2">
            {#each daySlots as row (row.slot.id)}
              {@const { slot, recipe } = row}
              <li>
                {#if editingSlotId === slot.id}
                  <form
                    method="post"
                    action="?/update"
                    use:enhance={() => {
                      return async ({ update }) => {
                        await update();
                        editingSlotId = null;
                      };
                    }}
                    class="space-y-3 rounded-md border border-gusto-green-200 bg-white p-3"
                  >
                    <input type="hidden" name="slotId" value={slot.id} />
                    <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <label class="block text-xs font-medium text-gusto-green-700">
                        Type
                        <select
                          name="mealType"
                          value={editMealType}
                          onchange={(e) =>
                            (editMealType = (e.currentTarget as HTMLSelectElement).value)}
                          required
                          class="mt-1 block w-full rounded-md text-sm shadow-sm"
                        >
                          {#each MEAL_TYPES as t (t.value)}
                            <option value={t.value} selected={t.value === editMealType}>{t.label}</option>
                          {/each}
                        </select>
                      </label>
                      <label class="block text-xs font-medium text-gusto-green-700 sm:col-span-2">
                        Recette
                        <select
                          name="recipeId"
                          value={editRecipeId}
                          onchange={(e) =>
                            (editRecipeId = (e.currentTarget as HTMLSelectElement).value)}
                          required
                          class="mt-1 block w-full rounded-md text-sm shadow-sm"
                        >
                          <option value="" disabled>— Choisir —</option>
                          {#each data.allRecipes as r (r.id)}
                            <option value={String(r.id)} selected={String(r.id) === editRecipeId}>
                              {r.nameFr}{r.pointsPerServing != null ? ` · ${r.pointsPerServing} pts` : ''}
                            </option>
                          {/each}
                        </select>
                      </label>
                    </div>
                    <div class="flex items-end gap-3">
                      <label class="block text-xs font-medium text-gusto-green-700">
                        Portions
                        <div class="mt-1 inline-flex items-center rounded-md border border-gusto-green-200 bg-white">
                          <button
                            type="button"
                            onclick={() => (editServings = Math.max(1, editServings - 1))}
                            class="px-2 py-1 text-base leading-none text-gusto-green hover:bg-gusto-green-50"
                            aria-label="Diminuer"
                          >−</button>
                          <span class="border-x border-gusto-green-200 px-3 py-1 text-sm font-medium">
                            {editServings}
                          </span>
                          <button
                            type="button"
                            onclick={() => (editServings = Math.min(50, editServings + 1))}
                            class="px-2 py-1 text-base leading-none text-gusto-green hover:bg-gusto-green-50"
                            aria-label="Augmenter"
                          >+</button>
                        </div>
                        <input type="hidden" name="servings" value={editServings} />
                      </label>
                      <div class="ml-auto flex gap-2">
                        <button
                          type="button"
                          onclick={() => (editingSlotId = null)}
                          class="rounded-md px-3 py-1.5 text-sm text-gusto-green-700 hover:text-gusto-green-900"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          class="rounded-md bg-gusto-pink px-3 py-1.5 text-sm font-medium text-gusto-green-900 hover:bg-gusto-pink-200"
                        >
                          Enregistrer
                        </button>
                      </div>
                    </div>
                  </form>
                {:else}
                  <div class="flex items-center gap-2">
                    {#if recipe}
                      {@const c = pointsColor(recipe.pointsPerServing ?? 0)}
                      <a
                        href={`/recettes/${recipe.slug}`}
                        class="flex flex-1 items-center gap-3 rounded-md p-2 transition hover:bg-gusto-green-50"
                      >
                        <span class="w-20 flex-none text-xs uppercase tracking-wide text-gusto-green-700/70">
                          {slot.mealType}
                        </span>
                        {#if recipe.photoUrl}
                          <img
                            src={recipe.photoUrl}
                            alt={recipe.nameFr}
                            class="h-12 w-12 flex-none rounded object-cover"
                            loading="lazy"
                          />
                        {:else}
                          <div class="h-12 w-12 flex-none rounded bg-gusto-green-50"></div>
                        {/if}
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-sm font-medium text-gusto-green-900">
                            {recipe.nameFr}
                          </p>
                          <p class="text-xs text-gusto-green-700/70">
                            ⏱ {formatMinutes(recipe.prepMinutes)}
                            · {slot.servings} portion{slot.servings > 1 ? 's' : ''}
                            {#if recipe.pointsPerServing != null}
                              · {recipe.pointsPerServing} pts/{singularizeUnit(recipe.servingsUnit)}
                            {/if}
                          </p>
                        </div>
                        {#if recipe.pointsPerServing != null}
                          <span
                            class="flex h-9 w-9 flex-none items-center justify-center rounded-full {c.bg} {c.text} text-sm font-semibold"
                          >
                            {recipe.pointsPerServing}
                          </span>
                        {/if}
                      </a>
                    {:else}
                      <span
                        class="flex flex-1 items-center gap-3 rounded-md p-2 text-sm italic text-gusto-green-700/70"
                      >
                        <span class="w-20 flex-none text-xs uppercase tracking-wide">{slot.mealType}</span>
                        {slot.freeText ?? '(vide)'}
                      </span>
                    {/if}

                    <button
                      type="button"
                      onclick={() => startEdit(slot.id)}
                      aria-label="Modifier ce plat"
                      title="Modifier"
                      class="flex h-7 w-7 flex-none items-center justify-center rounded-full text-gusto-green-700/60 hover:bg-gusto-mint hover:text-gusto-green-900"
                    >
                      ✎
                    </button>
                    <form method="post" action="?/remove" use:enhance>
                      <input type="hidden" name="slotId" value={slot.id} />
                      <button
                        type="submit"
                        aria-label="Supprimer ce plat"
                        title="Supprimer"
                        class="flex h-7 w-7 flex-none items-center justify-center rounded-full text-gusto-green-700/60 hover:bg-gusto-pink hover:text-gusto-green-900"
                      >
                        ✕
                      </button>
                    </form>
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        {:else}
          <p class="text-xs italic text-gusto-green-700/70">Pas de plat prévu ce jour.</p>
        {/if}
      </section>
    {/each}
  </div>

  <footer class="rounded-lg border border-dashed border-gusto-cream/30 p-4 text-sm text-gusto-cream/70">
    <span class="font-medium text-gusto-cream/90">Bientôt :</span>
    génération de la liste de courses depuis le menu (phase 2-C-3).
  </footer>
</section>
