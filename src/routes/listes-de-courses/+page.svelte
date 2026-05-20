<script lang="ts">
  import { deserialize } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { format } from 'date-fns';
  import { fr } from 'date-fns/locale';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  type ListRow = (typeof data.lists)[number];
  let pendingDelete = $state<ListRow | null>(null);
  let deleting = $state(false);

  async function doDelete() {
    if (!pendingDelete) return;
    deleting = true;
    try {
      const fd = new FormData();
      fd.set('listId', String(pendingDelete.id));
      const res = await fetch('?/delete', { method: 'POST', body: fd });
      const result = deserialize(await res.text());
      if (result.type === 'success' || result.type === 'redirect') {
        pendingDelete = null;
        await invalidateAll();
      }
    } finally {
      deleting = false;
    }
  }
</script>

<section class="space-y-6">
  <header class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-2xl font-semibold text-gusto-cream">Listes de courses</h1>
      <p class="text-sm text-gusto-cream/70">
        {data.lists.length} liste{data.lists.length > 1 ? 's' : ''} en bibliothèque.
      </p>
    </div>
    <a
      href="/menus"
      class="rounded-md bg-gusto-pink px-4 py-2 text-sm font-medium text-gusto-green-900 hover:bg-gusto-pink-200"
    >
      Voir mes menus
    </a>
  </header>

  {#if data.lists.length === 0}
    <div
      class="rounded-lg border border-dashed border-gusto-cream/30 bg-gusto-cream/5 p-6 text-sm text-gusto-cream/80"
    >
      Pas encore de liste. Ouvre un menu et clique « Générer la liste de courses »
      pour en créer une.
    </div>
  {:else}
    <ul class="space-y-3">
      {#each data.lists as list (list.id)}
        <li class="relative">
          <a
            href={`/listes-de-courses/${list.id}`}
            class="block rounded-lg bg-gusto-cream p-4 pr-12 transition hover:ring-2 hover:ring-gusto-pink"
          >
            <h2 class="font-medium text-gusto-green-900">{list.name}</h2>
            <p class="mt-1 text-xs text-gusto-green-700/70">
              {list.itemCount} article{list.itemCount > 1 ? 's' : ''}
              · créée le {format(list.createdAt, 'd MMMM yyyy', { locale: fr })}
              {#if list.menuName}
                · {list.menuName}
              {/if}
            </p>
          </a>
          <button
            type="button"
            onclick={() => (pendingDelete = list)}
            aria-label={`Supprimer ${list.name}`}
            title="Supprimer la liste"
            class="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-gusto-green-700/60 hover:bg-gusto-pink hover:text-gusto-green-900"
          >
            ✕
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<ConfirmDialog
  open={pendingDelete !== null}
  title="Supprimer cette liste ?"
  message={pendingDelete
    ? `« ${pendingDelete.name} » sera supprimée définitivement, ainsi que tous ses articles.`
    : ''}
  confirmLabel="Supprimer"
  cancelLabel="Annuler"
  busy={deleting}
  onConfirm={doDelete}
  onCancel={() => (pendingDelete = null)}
/>
