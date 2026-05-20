<script lang="ts">
  import { format } from 'date-fns';
  import { fr } from 'date-fns/locale';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<section class="space-y-6">
  <header class="flex flex-col items-center gap-3 text-center sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:text-left">
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
        <li>
          <a
            href={`/menus/${menu.id}`}
            class="block rounded-lg bg-gusto-cream p-4 transition hover:ring-2 hover:ring-gusto-pink"
          >
            <h2 class="font-medium text-gusto-green-900">{menu.name}</h2>
            <p class="mt-1 text-xs text-gusto-green-700/70">
              Du {format(menu.startDate, 'EEEE d MMMM', { locale: fr })}
              au {format(menu.endDate, 'EEEE d MMMM yyyy', { locale: fr })}
            </p>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</section>
