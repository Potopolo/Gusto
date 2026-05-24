<script lang="ts">
  /**
   * Settings modal — theme + collapsible "À propos des points".
   * Name editing is tucked behind a "Modifier" toggle so the modal feels
   * lighter at first open. Opened from the header gear icon.
   */
  import { enhance } from '$app/forms';
  import { theme, setTheme, type Theme } from '$lib/theme';

  type Props = { open: boolean; currentLabel: string; onClose: () => void };
  let { open, currentLabel, onClose }: Props = $props();

  let labelFr = $state(currentLabel);
  let nameEditing = $state(false);
  let aboutOpen = $state(false);
  let savedNotice = $state(false);

  $effect(() => {
    if (open) {
      labelFr = currentLabel;
      nameEditing = false;
      aboutOpen = false;
      savedNotice = false;
    }
  });

  $effect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  });

  const themeOptions: Array<{ value: Theme; label: string }> = [
    { value: 'light', label: 'Clair' },
    { value: 'dark', label: 'Sombre' },
    { value: 'system', label: 'Système' }
  ];
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:items-center sm:pt-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-title"
  >
    <div
      class="absolute inset-0 bg-gusto-green-900/70 backdrop-blur-sm dark:bg-black/80"
      onclick={onClose}
      aria-hidden="true"
    ></div>

    <div
      class="relative w-full max-w-md space-y-5 rounded-lg bg-gusto-cream p-5 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.6)] dark:bg-gusto-green-900 dark:text-gusto-cream"
    >
      <header class="flex items-baseline justify-between">
        <h2 id="settings-title" class="text-lg font-semibold text-gusto-green-900 dark:text-gusto-cream">
          Paramètres
        </h2>
        <button
          type="button"
          onclick={onClose}
          aria-label="Fermer"
          class="text-sm text-gusto-green-700 hover:text-gusto-green-900 dark:text-gusto-cream/70 dark:hover:text-gusto-cream"
        >
          ✕
        </button>
      </header>

      <!-- Compte / nom — discreet row with an "Edit" link that toggles the form -->
      <div class="space-y-2">
        {#if !nameEditing}
          <div class="flex items-center justify-between">
            <div>
              <p class="text-[10px] uppercase tracking-wide text-gusto-green-700/60 dark:text-gusto-cream/60">
                Compte
              </p>
              <p class="text-sm font-medium text-gusto-green-900 dark:text-gusto-cream">
                {currentLabel}
              </p>
            </div>
            <button
              type="button"
              onclick={() => (nameEditing = true)}
              class="text-xs text-gusto-green-700 underline-offset-2 hover:underline dark:text-gusto-cream/80"
            >
              Modifier
            </button>
          </div>
          {#if savedNotice}
            <p class="text-xs text-gusto-green dark:text-gusto-mint">Nom enregistré.</p>
          {/if}
        {:else}
          <form
            method="post"
            action="/parametres?/saveSettings"
            use:enhance={() =>
              async ({ result }) => {
                if (result.type === 'success') {
                  savedNotice = true;
                  nameEditing = false;
                  setTimeout(() => (savedNotice = false), 2000);
                }
              }}
            class="space-y-2"
          >
            <label class="block text-xs font-medium text-gusto-green-700 dark:text-gusto-cream/70">
              Nom affiché
              <input
                name="labelFr"
                type="text"
                required
                bind:value={labelFr}
                maxlength="40"
                class="mt-1 block w-full rounded-md text-sm text-gusto-green-900 shadow-sm dark:bg-gusto-green-700 dark:text-gusto-cream"
              />
            </label>
            <div class="flex justify-end gap-2">
              <button
                type="button"
                onclick={() => {
                  nameEditing = false;
                  labelFr = currentLabel;
                }}
                class="rounded-md px-3 py-1.5 text-xs text-gusto-green-700 hover:text-gusto-green-900 dark:text-gusto-cream/70 dark:hover:text-gusto-cream"
              >
                Annuler
              </button>
              <button
                type="submit"
                class="rounded-md bg-gusto-pink px-3 py-1.5 text-xs font-medium text-gusto-green-900 hover:bg-gusto-pink-200"
              >
                Enregistrer
              </button>
            </div>
          </form>
        {/if}
      </div>

      <!-- Theme -->
      <div class="space-y-2 border-t border-gusto-green-100 pt-4 dark:border-gusto-cream/15">
        <p class="text-xs font-medium text-gusto-green-700 dark:text-gusto-cream/70">Apparence</p>
        <div class="flex gap-1.5">
          {#each themeOptions as opt (opt.value)}
            {@const active = $theme === opt.value}
            <button
              type="button"
              onclick={() => setTheme(opt.value)}
              aria-pressed={active}
              class="flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition {active
                ? 'bg-gusto-pink text-gusto-green-900'
                : 'bg-gusto-green-50 text-gusto-green-700 hover:bg-gusto-green-100 dark:bg-gusto-green-700/50 dark:text-gusto-cream/80 dark:hover:bg-gusto-green-700'}"
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- About the points (collapsible, no formula) -->
      <div class="border-t border-gusto-green-100 pt-4 dark:border-gusto-cream/15">
        <button
          type="button"
          onclick={() => (aboutOpen = !aboutOpen)}
          aria-expanded={aboutOpen}
          class="flex w-full items-center justify-between text-xs font-medium text-gusto-green-700 hover:text-gusto-green-900 dark:text-gusto-cream/70 dark:hover:text-gusto-cream"
        >
          <span>À propos des points</span>
          <span
            aria-hidden="true"
            class="text-[10px] transition-transform {aboutOpen ? 'rotate-90' : ''}"
          >
            ▶
          </span>
        </button>

        {#if aboutOpen}
          <div class="mt-2 space-y-2 text-xs text-gusto-green-700/85 dark:text-gusto-cream/75">
            <p>
              Les points donnent une <strong>idée du caractère plus ou moins léger</strong>
              d'une portion : entre 0 (très léger) et la trentaine pour les plus gourmands.
              Ils s'inspirent du WW SmartPoints.
            </p>
            <p>
              Pour chaque recette, Gusto agrège la nutrition des ingrédients via la base
              <a
                href="https://ciqual.anses.fr/"
                target="_blank"
                rel="noopener noreferrer"
                class="underline">CIQUAL ANSES 2025</a
              > et pondère calories, sucre, graisses saturées (qui font monter) contre
              protéines et fibres (qui font baisser). Le score est toujours rapporté à
              <strong>une portion</strong> (part, tranche…), pas au plat entier.
            </p>
            <p class="text-gusto-green-700/65 dark:text-gusto-cream/60">
              <strong>C'est une estimation</strong> — matching imparfait des ingrédients,
              quantités parsées depuis du texte libre. À utiliser pour comparer deux
              recettes entre elles, pas pour un comptage diététique strict.
            </p>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
