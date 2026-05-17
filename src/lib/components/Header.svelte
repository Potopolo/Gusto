<script lang="ts">
  import type { User } from '$lib/server/db/schema';

  let { currentUser, householdUsers }: { currentUser: User | null; householdUsers: User[] } =
    $props();
</script>

<header class="bg-gusto-green">
  <div class="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4">
    <a href="/" class="flex items-center" aria-label="Gusto — accueil">
      <img src="/icons/logo-full-pink.png" alt="Gusto" class="h-16 w-auto sm:h-20" />
    </a>

    <nav class="ml-auto flex items-center gap-3 text-sm sm:gap-5">
      <a href="/" class="text-gusto-cream/80 hover:text-gusto-cream">Accueil</a>
      <a href="/recettes" class="text-gusto-cream/80 hover:text-gusto-cream">Recettes</a>
      <a href="/menus" class="text-gusto-cream/80 hover:text-gusto-cream">Menus</a>
      <a href="/profil" class="text-gusto-cream/80 hover:text-gusto-cream">Profil</a>

      {#if currentUser}
        <a
          href="/choisir-profil"
          class="flex items-center gap-1.5 rounded-full bg-gusto-pink px-3 py-1 text-sm font-medium text-gusto-green-900 hover:bg-gusto-pink-200"
          title="Changer de profil"
        >
          <span class="hidden text-xs uppercase tracking-wide opacity-60 sm:inline">Profil :</span>
          {currentUser.labelFr}
          {#if householdUsers.length > 1}
            <span aria-hidden="true" class="opacity-60">↓</span>
          {/if}
        </a>
      {/if}
    </nav>
  </div>
</header>
