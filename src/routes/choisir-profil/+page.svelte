<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let creating = $state(false);
</script>

<!-- Full-viewport login layout: vertically centred, large logo, no
     header (the layout already hides the chrome on /choisir-profil). -->
<div
  class="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col items-center justify-center px-4"
>
  <div class="mb-8 flex justify-center">
    <img
      src="/icons/logo-full-pink.png"
      alt="Gusto"
      class="h-auto w-80 max-w-full sm:w-[28rem]"
    />
  </div>

  <h1 class="mb-8 text-center font-display text-3xl text-gusto-cream sm:text-4xl">
    Qui va là ?
  </h1>

  <div class="w-full">

  <div class="space-y-3">
    {#each data.users as user (user.id)}
      <form method="post" action="?/select" use:enhance>
        <input type="hidden" name="userId" value={user.id} />
        <button
          type="submit"
          class="flex w-full items-center justify-between rounded-lg bg-gusto-cream px-4 py-3 text-left transition hover:ring-2 hover:ring-gusto-pink"
        >
          <span class="font-medium text-gusto-green-900">{user.labelFr}</span>
          <span class="text-sm text-gusto-green-200">→</span>
        </button>
      </form>
    {/each}
  </div>

  <div class="mt-6">
    {#if !creating}
      <button
        type="button"
        onclick={() => (creating = true)}
        class="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gusto-cream/30 bg-transparent px-4 py-3 text-sm text-gusto-cream/80 hover:border-gusto-cream/60 hover:text-gusto-cream"
      >
        <span aria-hidden="true">+</span> Nouveau profil
      </button>
    {:else}
      <form
        method="post"
        action="?/create"
        use:enhance={() => {
          return async ({ update }) => {
            await update();
          };
        }}
        class="space-y-3 rounded-lg bg-gusto-cream p-4"
      >
        <label class="block text-sm">
          <span class="mb-1 block font-medium text-gusto-green-700">Prénom ou pseudo</span>
          <input
            name="labelFr"
            type="text"
            autocomplete="off"
            required
            maxlength="40"
            placeholder="ex. Camille"
            class="block w-full rounded-md text-gusto-green-900 shadow-sm"
          />
        </label>
        <div class="flex items-center gap-2">
          <button
            type="submit"
            class="rounded-md bg-gusto-pink px-3 py-2 text-sm font-medium text-gusto-green-900 hover:bg-gusto-pink-200"
          >
            Créer
          </button>
          <button
            type="button"
            onclick={() => (creating = false)}
            class="rounded-md px-3 py-2 text-sm text-gusto-green-700 hover:text-gusto-green-900"
          >
            Annuler
          </button>
        </div>
      </form>
    {/if}
  </div>

  {#if form?.error}
    <p class="mt-4 text-sm text-gusto-pink-200">{form.error}</p>
  {/if}
  </div>
</div>
