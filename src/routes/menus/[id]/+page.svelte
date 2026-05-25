<script lang="ts">
  import { enhance, deserialize } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { format } from 'date-fns';
  import { fr } from 'date-fns/locale';
  import { formatMinutes } from '$lib/format';
  import { pointsColor, singularizeUnit } from '$lib/points-color';
  import { isRecipeForMealType } from '$lib/menus/sweet';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  type SlotRow = (typeof data.slots)[number];

  const MEAL_TYPES = [
    { value: 'petit-déj', label: 'Petit-déjeuner' },
    { value: 'déjeuner', label: 'Déjeuner' },
    { value: 'goûter', label: 'Goûter' },
    { value: 'apéro', label: 'Apéro' },
    { value: 'dîner', label: 'Dîner' },
    { value: 'dessert', label: 'Dessert' }
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

  // Daily plan card: only the auto-generated slots. Manual additions live
  // in their own "Plats ajoutés" card below so they don't pollute the
  // weekly rhythm.
  let slotsByDate = $derived.by(() => {
    const map = new Map<string, SlotRow[]>();
    for (const { key } of menuDates) map.set(key, []);
    for (const row of data.slots) {
      if (row.slot.isManual) continue;
      const key = format(row.slot.date, 'yyyy-MM-dd');
      const list = map.get(key);
      if (list) list.push(row);
      else map.set(key, [row]);
    }
    return Array.from(map.entries());
  });

  // Everything the user added by hand — separate from the daily plan.
  let manualSlots = $derived(data.slots.filter((r) => r.slot.isManual));

  function dayTotalPoints(daySlots: SlotRow[]): number {
    return daySlots.reduce((sum, r) => sum + (r.recipe?.pointsPerServing ?? 0), 0);
  }

  /** Main meals shown in the day card; everything else is grouped under "Plats en plus". */
  const MAIN_MEAL_TYPES = new Set(['petit-déj', 'déjeuner', 'dîner']);
  function isMainMeal(mealType: string): boolean {
    return MAIN_MEAL_TYPES.has(mealType);
  }

  // --- Filter pills (shared add + edit) ---
  // Drop équipement / occasion / type — type is already chosen via meal-type radio chips.
  const KIND_ORDER = ['saison', 'style', 'régime', 'temps'];
  const KIND_LABELS: Record<string, string> = {
    saison: 'Saison',
    style: 'Style',
    régime: 'Régime',
    temps: 'Temps'
  };
  const SEASON_BY_MONTH: Record<number, string> = {
    3: 'printemps', 4: 'printemps', 5: 'printemps',
    6: 'ete',       7: 'ete',       8: 'ete',
    9: 'automne',   10: 'automne',  11: 'automne',
    12: 'hiver',    1: 'hiver',     2: 'hiver'
  };

  let adding = $state(false);
  /** Transient confirmation after a "Ajouter un plat" submit. */
  let addedToast = $state<{ name: string } | null>(null);
  let addToastTimer: ReturnType<typeof setTimeout> | null = null;

  // Per-day collapse state. Tracks the date keys that are CURRENTLY collapsed
  // (default = empty = everything expanded).
  let collapsedDays = $state<Set<string>>(new Set());
  function toggleDay(dateKey: string) {
    const next = new Set(collapsedDays);
    if (next.has(dateKey)) next.delete(dateKey);
    else next.add(dateKey);
    collapsedDays = next;
  }

  // Custom-modal flow for the destructive "Re-générer" action
  let regenerateAsking = $state(false);
  let regenerating = $state(false);

  async function doRegenerate() {
    regenerating = true;
    try {
      const res = await fetch('?/regenerate', { method: 'POST', body: new FormData() });
      const result = deserialize(await res.text());
      if (result.type === 'success' || result.type === 'redirect') {
        regenerateAsking = false;
        await invalidateAll();
      } else {
        console.error('Regenerate failed', result);
      }
    } finally {
      regenerating = false;
    }
  }
  let addDate = $state('');
  let addMealType = $state('dîner');
  let addRecipeId = $state('');
  let addServings = $state(2);
  let addSearchQ = $state('');
  let addSelectedCats = $state<string[]>([]);

  /** Group filter categories by kind, ordered. */
  let groupedFilterCats = $derived.by(() => {
    const byKind = new Map<string, typeof data.allCategories>();
    for (const c of data.allCategories) {
      if (!byKind.has(c.kind)) byKind.set(c.kind, []);
      byKind.get(c.kind)!.push(c);
    }
    return KIND_ORDER.flatMap((kind) => {
      const pills = byKind.get(kind);
      if (!pills?.length) return [];
      return [{ kind, label: KIND_LABELS[kind] ?? kind, pills }];
    });
  });

  function startAdd(opts: { scrollToForm?: boolean } = {}) {
    adding = true;
    addDate = menuDates[0]?.key ?? '';
    addMealType = 'dîner';
    addRecipeId = '';
    addServings = data.menu.generationParams?.peopleCount ?? 2;
    addSearchQ = '';
    // Pre-select current season based on the chosen day
    const month = addDate ? new Date(addDate + 'T00:00:00').getMonth() + 1 : new Date().getMonth() + 1;
    const seasonSlug = SEASON_BY_MONTH[month];
    addSelectedCats = seasonSlug ? [seasonSlug] : [];
    if (opts.scrollToForm) {
      // Defer to next tick so the form is in the DOM before scrolling
      setTimeout(() => {
        document
          .getElementById('add-plat-form')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  }

  /** Close the "Ajouter un plat" form and bring the user back to the top
   *  of the menu view — without that the page stays scrolled where the
   *  form was, which led some users to use the "← Menus" breadcrumb and
   *  end up on the menu list instead. */
  function closeAddForm() {
    adding = false;
    addRecipeId = '';
    setTimeout(() => {
      document
        .getElementById('menu-top')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  function toggleAddCat(slug: string) {
    if (addSelectedCats.includes(slug)) {
      addSelectedCats = addSelectedCats.filter((s) => s !== slug);
    } else {
      addSelectedCats = [...addSelectedCats, slug];
    }
  }

  // Filtered recipe list for the add picker (reactive to mealType, search, pills)
  let addFilteredRecipes = $derived.by(() => {
    const q = addSearchQ.trim().toLowerCase();
    return data.allRecipes.filter((r) => {
      if (!isRecipeForMealType({ ...r, name: r.nameFr }, addMealType)) return false;
      if (q && !r.nameFr.toLowerCase().includes(q)) return false;
      if (addSelectedCats.length > 0) {
        const rSlugs = new Set(r.categories.map((c) => c.slug));
        if (!addSelectedCats.every((s) => rSlugs.has(s))) return false;
      }
      return true;
    });
  });

  // --- Edit form (inline per slot) — same UI as add ---
  let editingSlotId = $state<number | null>(null);
  let editMealType = $state('');
  let editRecipeId = $state('');
  let editServings = $state(2);
  let editSearchQ = $state('');
  let editSelectedCats = $state<string[]>([]);

  function startEdit(slotId: number) {
    const row = data.slots.find((r) => r.slot.id === slotId);
    if (!row) return;
    editMealType = row.slot.mealType;
    editRecipeId = row.slot.recipeId != null ? String(row.slot.recipeId) : '';
    editServings = row.slot.servings;
    editSearchQ = '';
    // Pre-select the season of this slot's date
    const month = new Date(row.slot.date).getMonth() + 1;
    const seasonSlug = SEASON_BY_MONTH[month];
    editSelectedCats = seasonSlug ? [seasonSlug] : [];
    editingSlotId = slotId;
  }

  function cancelEdit() {
    editingSlotId = null;
    editRecipeId = '';
  }

  function toggleEditCat(slug: string) {
    if (editSelectedCats.includes(slug)) {
      editSelectedCats = editSelectedCats.filter((s) => s !== slug);
    } else {
      editSelectedCats = [...editSelectedCats, slug];
    }
  }

  let editFilteredRecipes = $derived.by(() => {
    // Always keep the currently-selected recipe visible, even if filters would
    // hide it — gives the user a clear "this is what's selected now" anchor.
    const currentSlotRow = editingSlotId
      ? data.slots.find((r) => r.slot.id === editingSlotId)
      : null;
    const currentRecipeId = currentSlotRow?.slot.recipeId;

    const q = editSearchQ.trim().toLowerCase();
    return data.allRecipes.filter((r) => {
      if (currentRecipeId === r.id) return true;
      if (!isRecipeForMealType({ ...r, name: r.nameFr }, editMealType)) return false;
      if (q && !r.nameFr.toLowerCase().includes(q)) return false;
      if (editSelectedCats.length > 0) {
        const rSlugs = new Set(r.categories.map((c) => c.slug));
        if (!editSelectedCats.every((s) => rSlugs.has(s))) return false;
      }
      return true;
    });
  });

</script>

<section class="space-y-6">
  <nav id="menu-top" class="text-sm">
    <a href="/menus" class="text-gusto-cream/70 hover:text-gusto-cream">← Menus</a>
  </nav>

  <header class="flex flex-col items-center gap-3 text-center sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:text-left">
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
      <div class="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
        <button
          type="button"
          onclick={() => (regenerateAsking = true)}
          class="inline-flex items-center gap-1.5 rounded-md border border-gusto-cream/40 bg-transparent px-3 py-2 text-sm font-medium text-gusto-cream hover:bg-gusto-cream/10"
          title="Re-tirer aléatoirement les repas principaux du menu"
        >
          <span aria-hidden="true">↻</span> Re-générer
        </button>
        {#if data.shoppingListId}
          <a
            href={`/listes-de-courses/${data.shoppingListId}`}
            class="inline-flex items-center gap-1.5 rounded-md border border-gusto-cream/40 bg-transparent px-3 py-2 text-sm font-medium text-gusto-cream hover:bg-gusto-cream/10"
            title="Voir la liste de courses associée"
          >
            <span aria-hidden="true">🛒</span> Voir la liste
          </a>
        {:else}
          <form method="post" action="?/generateShoppingList">
            <button
              type="submit"
              class="inline-flex items-center gap-1.5 rounded-md border border-gusto-cream/40 bg-transparent px-3 py-2 text-sm font-medium text-gusto-cream hover:bg-gusto-cream/10"
              title="Générer la liste de courses à partir des recettes du menu"
            >
              <span aria-hidden="true">🛒</span> Liste de courses
            </button>
          </form>
        {/if}
        <button
          type="button"
          onclick={() => startAdd()}
          class="rounded-md bg-gusto-pink px-4 py-2 text-sm font-medium text-gusto-green-900 hover:bg-gusto-pink-200"
        >
          + Ajouter un plat
        </button>
      </div>
    {/if}
  </header>

  {#if adding}
    <form
      id="add-plat-form"
      method="post"
      action="?/add"
      use:enhance={() => {
        // Capture the picked recipe BEFORE the form posts so we can name
        // it in the confirmation toast.
        const pickedId = addRecipeId;
        const picked = data.allRecipes.find((r) => String(r.id) === pickedId);
        return async ({ result, update }) => {
          // Keep form open so the user can add multiple dishes in a row.
          // Only clear the recipe pick — meal type / day / pills / portions
          // stay so quick repeats are smooth.
          await update({ reset: false });
          addRecipeId = '';
          addSearchQ = '';
          if (result.type === 'success' && picked) {
            if (addToastTimer) clearTimeout(addToastTimer);
            addedToast = { name: picked.nameFr };
            addToastTimer = setTimeout(() => (addedToast = null), 4000);
          }
        };
      }}
      class="space-y-4 rounded-lg bg-gusto-cream p-4 text-gusto-green-900"
    >
      <!-- Sticky-ish header with a close (✕) so the user always has an
           obvious way back to the menu without using the breadcrumb. -->
      <div class="flex items-center justify-between">
        <h2 class="text-base font-semibold text-gusto-green-900">Ajouter un plat</h2>
        <button
          type="button"
          onclick={closeAddForm}
          aria-label="Fermer"
          class="text-sm text-gusto-green-700 hover:text-gusto-green-900"
        >
          ✕
        </button>
      </div>

      <!-- Day is implicit: defaults to first menu day (selectable via hidden input).
           Per UX feedback, the dropdown was redundant — the user re-orders later if needed. -->
      <input type="hidden" name="date" value={addDate} />

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

        {#if groupedFilterCats.length}
          <div class="space-y-1.5">
            {#each groupedFilterCats as group (group.kind)}
              <div class="flex flex-wrap items-baseline gap-1.5">
                <span
                  class="w-16 flex-none text-[9px] uppercase tracking-wide text-gusto-green-700/70"
                >
                  {group.label}
                </span>
                <div class="flex flex-wrap gap-1">
                  {#each group.pills as c (c.slug)}
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
              </div>
            {/each}
          </div>
        {/if}

        <input type="hidden" name="recipeId" value={addRecipeId} required />

        <p class="text-[11px] text-gusto-green-700/70">
          {addFilteredRecipes.length} recette{addFilteredRecipes.length > 1 ? 's' : ''}
          disponible{addFilteredRecipes.length > 1 ? 's' : ''}
        </p>

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
            onclick={closeAddForm}
            class="rounded-md px-3 py-1.5 text-sm text-gusto-green-700 hover:text-gusto-green-900"
          >
            Fermer
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
      {@const mainSlots = daySlots.filter((r) => isMainMeal(r.slot.mealType))}
      {@const extraSlots = daySlots.filter((r) => !isMainMeal(r.slot.mealType))}
      {@const isCollapsed = collapsedDays.has(dateKey)}
      <section class="rounded-lg bg-gusto-cream p-3 sm:p-4">
        <button
          type="button"
          onclick={() => toggleDay(dateKey)}
          aria-expanded={!isCollapsed}
          class="-mx-1 mb-3 flex w-[calc(100%+0.5rem)] flex-wrap items-baseline justify-between gap-2 rounded-md px-1 text-left transition hover:bg-gusto-green-50"
        >
          <span class="flex items-baseline gap-2">
            <span
              aria-hidden="true"
              class="text-xs text-gusto-green-700/60 transition-transform {isCollapsed
                ? ''
                : 'rotate-90'}"
            >
              ▶
            </span>
            <span class="text-base font-semibold text-gusto-green-900 sm:text-lg">
              {format(new Date(dateKey), 'EEEE d MMMM', { locale: fr })}
            </span>
          </span>
          {#if dayTotal > 0}
            <span class="text-xs text-gusto-green-700/70">Total : {dayTotal} pts</span>
          {/if}
        </button>

        {#snippet slotItem(row: SlotRow)}
          {@const { slot, recipe } = row}
          <li>
            {#if editingSlotId === slot.id}
                  <form
                    method="post"
                    action="?/update"
                    use:enhance={() => {
                      return async ({ update }) => {
                        await update();
                        cancelEdit();
                      };
                    }}
                    class="space-y-4 rounded-md border border-gusto-green-200 bg-white p-4"
                  >
                    <input type="hidden" name="slotId" value={slot.id} />

                    <!-- Type de plat — radio chips -->
                    <fieldset>
                      <legend class="mb-1.5 block text-xs font-medium text-gusto-green-700">
                        Type de plat
                      </legend>
                      <div class="flex flex-wrap gap-1.5">
                        {#each MEAL_TYPES as t (t.value)}
                          <label class="cursor-pointer">
                            <input
                              type="radio"
                              name="mealType"
                              value={t.value}
                              checked={editMealType === t.value}
                              onchange={(e) => {
                                if ((e.currentTarget as HTMLInputElement).checked)
                                  editMealType = t.value;
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
                        bind:value={editSearchQ}
                        placeholder="Rechercher par nom…"
                        class="block w-full rounded-md text-sm shadow-sm"
                      />

                      {#if groupedFilterCats.length}
                        <div class="space-y-1.5">
                          {#each groupedFilterCats as group (group.kind)}
                            <div class="flex flex-wrap items-baseline gap-1.5">
                              <span
                                class="w-16 flex-none text-[9px] uppercase tracking-wide text-gusto-green-700/70"
                              >
                                {group.label}
                              </span>
                              <div class="flex flex-wrap gap-1">
                                {#each group.pills as c (c.slug)}
                                  {@const active = editSelectedCats.includes(c.slug)}
                                  <button
                                    type="button"
                                    onclick={() => toggleEditCat(c.slug)}
                                    aria-pressed={active}
                                    class="rounded-full px-2.5 py-0.5 text-[10px] font-medium transition {active
                                      ? 'bg-gusto-pink text-gusto-green-900'
                                      : 'bg-gusto-green-50 text-gusto-green-700 hover:bg-gusto-green-100'}"
                                  >
                                    {c.nameFr}<span class="ml-1 opacity-60">{c.count}</span>
                                  </button>
                                {/each}
                              </div>
                            </div>
                          {/each}
                        </div>
                      {/if}

                      <input type="hidden" name="recipeId" value={editRecipeId} required />

                      <p class="text-[11px] text-gusto-green-700/70">
                        {editFilteredRecipes.length} recette{editFilteredRecipes.length > 1 ? 's' : ''}
                        disponible{editFilteredRecipes.length > 1 ? 's' : ''}
                      </p>

                      <div class="max-h-80 overflow-auto rounded-md border border-gusto-green-100 bg-white p-2">
                        {#if editFilteredRecipes.length === 0}
                          <p class="p-4 text-center text-xs text-gusto-green-700/70">
                            Aucune recette adaptée à ce type avec ces filtres.
                          </p>
                        {:else}
                          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {#each editFilteredRecipes as r (r.id)}
                              {@const selected = editRecipeId === String(r.id)}
                              {@const c =
                                r.pointsPerServing != null ? pointsColor(r.pointsPerServing) : null}
                              <button
                                type="button"
                                onclick={() => (editRecipeId = String(r.id))}
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
                          onclick={cancelEdit}
                          class="rounded-md px-3 py-1.5 text-sm text-gusto-green-700 hover:text-gusto-green-900"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          disabled={!editRecipeId}
                          class="rounded-md bg-gusto-pink px-3 py-1.5 text-sm font-medium text-gusto-green-900 hover:bg-gusto-pink-200 disabled:opacity-50"
                        >
                          Enregistrer
                        </button>
                      </div>
                    </div>
                  </form>
                {:else}
                  <div class="flex items-center gap-1 sm:gap-2">
                    {#if recipe}
                      {@const c = pointsColor(recipe.pointsPerServing ?? 0)}
                      <a
                        href={`/recettes/${recipe.slug}`}
                        class="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1.5 transition hover:bg-gusto-green-50 sm:gap-3 sm:p-2"
                      >
                        <span class="w-14 flex-none text-[10px] uppercase tracking-wide text-gusto-green-700/70 sm:w-20 sm:text-xs">
                          {slot.mealType}
                        </span>
                        {#if recipe.photoUrl}
                          <img
                            src={recipe.photoUrl}
                            alt={recipe.nameFr}
                            class="h-10 w-10 flex-none rounded object-cover sm:h-12 sm:w-12"
                            loading="lazy"
                          />
                        {:else}
                          <div class="h-10 w-10 flex-none rounded bg-gusto-green-50 sm:h-12 sm:w-12"></div>
                        {/if}
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-sm font-medium text-gusto-green-900">
                            {recipe.nameFr}
                          </p>
                          <p class="truncate text-xs text-gusto-green-700/70">
                            ⏱ {formatMinutes(recipe.prepMinutes)}
                            · {slot.servings} portion{slot.servings > 1 ? 's' : ''}
                            {#if recipe.pointsPerServing != null}
                              · {recipe.pointsPerServing} pts/{singularizeUnit(recipe.servingsUnit)}
                            {/if}
                          </p>
                        </div>
                        {#if recipe.pointsPerServing != null}
                          <span
                            class="flex h-8 w-8 flex-none items-center justify-center rounded-full {c.bg} {c.text} text-sm font-semibold sm:h-9 sm:w-9"
                          >
                            {recipe.pointsPerServing}
                          </span>
                        {/if}
                      </a>
                    {:else}
                      <span
                        class="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1.5 text-sm italic text-gusto-green-700/70 sm:gap-3 sm:p-2"
                      >
                        <span class="w-14 flex-none text-[10px] uppercase tracking-wide sm:w-20 sm:text-xs">{slot.mealType}</span>
                        <span class="truncate">{slot.freeText ?? '(vide)'}</span>
                      </span>
                    {/if}

                    <form method="post" action="?/reroll" use:enhance>
                      <input type="hidden" name="slotId" value={slot.id} />
                      <button
                        type="submit"
                        aria-label="Proposer un autre plat"
                        title="Changer (tirage)"
                        class="flex h-7 w-7 flex-none items-center justify-center rounded-full text-gusto-green-700/60 hover:bg-gusto-mint hover:text-gusto-green-900"
                      >
                        ↻
                      </button>
                    </form>
                    <button
                      type="button"
                      onclick={() => startEdit(slot.id)}
                      aria-label="Modifier ce plat"
                      title="Modifier (choisir)"
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
        {/snippet}

        {#if !isCollapsed}
          {#if mainSlots.length === 0 && extraSlots.length === 0}
            <p class="text-xs italic text-gusto-green-700/70">Pas de plat prévu ce jour.</p>
          {/if}

          {#if mainSlots.length}
            <ul class="space-y-2">
              {#each mainSlots as row (row.slot.id)}
                {@render slotItem(row)}
              {/each}
            </ul>
          {/if}

          {#if extraSlots.length}
            <div class="mt-3 border-t border-gusto-green-100 pt-3">
              <p class="mb-2 text-[10px] uppercase tracking-wide text-gusto-green-700/70">
                Plats en plus
              </p>
              <ul class="space-y-2">
                {#each extraSlots as row (row.slot.id)}
                  {@render slotItem(row)}
                {/each}
              </ul>
            </div>
          {/if}
        {/if}
      </section>
    {/each}
  </div>

  {#if manualSlots.length > 0}
    <section class="rounded-lg bg-gusto-cream p-3 sm:p-4">
      <header class="-mx-1 mb-3 flex items-baseline justify-between gap-2 rounded-md px-1">
        <span class="text-base font-semibold text-gusto-green-900 sm:text-lg">
          Plats ajoutés
        </span>
        <span class="text-xs text-gusto-green-700/70">
          {manualSlots.length} plat{manualSlots.length > 1 ? 's' : ''}
        </span>
      </header>
      <ul class="space-y-2">
        {#each manualSlots as row (row.slot.id)}
          {@const slot = row.slot}
          {@const recipe = row.recipe}
          {@const c = recipe?.pointsPerServing != null ? pointsColor(recipe.pointsPerServing) : null}
          <li class="flex items-center gap-1 sm:gap-2">
            {#if recipe}
              <a
                href={`/recettes/${recipe.slug}`}
                class="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1.5 transition hover:bg-gusto-green-50 sm:gap-3 sm:p-2"
              >
                <span class="w-20 flex-none text-[10px] uppercase tracking-wide text-gusto-green-700/70 sm:w-24 sm:text-xs">
                  {format(new Date(slot.date), 'EEE d MMM', { locale: fr })} · {slot.mealType}
                </span>
                {#if recipe.photoUrl}
                  <img
                    src={recipe.photoUrl}
                    alt={recipe.nameFr}
                    class="h-10 w-10 flex-none rounded object-cover sm:h-12 sm:w-12"
                    loading="lazy"
                  />
                {:else}
                  <div class="h-10 w-10 flex-none rounded bg-gusto-green-50 sm:h-12 sm:w-12"></div>
                {/if}
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-gusto-green-900">{recipe.nameFr}</p>
                  <p class="truncate text-xs text-gusto-green-700/70">
                    {slot.servings} portion{slot.servings > 1 ? 's' : ''}
                    {#if recipe.pointsPerServing != null}
                      · {recipe.pointsPerServing} pts/{singularizeUnit(recipe.servingsUnit)}
                    {/if}
                  </p>
                </div>
                {#if c && recipe.pointsPerServing != null}
                  <span
                    class="flex h-8 w-8 flex-none items-center justify-center rounded-full {c.bg} {c.text} text-sm font-semibold sm:h-9 sm:w-9"
                  >
                    {recipe.pointsPerServing}
                  </span>
                {/if}
              </a>
            {/if}
            <form method="post" action="?/remove" use:enhance>
              <input type="hidden" name="slotId" value={slot.id} />
              <button
                type="submit"
                aria-label="Retirer ce plat"
                title="Retirer"
                class="flex h-7 w-7 flex-none items-center justify-center rounded-full text-gusto-green-700/60 hover:bg-gusto-pink hover:text-gusto-green-900"
              >
                ✕
              </button>
            </form>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if !adding}
    <button
      type="button"
      onclick={() => startAdd({ scrollToForm: true })}
      class="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-gusto-cream/30 bg-transparent px-4 py-3 text-sm text-gusto-cream/80 hover:border-gusto-cream/60 hover:text-gusto-cream"
    >
      <span aria-hidden="true">+</span> Ajouter un plat
    </button>
  {/if}

</section>

{#if addedToast}
  <div
    role="status"
    aria-live="polite"
    class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transform rounded-lg bg-gusto-green-900 px-4 py-2.5 text-sm text-gusto-cream shadow-lg sm:bottom-8"
  >
    <span class="mr-2">✓ <strong>{addedToast.name}</strong> ajoutée au menu</span>
    <button
      type="button"
      onclick={() => (addedToast = null)}
      aria-label="Fermer"
      class="ml-1 text-gusto-cream/70 hover:text-gusto-cream"
    >
      ✕
    </button>
  </div>
{/if}

<ConfirmDialog
  open={regenerateAsking}
  title="Re-générer les repas principaux ?"
  message="Les recettes actuelles des repas principaux seront remplacées par un nouveau tirage aléatoire. Les plats ajoutés à la main (desserts, apéros, goûters…) sont conservés."
  confirmLabel="Re-générer"
  cancelLabel="Annuler"
  busy={regenerating}
  onConfirm={doRegenerate}
  onCancel={() => (regenerateAsking = false)}
/>
