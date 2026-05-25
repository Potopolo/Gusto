<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let people = $state(2);
</script>

<section class="space-y-6">
  <nav class="text-sm">
    <a href="/menus" class="text-gusto-cream/70 hover:text-gusto-cream">← Menus</a>
  </nav>

  <header class="space-y-2 text-center sm:text-left">
    <h1 class="text-2xl font-semibold text-gusto-cream">Nouveau menu</h1>
    <p class="text-sm text-gusto-cream/70">
      Gusto te génère 7 jours de recettes adaptées à ton objectif points et à la saison.
    </p>
  </header>

  <form
    method="post"
    use:enhance
    class="space-y-6 rounded-lg bg-gusto-cream p-6 text-gusto-green-900"
  >
    <label class="block text-sm">
      <span class="mb-1 block font-medium">Semaine du</span>
      <input
        type="date"
        name="startDate"
        value={data.defaultStartDate}
        required
        class="block w-full rounded-md shadow-sm"
      />
    </label>

    <div>
      <span class="mb-2 block text-sm font-medium">Pour combien de personnes</span>
      <div class="inline-flex items-center rounded-md border border-gusto-green-200 bg-white">
        <button
          type="button"
          onclick={() => (people = Math.max(1, people - 1))}
          class="px-3 py-1.5 text-lg leading-none text-gusto-green hover:bg-gusto-green-50"
          aria-label="Diminuer"
        >−</button>
        <span class="border-x border-gusto-green-200 px-4 py-1.5 text-sm font-medium">
          {people}
        </span>
        <button
          type="button"
          onclick={() => (people = Math.min(20, people + 1))}
          class="px-3 py-1.5 text-lg leading-none text-gusto-green hover:bg-gusto-green-50"
          aria-label="Augmenter"
        >+</button>
      </div>
      <input type="hidden" name="peopleCount" value={people} />
    </div>

    <fieldset>
      <legend class="mb-2 block text-sm font-medium">Repas à générer</legend>
      <p class="mb-2 text-xs text-gusto-green-700/70">
        Déjeuner et dîner sont cochés par défaut. Tu peux aussi inclure le petit-déjeuner ou le
        goûter — Gusto piochera dans les recettes adaptées à chaque créneau.
      </p>
      <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" name="breakfast" />
        <span>Petit-déjeuner</span>
      </label>
      <label class="mt-2 flex items-center gap-2 text-sm">
        <input type="checkbox" name="lunch" checked />
        <span>Déjeuner</span>
      </label>
      <label class="mt-2 flex items-center gap-2 text-sm">
        <input type="checkbox" name="snack" />
        <span>Goûter</span>
      </label>
      <label class="mt-2 flex items-center gap-2 text-sm">
        <input type="checkbox" name="dinner" checked />
        <span>Dîner</span>
      </label>
    </fieldset>

    {#if form?.error}
      <p class="text-sm text-gusto-pink-700">{form.error}</p>
    {/if}

    <button
      type="submit"
      class="w-full rounded-md bg-gusto-pink px-4 py-2 text-sm font-medium text-gusto-green-900 hover:bg-gusto-pink-200"
    >
      Générer le menu
    </button>
  </form>
</section>
