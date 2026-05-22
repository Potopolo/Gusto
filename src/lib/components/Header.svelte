<script lang="ts">
  import { page } from '$app/state';
  import type { User } from '$lib/server/db/schema';

  let { currentUser, householdUsers }: { currentUser: User | null; householdUsers: User[] } =
    $props();

  const links = [
    { href: '/', label: 'Accueil' },
    { href: '/recettes', label: 'Recettes' },
    { href: '/menus', label: 'Menus' },
    { href: '/listes-de-courses', label: 'Courses' },
    { href: '/favoris', label: 'Favoris' }
  ];

  function isActive(href: string): boolean {
    const path = page.url.pathname;
    if (href === '/') return path === '/';
    return path === href || path.startsWith(href + '/');
  }
</script>

<header class="sticky top-0 z-10 bg-gusto-green shadow-[0_10px_28px_-6px_rgba(0,0,0,0.5)]">
  <div class="mx-auto flex max-w-4xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
    <a href="/" class="flex items-center" aria-label="Gusto — accueil">
      <img src="/icons/logo-full-pink.png" alt="Gusto" class="h-12 w-auto sm:h-16" />
    </a>

    <nav class="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-base sm:gap-x-6">
      {#each links as link (link.href)}
        {@const active = isActive(link.href)}
        <a
          href={link.href}
          aria-current={active ? 'page' : undefined}
          class="transition {active
            ? 'font-bold text-gusto-pink'
            : 'text-gusto-cream/80 hover:font-bold hover:text-gusto-cream'}"
        >
          {link.label}
        </a>
      {/each}

      {#if currentUser}
        <a
          href="/choisir-profil"
          title="Changer de profil"
          class="flex items-center gap-1 rounded-full border border-gusto-cream/25 px-2.5 py-0.5 text-xs text-gusto-cream/70 transition hover:border-gusto-cream/50 hover:text-gusto-cream"
        >
          {currentUser.labelFr}
          {#if householdUsers.length > 1}
            <span aria-hidden="true" class="opacity-60">↓</span>
          {/if}
        </a>
        <a
          href="/parametres"
          aria-label="Paramètres"
          title="Paramètres"
          class="flex h-7 w-7 items-center justify-center rounded-full text-gusto-cream/70 transition hover:bg-gusto-cream/10 hover:text-gusto-cream"
        >
          <span aria-hidden="true" class="text-base leading-none">⚙</span>
        </a>
      {/if}
    </nav>
  </div>
</header>
