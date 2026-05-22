<script lang="ts">
  import { page } from '$app/state';
  import type { User } from '$lib/server/db/schema';

  let { currentUser, householdUsers }: { currentUser: User | null; householdUsers: User[] } =
    $props();

  const links = [
    { href: '/', label: 'Accueil', icon: 'nav-icon-home' },
    { href: '/recettes', label: 'Recettes', icon: 'nav-icon-recipe' },
    { href: '/menus', label: 'Menus', icon: 'nav-icon-menus' },
    { href: '/listes-de-courses', label: 'Courses', icon: 'nav-icon-courses' },
    { href: '/favoris', label: 'Favoris', icon: 'nav-icon-favoris' }
  ];

  function isActive(href: string): boolean {
    const path = page.url.pathname;
    if (href === '/') return path === '/';
    return path === href || path.startsWith(href + '/');
  }
</script>

<header class="sticky top-0 z-10 bg-gusto-green shadow-[0_10px_28px_-6px_rgba(0,0,0,0.5)]">
  <div class="mx-auto max-w-4xl px-4">
    <!-- Top row: logo (centered on mobile, left on desktop) + desktop text nav -->
    <div class="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2.5 sm:pb-2.5">
      <a
        href="/"
        class="mx-auto flex items-center sm:mx-0"
        aria-label="Gusto — accueil"
      >
        <img src="/icons/logo-full-pink.png" alt="Gusto" class="h-12 w-auto sm:h-16" />
      </a>

      <!-- Desktop-only text nav -->
      <nav class="ml-auto hidden items-center gap-6 text-base sm:flex">
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
          {@const active = isActive('/parametres')}
          <a
            href="/parametres"
            aria-label="Paramètres"
            aria-current={active ? 'page' : undefined}
            title="Paramètres"
            class="flex items-center justify-center rounded-md p-1 transition-colors {active
              ? 'text-gusto-pink'
              : 'text-gusto-cream/80 hover:text-gusto-cream'}"
          >
            {#key active}
              <span
                class="nav-icon nav-icon-settings {active ? 'nav-pop' : ''}"
                aria-hidden="true"
              ></span>
            {/key}
          </a>
        {/if}
      </nav>
    </div>

    <!-- Mobile-only icon nav, with divider above -->
    <nav
      class="flex items-center justify-between gap-x-2 border-t border-gusto-cream/15 py-2.5 sm:hidden"
    >
      {#each links as link (link.href)}
        {@const active = isActive(link.href)}
        <a
          href={link.href}
          aria-label={link.label}
          aria-current={active ? 'page' : undefined}
          title={link.label}
          class="flex flex-1 items-center justify-center rounded-md p-1 transition-colors {active
            ? 'text-gusto-pink'
            : 'text-gusto-cream/80 hover:text-gusto-cream'}"
        >
          {#key active}
            <span
              class="nav-icon {link.icon} {active ? 'nav-pop' : ''}"
              aria-hidden="true"
            ></span>
          {/key}
        </a>
      {/each}

      {#if currentUser}
        {@const active = isActive('/parametres')}
        <a
          href="/parametres"
          aria-label="Paramètres"
          aria-current={active ? 'page' : undefined}
          title="Paramètres"
          class="flex flex-1 items-center justify-center rounded-md p-1 transition-colors {active
            ? 'text-gusto-pink'
            : 'text-gusto-cream/80 hover:text-gusto-cream'}"
        >
          {#key active}
            <span
              class="nav-icon nav-icon-settings {active ? 'nav-pop' : ''}"
              aria-hidden="true"
            ></span>
          {/key}
        </a>
      {/if}
    </nav>
  </div>
</header>
