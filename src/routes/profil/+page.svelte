<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const activityOptions = [
    { value: 'sedentary', label: 'Sédentaire' },
    { value: 'light', label: 'Légère' },
    { value: 'moderate', label: 'Modérée' },
    { value: 'active', label: 'Active' }
  ];

  const goalOptions = [
    { value: 'loss', label: 'Perte de poids durable' },
    { value: 'maintain', label: 'Maintien' }
  ];
</script>

<section class="space-y-8">
  <header class="space-y-1">
    <h1 class="text-2xl font-semibold text-gusto-cream">Profil</h1>
    <p class="text-sm text-gusto-cream/70">Édite ton profil et l'équipement de cuisine.</p>
  </header>

  <form
    method="post"
    action="?/saveProfile"
    use:enhance
    class="space-y-6 rounded-lg bg-gusto-cream p-6"
  >
    <div class="grid gap-4 sm:grid-cols-2">
      <label class="block text-sm">
        <span class="mb-1 block font-medium text-gusto-green-700">Nom affiché</span>
        <input
          name="labelFr"
          type="text"
          required
          value={data.currentUser?.labelFr ?? ''}
          class="block w-full rounded-md text-gusto-green-900 shadow-sm"
        />
      </label>

      <label class="block text-sm">
        <span class="mb-1 block font-medium text-gusto-green-700">Âge</span>
        <input
          name="age"
          type="number"
          min="1"
          max="120"
          value={data.profile.age ?? ''}
          class="block w-full rounded-md text-gusto-green-900 shadow-sm"
        />
      </label>

      <label class="block text-sm">
        <span class="mb-1 block font-medium text-gusto-green-700">Taille (cm)</span>
        <input
          name="heightCm"
          type="number"
          min="50"
          max="250"
          step="0.1"
          value={data.profile.heightCm ?? ''}
          class="block w-full rounded-md text-gusto-green-900 shadow-sm"
        />
      </label>

      <label class="block text-sm">
        <span class="mb-1 block font-medium text-gusto-green-700">Niveau d'activité</span>
        <select name="activityLevel" class="block w-full rounded-md text-gusto-green-900 shadow-sm">
          {#each activityOptions as opt (opt.value)}
            <option value={opt.value} selected={data.profile.activityLevel === opt.value}>
              {opt.label}
            </option>
          {/each}
        </select>
      </label>

      <label class="block text-sm">
        <span class="mb-1 block font-medium text-gusto-green-700">Phase d'objectif</span>
        <select name="goalPhase" class="block w-full rounded-md text-gusto-green-900 shadow-sm">
          {#each goalOptions as opt (opt.value)}
            <option value={opt.value} selected={data.profile.goalPhase === opt.value}>
              {opt.label}
            </option>
          {/each}
        </select>
      </label>

      <label class="block text-sm">
        <span class="mb-1 block font-medium text-gusto-green-700">Objectif points / jour</span>
        <input
          name="dailyPointsTarget"
          type="number"
          min="0"
          max="60"
          value={data.profile.dailyPointsTarget}
          class="block w-full rounded-md text-gusto-green-900 shadow-sm"
        />
      </label>
    </div>

    {#if form?.error}
      <p class="text-sm text-gusto-pink-700">{form.error}</p>
    {/if}
    {#if form?.saved === 'profile'}
      <p class="text-sm text-gusto-green">Profil enregistré.</p>
    {/if}

    <button
      type="submit"
      class="rounded-md bg-gusto-pink px-4 py-2 text-sm font-medium text-gusto-green-900 hover:bg-gusto-pink-200"
    >
      Enregistrer
    </button>
  </form>

  <section class="space-y-4">
    <header class="space-y-1">
      <h2 class="text-lg font-semibold text-gusto-cream">Équipement de cuisine</h2>
      <p class="text-sm text-gusto-cream/70">
        Coche ce que tu possèdes. La génération de menus filtrera en fonction.
      </p>
    </header>

    <ul class="divide-y divide-gusto-green-100 rounded-lg bg-gusto-cream">
      {#each data.equipment as eq (eq.id)}
        <li class="flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <span class="font-medium text-gusto-green-900">{eq.nameFr}</span>
          <form method="post" action="?/toggleEquipment" use:enhance>
            <input type="hidden" name="id" value={eq.id} />
            <input type="hidden" name="owned" value={(!eq.owned).toString()} />
            <button
              type="submit"
              class="rounded-full px-3 py-1 text-xs font-medium {eq.owned
                ? 'bg-gusto-green text-gusto-cream hover:bg-gusto-green-700'
                : 'bg-gusto-green-50 text-gusto-green-700 hover:bg-gusto-green-100'}"
            >
              {eq.owned ? 'possédé' : 'absent'}
            </button>
          </form>
        </li>
      {/each}
    </ul>
  </section>
</section>
