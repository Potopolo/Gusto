<script lang="ts">
  import { enhance } from '$app/forms';
  import { format } from 'date-fns';
  import { fr } from 'date-fns/locale';
  import {
    CATEGORY_LABELS,
    CATEGORY_ORDER,
    type ShoppingCategory
  } from '$lib/shopping/categorize';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Group items by category, sort each group alphabetically.
  // Client-side check state — persistence will land in phase 2-C-4.
  let checked = $state<Set<number>>(new Set());

  function toggle(id: number) {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    checked = next;
  }

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
        <section class="rounded-lg bg-gusto-cream p-4">
          <h2 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gusto-green-700/70">
            {group.label}
            <span class="ml-1 font-normal text-gusto-green-700/50">({group.items.length})</span>
          </h2>
          <ul class="space-y-1">
            {#each group.items as it (it.id)}
              {@const isChecked = checked.has(it.id)}
              <li class="group flex items-center gap-1">
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
              </li>
            {/each}
          </ul>
        </section>
      {/each}
    </div>
  {/if}

  <footer class="rounded-lg border border-dashed border-gusto-cream/30 p-4 text-sm text-gusto-cream/70">
    <span class="font-medium text-gusto-cream/90">Bientôt :</span>
    édition manuelle des articles + sauvegarde des cases cochées (phase 2-C-4).
  </footer>
</section>
