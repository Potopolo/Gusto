<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData } = $props();
</script>

<div class="mx-auto max-w-sm pt-16">
  <h1 class="mb-1 text-xl font-semibold text-gusto-cream">Gusto</h1>
  <p class="mb-6 text-sm text-gusto-cream/70">Entre le mot de passe du foyer pour continuer.</p>

  <form method="post" use:enhance class="space-y-4 rounded-lg bg-gusto-cream p-6">
    <div>
      <label for="password" class="mb-1 block text-sm font-medium text-gusto-green-700"
        >Mot de passe</label
      >
      <input
        id="password"
        name="password"
        type="password"
        autocomplete="current-password"
        required
        class="block w-full rounded-md text-gusto-green-900 shadow-sm"
      />
    </div>

    {#if form?.error}
      <p class="text-sm text-gusto-pink-700">{form.error}</p>
    {/if}

    <button
      type="submit"
      class="w-full rounded-md bg-gusto-pink px-4 py-2 text-sm font-medium text-gusto-green-900 hover:bg-gusto-pink-200"
    >
      Entrer
    </button>
  </form>
</div>
