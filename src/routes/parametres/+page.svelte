<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<section class="space-y-8">
  <nav class="text-sm">
    <a href="/favoris" class="text-gusto-cream/70 hover:text-gusto-cream">← Favoris</a>
  </nav>

  <header class="space-y-1">
    <h1 class="text-2xl font-semibold text-gusto-cream">Paramètres</h1>
    <p class="text-sm text-gusto-cream/70">Modifie le nom affiché de ton profil.</p>
  </header>

  <form
    method="post"
    action="?/saveSettings"
    use:enhance
    class="space-y-6 rounded-lg bg-gusto-cream p-6"
  >
    <label class="block text-sm">
      <span class="mb-1 block font-medium text-gusto-green-700">Nom affiché</span>
      <input
        name="labelFr"
        type="text"
        required
        value={data.user?.labelFr ?? ''}
        maxlength="40"
        class="block w-full rounded-md text-gusto-green-900 shadow-sm"
      />
    </label>

    {#if form?.error}
      <p class="text-sm text-gusto-pink-700">{form.error}</p>
    {/if}
    {#if form?.saved}
      <p class="text-sm text-gusto-green">Nom enregistré.</p>
    {/if}

    <button
      type="submit"
      class="rounded-md bg-gusto-pink px-4 py-2 text-sm font-medium text-gusto-green-900 hover:bg-gusto-pink-200"
    >
      Enregistrer
    </button>
  </form>
</section>
