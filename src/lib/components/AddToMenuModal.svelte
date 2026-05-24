<script lang="ts">
  /**
   * Modal to schedule a recipe into one of the user's menus. Posts to the
   * recipe-detail page's `addToMenu` action so the slug is preserved.
   */
  import { enhance } from '$app/forms';
  import { format } from 'date-fns';
  import { fr } from 'date-fns/locale';
  import { goto } from '$app/navigation';

  type MenuOpt = { id: number; name: string; startDate: Date; endDate: Date };

  type Props = {
    open: boolean;
    menus: MenuOpt[];
    onClose: () => void;
  };
  let { open, menus, onClose }: Props = $props();

  const MEAL_TYPES = [
    { value: 'petit-déj', label: 'Petit-déj' },
    { value: 'déjeuner', label: 'Déjeuner' },
    { value: 'goûter', label: 'Goûter' },
    { value: 'apéro', label: 'Apéro' },
    { value: 'dîner', label: 'Dîner' },
    { value: 'dessert', label: 'Dessert' },
    { value: 'collation', label: 'Collation' }
  ];

  let selectedMenuId = $state<number | null>(null);
  let selectedDate = $state('');
  let mealType = $state('déjeuner');
  let servings = $state(2);
  let busy = $state(false);
  let errorMsg = $state('');

  // Reset state every time the modal opens
  $effect(() => {
    if (open) {
      const first = menus[0];
      selectedMenuId = first?.id ?? null;
      selectedDate = first ? format(first.startDate, 'yyyy-MM-dd') : '';
      mealType = 'déjeuner';
      servings = 2;
      busy = false;
      errorMsg = '';
    }
  });

  // When the user picks a different menu, snap the date to that menu's start
  function onMenuChange(id: number) {
    selectedMenuId = id;
    const m = menus.find((x) => x.id === id);
    if (m) selectedDate = format(m.startDate, 'yyyy-MM-dd');
  }

  // Build the list of available dates for the selected menu
  const availableDates = $derived.by(() => {
    if (selectedMenuId == null) return [];
    const m = menus.find((x) => x.id === selectedMenuId);
    if (!m) return [];
    const out: { value: string; label: string }[] = [];
    const dayMs = 24 * 60 * 60 * 1000;
    const start = new Date(m.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(m.endDate);
    end.setHours(0, 0, 0, 0);
    for (let t = start.getTime(); t <= end.getTime(); t += dayMs) {
      const d = new Date(t);
      out.push({
        value: format(d, 'yyyy-MM-dd'),
        label: format(d, 'EEEE d MMMM', { locale: fr })
      });
    }
    return out;
  });

  $effect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:items-center sm:pt-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="addmenu-title"
  >
    <div
      class="absolute inset-0 bg-gusto-green-900/70 backdrop-blur-sm dark:bg-black/80"
      onclick={onClose}
      aria-hidden="true"
    ></div>

    <div
      class="relative w-full max-w-md space-y-4 rounded-lg bg-gusto-cream p-5 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.6)] dark:bg-gusto-green-900 dark:text-gusto-cream"
    >
      <header class="flex items-baseline justify-between">
        <h2 id="addmenu-title" class="text-lg font-semibold text-gusto-green-900 dark:text-gusto-cream">
          Ajouter à un menu
        </h2>
        <button
          type="button"
          onclick={onClose}
          aria-label="Fermer"
          class="text-sm text-gusto-green-700 hover:text-gusto-green-900 dark:text-gusto-cream/70 dark:hover:text-gusto-cream"
        >
          ✕
        </button>
      </header>

      {#if menus.length === 0}
        <p class="text-sm text-gusto-green-700 dark:text-gusto-cream/80">
          Aucun menu en bibliothèque pour l'instant.
          <a
            href="/menus/nouveau"
            class="font-medium text-gusto-pink-700 underline hover:text-gusto-pink"
          >
            Créer un menu →
          </a>
        </p>
      {:else}
        <form
          method="post"
          action="?/addToMenu"
          use:enhance={() => {
            busy = true;
            errorMsg = '';
            return async ({ result }) => {
              busy = false;
              if (result.type === 'redirect') {
                onClose();
                await goto(result.location);
              } else if (result.type === 'success') {
                if (result.data?.menuId) {
                  onClose();
                  await goto(`/menus/${result.data.menuId}`);
                }
              } else if (result.type === 'failure') {
                errorMsg = (result.data?.error as string) ?? 'Échec de l’ajout.';
              }
            };
          }}
          class="space-y-3"
        >
          <!-- Menu -->
          <fieldset class="space-y-1.5">
            <legend class="text-xs font-medium text-gusto-green-700 dark:text-gusto-cream/70">
              Menu
            </legend>
            <div class="flex flex-col gap-1">
              {#each menus as m (m.id)}
                {@const checked = selectedMenuId === m.id}
                <label class="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="menuId"
                    value={m.id}
                    {checked}
                    onchange={() => onMenuChange(m.id)}
                    class="text-gusto-pink"
                  />
                  <span class="text-sm text-gusto-green-900 dark:text-gusto-cream">
                    {m.name}
                  </span>
                </label>
              {/each}
            </div>
          </fieldset>

          <!-- Date -->
          <label class="block text-xs font-medium text-gusto-green-700 dark:text-gusto-cream/70">
            Jour
            <select
              name="date"
              bind:value={selectedDate}
              class="mt-1 block w-full rounded-md text-sm text-gusto-green-900 shadow-sm dark:bg-gusto-green-700 dark:text-gusto-cream"
            >
              {#each availableDates as d (d.value)}
                <option value={d.value}>{d.label}</option>
              {/each}
            </select>
          </label>

          <!-- Meal type -->
          <fieldset>
            <legend class="mb-1 text-xs font-medium text-gusto-green-700 dark:text-gusto-cream/70">
              Type de plat
            </legend>
            <div class="flex flex-wrap gap-1.5">
              {#each MEAL_TYPES as t (t.value)}
                <label class="cursor-pointer">
                  <input
                    type="radio"
                    name="mealType"
                    value={t.value}
                    checked={mealType === t.value}
                    onchange={(e) => {
                      if ((e.currentTarget as HTMLInputElement).checked) mealType = t.value;
                    }}
                    class="peer sr-only"
                  />
                  <span
                    class="block rounded-full border border-gusto-green-200 bg-white px-3 py-1 text-xs font-medium text-gusto-green-700 transition peer-checked:border-gusto-pink peer-checked:bg-gusto-pink peer-checked:text-gusto-green-900 hover:bg-gusto-green-50 dark:bg-transparent dark:text-gusto-cream/80"
                  >
                    {t.label}
                  </span>
                </label>
              {/each}
            </div>
          </fieldset>

          <!-- Portions -->
          <div class="flex items-center gap-3">
            <span class="text-xs font-medium text-gusto-green-700 dark:text-gusto-cream/70">
              Portions
            </span>
            <div
              class="inline-flex items-center rounded-md border border-gusto-green-200 bg-white dark:border-gusto-cream/20 dark:bg-transparent"
            >
              <button
                type="button"
                onclick={() => (servings = Math.max(1, servings - 1))}
                class="px-2 py-1 text-base leading-none text-gusto-green hover:bg-gusto-green-50 dark:text-gusto-cream"
                aria-label="Diminuer"
              >−</button>
              <span class="border-x border-gusto-green-200 px-3 py-1 text-sm font-medium dark:border-gusto-cream/20 dark:text-gusto-cream">
                {servings}
              </span>
              <button
                type="button"
                onclick={() => (servings = Math.min(50, servings + 1))}
                class="px-2 py-1 text-base leading-none text-gusto-green hover:bg-gusto-green-50 dark:text-gusto-cream"
                aria-label="Augmenter"
              >+</button>
            </div>
            <input type="hidden" name="servings" value={servings} />
          </div>

          {#if errorMsg}
            <p class="text-xs text-gusto-pink-700">{errorMsg}</p>
          {/if}

          <div class="flex justify-end gap-2">
            <button
              type="button"
              onclick={onClose}
              class="rounded-md px-3 py-1.5 text-sm text-gusto-green-700 hover:text-gusto-green-900 dark:text-gusto-cream/70 dark:hover:text-gusto-cream"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy || selectedMenuId == null}
              class="rounded-md bg-gusto-pink px-3 py-1.5 text-sm font-medium text-gusto-green-900 hover:bg-gusto-pink-200 disabled:opacity-50"
            >
              {busy ? '…' : 'Ajouter au menu'}
            </button>
          </div>
        </form>
      {/if}
    </div>
  </div>
{/if}
