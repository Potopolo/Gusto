<script lang="ts">
  import { format } from 'date-fns';
  import { fr } from 'date-fns/locale';
  import { formatMinutes } from '$lib/format';
  import { pointsColor, singularizeUnit } from '$lib/points-color';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Group slots by date for the day-by-day calendar
  type SlotRow = (typeof data.slots)[number];
  let slotsByDate = $derived.by(() => {
    const map = new Map<string, SlotRow[]>();
    for (const row of data.slots) {
      const key = format(row.slot.date, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return Array.from(map.entries());
  });

  // Total points for a day (sum of meal points)
  function dayTotalPoints(daySlots: SlotRow[]): number {
    return daySlots.reduce(
      (sum, r) => sum + (r.recipe?.pointsPerServing ?? 0),
      0
    );
  }
</script>

<section class="space-y-6">
  <nav class="text-sm">
    <a href="/menus" class="text-gusto-cream/70 hover:text-gusto-cream">← Menus</a>
  </nav>

  <header class="space-y-2">
    <h1 class="text-2xl font-semibold text-gusto-cream">{data.menu.name}</h1>
    <p class="text-sm text-gusto-cream/70">
      Du {format(data.menu.startDate, 'EEEE d MMMM', { locale: fr })}
      au {format(data.menu.endDate, 'EEEE d MMMM yyyy', { locale: fr })}
      {#if data.menu.generationParams}
        · {data.menu.generationParams.peopleCount} personne{data.menu.generationParams.peopleCount > 1 ? 's' : ''}
      {/if}
    </p>
  </header>

  <div class="space-y-4">
    {#each slotsByDate as [dateKey, daySlots] (dateKey)}
      {@const dayTotal = dayTotalPoints(daySlots)}
      <section class="rounded-lg bg-gusto-cream p-4">
        <header class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="text-lg font-semibold text-gusto-green-900">
            {format(new Date(dateKey), 'EEEE d MMMM', { locale: fr })}
          </h2>
          {#if dayTotal > 0}
            <span class="text-xs text-gusto-green-700/70">
              Total : {dayTotal} pts
            </span>
          {/if}
        </header>

        <ul class="space-y-2">
          {#each daySlots as { slot, recipe } (slot.id)}
            <li>
              {#if recipe}
                {@const c = pointsColor(recipe.pointsPerServing ?? 0)}
                <a
                  href={`/recettes/${recipe.slug}`}
                  class="flex items-center gap-3 rounded-md p-2 transition hover:bg-gusto-green-50"
                >
                  <span
                    class="w-20 flex-none text-xs uppercase tracking-wide text-gusto-green-700/70"
                  >
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
                <div
                  class="flex items-center gap-3 rounded-md border border-dashed border-gusto-green-200 bg-white p-2"
                >
                  <span
                    class="w-20 flex-none text-xs uppercase tracking-wide text-gusto-green-700/70"
                  >
                    {slot.mealType}
                  </span>
                  <span class="text-sm italic text-gusto-green-700/70">
                    {slot.freeText ?? '(vide — pas de recette éligible)'}
                  </span>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>

  <footer class="rounded-lg border border-dashed border-gusto-cream/30 p-4 text-sm text-gusto-cream/70">
    <span class="font-medium text-gusto-cream/90">Bientôt :</span> bouton « Générer la liste de courses »
    (phase 2-C-3) et swap manuel de recette par case (phase 2-C-2).
  </footer>
</section>
