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

<header class="sticky top-0 z-10 overflow-hidden bg-gusto-green shadow-[0_10px_28px_-6px_rgba(0,0,0,0.5)]">
  <!-- DA decorative pattern overlay. The SVG file is used as a CSS mask
       so we colour it with a Tailwind text-* class instead of its baked-in
       dark green (which would be invisible on a dark header bg). The
       composite-source mask creates the "diffuse near the menu" fade. -->
  <div
    class="pointer-events-none absolute inset-0 text-gusto-cream/15"
    style="background-color: currentColor; -webkit-mask-image: url('/patterns/pattern.svg'); mask-image: url('/patterns/pattern.svg'); -webkit-mask-size: 480px; mask-size: 480px; -webkit-mask-repeat: repeat; mask-repeat: repeat; -webkit-mask-position: center; mask-position: center;"
    aria-hidden="true"
  ></div>
  <!-- Second pass: a smooth top-edge softener that blurs the pattern
       lightly near the menu without affecting the lower band. -->
  <div
    class="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-gusto-green to-transparent"
    aria-hidden="true"
  ></div>

  <div class="relative mx-auto max-w-4xl px-4">
    <!-- Top row.
         Mobile: logo centered (only child shown here, icon nav is below).
         Desktop: flex with justify-between so logo sits flush-left, settings
         flush-right, and the 5-link nav floats centered between them — its
         middle item (Menus) lands at the geometric centre of the free space. -->
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
        {@const active = isActive('/parametres')}
        <a
          href="/parametres"
          aria-label="Paramètres"
          aria-current={active ? 'page' : undefined}
          title="Paramètres"
          class="hidden items-center justify-center rounded-md p-1 transition duration-200 hover:-translate-y-0.5 sm:flex {active
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
    </div>

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
        {@const active = isActive('/parametres')}
        <a
          href="/parametres"
          aria-label="Paramètres"
          aria-current={active ? 'page' : undefined}
          title="Paramètres"
          class="nav-link flex flex-1 items-center justify-center rounded-md p-1 transition-colors {active
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
