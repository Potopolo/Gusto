<script lang="ts">
  import { enhance, deserialize } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { format } from 'date-fns';
  import { fr } from 'date-fns/locale';
  import {
    CATEGORY_LABELS,
    CATEGORY_ORDER,
    type ShoppingCategory
  } from '$lib/shopping/categorize';
  import { swipeToDelete } from '$lib/actions/swipeToDelete';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Initialize the checked set from the persisted item.isChecked flag.
  // Use $state(...) wrapped in an IIFE so re-mounts (e.g. after a list
  // generation) hydrate from the latest server payload.
  let checked = $state<Set<number>>(
    new Set(data.items.filter((it) => it.isChecked).map((it) => it.id))
  );

  async function toggle(itemId: number) {
    // Optimistic flip
    const wasChecked = checked.has(itemId);
    const next = new Set(checked);
    if (wasChecked) next.delete(itemId);
    else next.add(itemId);
    checked = next;

    // Persist in the background — rollback on failure
    try {
      const fd = new FormData();
      fd.set('itemId', String(itemId));
      fd.set('checked', wasChecked ? '0' : '1');
      const res = await fetch('?/toggleItem', { method: 'POST', body: fd });
      const result = deserialize(await res.text());
      if (result.type !== 'success') {
        // rollback
        const rb = new Set(checked);
        if (wasChecked) rb.add(itemId);
        else rb.delete(itemId);
        checked = rb;
      }
    } catch {
      const rb = new Set(checked);
      if (wasChecked) rb.add(itemId);
      else rb.delete(itemId);
      checked = rb;
    }
  }

  // --- Manual add form ---
  // Collapsed category sections (default = all expanded)
  let collapsedCategories = $state<Set<string>>(new Set());
  function toggleCategory(slug: string) {
    const next = new Set(collapsedCategories);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    collapsedCategories = next;
  }

  let addOpen = $state(false);
  let addName = $state('');
  let addQty = $state('');
  let addUnit = $state('');
  let addCategory = $state<ShoppingCategory | ''>('');
  let addError = $state('');
  let addBusy = $state(false);

  function openAdd() {
    addOpen = true;
    addError = '';
  }
  function closeAdd() {
    addOpen = false;
    addName = addQty = addUnit = '';
    addCategory = '';
    addError = '';
  }

  // Fire-and-forget delete from the swipe gesture (same endpoint as the ✕ button)
  async function deleteItem(itemId: number) {
    const fd = new FormData();
    fd.set('itemId', String(itemId));
    const res = await fetch('?/removeItem', { method: 'POST', body: fd });
    const result = deserialize(await res.text());
    if (result.type === 'success' || result.type === 'redirect') {
      await invalidateAll();
    }
  }

  // Group items by category, sort each group alphabetically.
  const grouped = $derived.by(() => {
    const map = new Map<ShoppingCategory, typeof data.items>();
    for (const it of data.items) {
      const cat = (it.category as ShoppingCategory) ?? 'autre';
      const list = map.get(cat) ?? [];
      list.push(it);
      map.set(cat, list);
    }
    // Alphabetical within each category
    for (const list of map.values()) {
      list.sort((a, b) => a.nameFr.localeCompare(b.nameFr, 'fr', { sensitivity: 'base' }));
    }
    // Return in supermarket-walk order, skipping empty categories
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      slug: c,
      label: CATEGORY_LABELS[c],
      items: map.get(c)!
    }));
  });

  function formatQty(qty: number | null, unit: string | null): string {
    if (qty == null) return '';
    const q = Number.isInteger(qty) ? String(qty) : qty.toFixed(1).replace(/\.0$/, '');
    return unit ? `${q} ${unit}` : q;
  }
</script>

<section class="space-y-6">
  <nav class="text-sm">
    <a href="/listes-de-courses" class="text-gusto-cream/70 hover:text-gusto-cream"
      >← Listes</a
    >
  </nav>

  <header class="space-y-2 text-center sm:text-left">
    <h1 class="text-2xl font-semibold text-gusto-cream">{data.list.name}</h1>
    <p class="text-sm text-gusto-cream/70">
      {data.items.length} article{data.items.length > 1 ? 's' : ''}
      · créée le {format(data.list.createdAt, 'd MMMM yyyy', { locale: fr })}
      {#if data.list.menuId}
        · <a href={`/menus/${data.list.menuId}`} class="underline hover:text-gusto-cream"
          >Voir le menu</a
        >
      {/if}
    </p>
  </header>

  {#if data.items.length === 0}
    <div
      class="rounded-lg border border-dashed border-gusto-cream/30 bg-gusto-cream/5 p-6 text-sm text-gusto-cream/80"
    >
      Cette liste est vide.
    </div>
  {:else}
    <div class="space-y-4">
      {#each grouped as group (group.slug)}
        {@const isCollapsed = collapsedCategories.has(group.slug)}
        <section class="rounded-lg bg-gusto-cream p-4">
          <button
            type="button"
            onclick={() => toggleCategory(group.slug)}
            aria-expanded={!isCollapsed}
            class="-mx-1 mb-3 flex w-[calc(100%+0.5rem)] items-center gap-2 rounded-md px-1 text-left transition hover:bg-gusto-green-50"
          >
            <span
              aria-hidden="true"
              class="text-[10px] text-gusto-green-700/60 transition-transform {isCollapsed
                ? ''
                : 'rotate-90'}"
            >
              ▶
            </span>
            <h2 class="flex-1 text-xs font-semibold uppercase tracking-wide text-gusto-green-700/70">
              {group.label}
              <span class="ml-1 font-normal text-gusto-green-700/50">({group.items.length})</span>
            </h2>
          </button>
          {#if !isCollapsed}
          <ul class="space-y-1">
            {#each group.items as it (it.id)}
              {@const isChecked = checked.has(it.id)}
              <li class="relative overflow-hidden rounded-md">
                <!-- Swipe-reveal "Supprimer" backdrop (touch only) -->
                <div
                  class="pointer-events-none absolute inset-0 flex items-center justify-end rounded-md bg-gusto-pink-700 px-4 text-sm font-medium text-gusto-cream"
                  aria-hidden="true"
                >
                  Supprimer
                </div>

                <div
                  use:swipeToDelete={{ onDelete: () => deleteItem(it.id) }}
                  class="group relative flex items-center gap-1 rounded-md bg-gusto-cream"
                >
                  <button
                    type="button"
                    onclick={() => toggle(it.id)}
                    class="flex min-w-0 flex-1 items-center gap-3 rounded-md p-1.5 text-left transition hover:bg-gusto-green-50"
                  >
                    <span
                      class="flex h-5 w-5 flex-none items-center justify-center rounded border {isChecked
                        ? 'border-gusto-green bg-gusto-green text-gusto-cream'
                        : 'border-gusto-green-200 bg-white'}"
                      aria-hidden="true"
                    >
                      {#if isChecked}✓{/if}
                    </span>
                    <span
                      class="min-w-0 flex-1 text-sm {isChecked
                        ? 'text-gusto-green-700/50 line-through'
                        : 'text-gusto-green-900'}"
                    >
                      {it.nameFr}
                      {#if it.isManual}
                        <span
                          aria-label="Article ajouté manuellement"
                          title="Ajouté manuellement"
                          class="ml-1 text-[10px] text-gusto-green-700/50"
                        >
                          ✎
                        </span>
                      {/if}
                    </span>
                    {#if it.qty != null}
                      <span
                        class="flex-none text-xs {isChecked
                          ? 'text-gusto-green-700/40'
                          : 'text-gusto-green-700/70'}"
                      >
                        {formatQty(it.qty, it.unit)}
                      </span>
                    {/if}
                  </button>
                  <form method="post" action="?/removeItem" use:enhance>
                    <input type="hidden" name="itemId" value={it.id} />
                    <button
                      type="submit"
                      aria-label={`Supprimer ${it.nameFr}`}
                      title="Supprimer cet article"
                      class="flex h-7 w-7 flex-none items-center justify-center rounded-full text-gusto-green-700/40 transition hover:bg-gusto-pink hover:text-gusto-green-900 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      ✕
                    </button>
                  </form>
                </div>
              </li>
            {/each}
          </ul>
          {/if}
        </section>
      {/each}
    </div>
  {/if}

  <!-- Manual add ----------------------------------------------------------- -->
  {#if !addOpen}
    <button
      type="button"
      onclick={openAdd}
      class="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-gusto-cream/30 bg-transparent px-4 py-3 text-sm text-gusto-cream/80 hover:border-gusto-cream/60 hover:text-gusto-cream"
    >
      <span aria-hidden="true">+</span> Ajouter un article
    </button>
  {:else}
    <form
      method="post"
      action="?/addItem"
      use:enhance={() => {
        addBusy = true;
        addError = '';
        return async ({ result, update }) => {
          if (result.type === 'success') {
            await update({ reset: false });
            addName = '';
            addQty = '';
            addUnit = '';
            // keep addCategory so adding several items of the same category is fast
          } else if (result.type === 'failure') {
            addError = (result.data?.error as string) ?? 'Échec de l’ajout.';
          }
          addBusy = false;
        };
      }}
      class="space-y-3 rounded-lg bg-gusto-cream p-4 text-gusto-green-900"
    >
      <div class="flex items-baseline justify-between">
        <h2 class="text-sm font-semibold">Ajouter un article</h2>
        <button
          type="button"
          onclick={closeAdd}
          class="text-xs text-gusto-green-700/70 hover:text-gusto-green-900"
        >
          Fermer
        </button>
      </div>

      <label class="block text-xs font-medium text-gusto-green-700">
        Nom
        <input
          type="text"
          name="name"
          bind:value={addName}
          required
          maxlength="120"
          placeholder="ex. papier toilette, gingembre, lessive…"
          class="mt-1 block w-full rounded-md text-sm shadow-sm"
        />
      </label>

      <div class="grid grid-cols-2 gap-2">
        <label class="block text-xs font-medium text-gusto-green-700">
          Quantité
          <input
            type="text"
            name="qty"
            bind:value={addQty}
            inputmode="decimal"
            placeholder="optionnel"
            class="mt-1 block w-full rounded-md text-sm shadow-sm"
          />
        </label>
        <label class="block text-xs font-medium text-gusto-green-700">
          Unité
          <input
            type="text"
            name="unit"
            bind:value={addUnit}
            maxlength="16"
            placeholder="g, ml, paquet…"
            class="mt-1 block w-full rounded-md text-sm shadow-sm"
          />
        </label>
      </div>

      <label class="block text-xs font-medium text-gusto-green-700">
        Catégorie
        <select
          name="category"
          bind:value={addCategory}
          class="mt-1 block w-full rounded-md text-sm shadow-sm"
        >
          <option value="">Détecter automatiquement</option>
          {#each CATEGORY_ORDER as cat (cat)}
            <option value={cat}>{CATEGORY_LABELS[cat]}</option>
          {/each}
        </select>
      </label>

      {#if addError}
        <p class="text-xs text-gusto-pink-700">{addError}</p>
      {/if}

      <div class="flex justify-end gap-2">
        <button
          type="submit"
          disabled={addBusy || !addName.trim()}
          class="rounded-md bg-gusto-pink px-3 py-1.5 text-sm font-medium text-gusto-green-900 hover:bg-gusto-pink-200 disabled:opacity-50"
        >
          {addBusy ? '…' : 'Ajouter'}
        </button>
      </div>
    </form>
  {/if}
</section>
