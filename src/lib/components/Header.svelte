<script lang="ts">
  import { page } from '$app/state';
  import { settingsOpen } from '$lib/stores/settings';
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

<header
  class="sticky top-0 z-10 bg-gusto-green shadow-[0_10px_28px_-6px_rgba(0,0,0,0.5)] dark:bg-black dark:shadow-[0_10px_28px_-6px_rgba(0,0,0,0.7)]"
>
  <!-- Full-bleed DA background: solid green + chef-head pattern baked in.
       Sits behind the logo row only — the mobile nav strip stays plain.
       On desktop we shrink + repeat the tile so the motif size stays in
       line with mobile (otherwise bg-cover blows the heads up on wide
       viewports). -->
  <div class="relative">
    <div
      class="pointer-events-none absolute inset-0 bg-[url('/patterns/header-bg.svg')] bg-cover bg-center sm:bg-[length:560px_auto] sm:bg-repeat"
      aria-hidden="true"
    ></div>
    <div class="relative mx-auto max-w-4xl px-4">
    <!-- Top row: logo (centered on mobile, flush-left on desktop) + desktop text nav -->
    <div class="flex items-center pt-2.5 sm:justify-between sm:pb-2.5">
      <a
        href="/"
        class="mx-auto flex items-center pb-3 sm:mx-0 sm:pb-0"
        aria-label="Gusto — accueil"
      >
        <img src="/icons/logo-full-pink.png" alt="Gusto" class="h-12 w-auto sm:h-20" />
      </a>

      <!-- Desktop-only text nav -->
      <nav class="hidden items-center gap-6 text-base sm:flex">
        {#each links as link (link.href)}
          {@const active = isActive(link.href)}
          <a
            href={link.href}
            aria-current={active ? 'page' : undefined}
            class="font-medium transition duration-200 hover:-translate-y-0.5 {active
              ? 'text-gusto-pink'
              : 'text-gusto-cream/80 hover:text-gusto-cream'}"
          >
            {link.label}
          </a>
        {/each}
      </nav>

      {#if currentUser}
        <button
          type="button"
          onclick={() => settingsOpen.set(true)}
          aria-label="Paramètres"
          title="Paramètres"
          class="hidden items-center justify-center rounded-md p-1 text-gusto-cream/80 transition duration-200 hover:-translate-y-0.5 hover:text-gusto-cream sm:flex {$settingsOpen
            ? 'text-gusto-pink'
            : ''}"
        >
          <span class="nav-icon nav-icon-settings" aria-hidden="true"></span>
        </button>
      {/if}
    </div>
    </div>
  </div>
  <!-- /Full-bleed bg wrapper. Mobile nav is sibling of it so it stays
       on the bare header bg with no pattern. -->

  <div class="mx-auto max-w-4xl px-4">
    <!-- Mobile-only icon nav, with a discreet divider above -->
    <nav
      class="flex items-center justify-between gap-x-2 border-t border-gusto-cream/10 py-2.5 sm:hidden"
    >
      {#each links as link (link.href)}
        {@const active = isActive(link.href)}
        <a
          href={link.href}
          aria-label={link.label}
          aria-current={active ? 'page' : undefined}
          title={link.label}
          class="nav-link flex flex-1 items-center justify-center rounded-md p-1 transition-colors {active
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
        <button
          type="button"
          onclick={() => settingsOpen.set(true)}
          aria-label="Paramètres"
          title="Paramètres"
          class="nav-link flex flex-1 items-center justify-center rounded-md p-1 transition-colors {$settingsOpen
            ? 'text-gusto-pink'
            : 'text-gusto-cream/80 hover:text-gusto-cream'}"
        >
          <span class="nav-icon nav-icon-settings" aria-hidden="true"></span>
        </button>
      {/if}
    </nav>
  </div>
</header>
