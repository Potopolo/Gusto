<script lang="ts">
  import { deserialize } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { format } from 'date-fns';
  import { fr } from 'date-fns/locale';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  type MenuRow = (typeof data.menus)[number];
  let pendingDelete = $state<MenuRow | null>(null);
  let deleting = $state(false);

  async function doDelete() {
    if (!pendingDelete) return;
    deleting = true;
    try {
      const fd = new FormData();
      fd.set('menuId', String(pendingDelete.id));
      const res = await fetch('?/delete', { method: 'POST', body: fd });
      const result = deserialize(await res.text());
      if (result.type === 'success' || result.type === 'redirect') {
        pendingDelete = null;
        await invalidateAll();
      } else if (result.type === 'failure') {
        // Keep the dialog open and surface the error — for now just log,
        // a v2 could put it in a toast.
        console.error('Delete failed', result.data);
      }
    } finally {
      deleting = false;
    }
  }
</script>

<section class="space-y-6">
  <header class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-2xl font-semibold text-gusto-cream">Menus</h1>
      <p class="text-sm text-gusto-cream/70">
        {data.menus.length} menu{data.menus.length > 1 ? 's' : ''} en bibliothèque.
      </p>
    </div>
    <a
      href="/menus/nouveau"
      class="rounded-md bg-gusto-pink px-4 py-2 text-sm font-medium text-gusto-green-900 hover:bg-gusto-pink-200"
    >
      Nouveau menu
    </a>
  </header>

  {#if data.menus.length === 0}
    <div class="rounded-lg border border-dashed border-gusto-cream/30 bg-gusto-cream/5 p-6 text-sm text-gusto-cream/80">
      Aucun menu pour l'instant. Clique « Nouveau menu » pour générer une semaine
      adaptée à ton objectif points + la saison du moment.
    </div>
  {:else}
    <ul class="space-y-3">
      {#each data.menus as menu (menu.id)}
        <li class="relative">
          <a
            href={`/menus/${menu.id}`}
            class="block rounded-lg bg-gusto-cream p-4 pr-12 transition hover:ring-2 hover:ring-gusto-pink"
          >
            <h2 class="font-medium text-gusto-green-900">{menu.name}</h2>
            <p class="mt-1 text-xs text-gusto-green-700/70">
              Du {format(menu.startDate, 'EEEE d MMMM', { locale: fr })}
              au {format(menu.endDate, 'EEEE d MMMM yyyy', { locale: fr })}
            </p>
          </a>
          <button
            type="button"
            onclick={() => (pendingDelete = menu)}
            aria-label={`Supprimer ${menu.name}`}
            title="Supprimer le menu"
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
  title="Supprimer ce menu ?"
  message={pendingDelete
    ? `« ${pendingDelete.name} » sera supprimé définitivement, ainsi que tous les plats qui y sont associés.`
    : ''}
  confirmLabel="Supprimer"
  cancelLabel="Annuler"
  busy={deleting}
  onConfirm={doDelete}
  onCancel={() => (pendingDelete = null)}
/>
