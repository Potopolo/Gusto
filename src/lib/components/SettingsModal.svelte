<script lang="ts">
  /**
   * Settings modal — name editing + collapsible "À propos des points".
   * Name editing is tucked behind a "Modifier" toggle so the modal feels
   * lighter at first open. Opened from the header gear icon.
   */
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { untrack } from 'svelte';

  type Props = {
    open: boolean;
    currentLabel: string;
    currentEmail?: string | null;
    onClose: () => void;
  };
  let { open, currentLabel, currentEmail = null, onClose }: Props = $props();

  // Captured intentionally — the $effect below re-syncs from `currentLabel`
  // every time the modal opens, so a stale snapshot is fine here.
  let labelFr = $state(untrack(() => currentLabel));
  let notificationEmail = $state(untrack(() => currentEmail ?? ''));
  let nameEditing = $state(false);
  let emailEditing = $state(false);
  let aboutOpen = $state(false);
  let creditsOpen = $state(false);
  let savedNotice = $state(false);
  let emailSavedNotice = $state(false);

  $effect(() => {
    if (open) {
      labelFr = currentLabel;
      notificationEmail = currentEmail ?? '';
      nameEditing = false;
      emailEditing = false;
      aboutOpen = false;
      creditsOpen = false;
      savedNotice = false;
      emailSavedNotice = false;
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
      class="absolute inset-0 bg-gusto-green-900/70 backdrop-blur-sm"
      onclick={onClose}
      aria-hidden="true"
    ></div>

    <div
      class="relative w-full max-w-md space-y-5 rounded-lg bg-gusto-cream p-5 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.6)]"
    >
      <header class="flex items-baseline justify-between">
        <h2 id="settings-title" class="text-lg font-semibold text-gusto-green-900">
          Paramètres
        </h2>
        <button
          type="button"
          onclick={onClose}
          aria-label="Fermer"
          class="text-sm text-gusto-green-700 hover:text-gusto-green-900"
        >
          ✕
        </button>
      </header>

      <!-- Compte / nom — discreet row with an "Edit" link that toggles the form -->
      <div class="space-y-2">
        {#if !nameEditing}
          <div class="flex items-center justify-between">
            <div>
              <p class="text-[10px] uppercase tracking-wide text-gusto-green-700/60">
                Compte
              </p>
              <p class="text-sm font-medium text-gusto-green-900">
                {currentLabel}
              </p>
            </div>
            <button
              type="button"
              onclick={() => (nameEditing = true)}
              class="text-xs text-gusto-green-700 underline-offset-2 hover:underline"
            >
              Modifier
            </button>
          </div>
          {#if savedNotice}
            <p class="text-xs text-gusto-green">Nom enregistré.</p>
          {/if}
        {:else}
          <form
            method="post"
            action="/parametres?/saveSettings"
            use:enhance={() =>
              async ({ result }) => {
                if (result.type === 'success') {
                  await invalidateAll();
                  savedNotice = true;
                  nameEditing = false;
                  setTimeout(() => (savedNotice = false), 2000);
                }
              }}
            class="space-y-2"
          >
            <label class="block text-xs font-medium text-gusto-green-700">
              Nom affiché
              <input
                name="labelFr"
                type="text"
                required
                bind:value={labelFr}
                maxlength="40"
                class="mt-1 block w-full rounded-md text-sm text-gusto-green-900 shadow-sm"
              />
            </label>
            <div class="flex justify-end gap-2">
              <button
                type="button"
                onclick={() => {
                  nameEditing = false;
                  labelFr = currentLabel;
                }}
                class="rounded-md px-3 py-1.5 text-xs text-gusto-green-700 hover:text-gusto-green-900"
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

      <!-- Notification email — used to pre-fill the mailto when the user
           sends a shopping list to themselves. -->
      <div class="space-y-2 border-t border-gusto-green-100 pt-4">
        {#if !emailEditing}
          <div class="flex items-center justify-between">
            <div>
              <p class="text-[10px] uppercase tracking-wide text-gusto-green-700/60">
                Email pour la liste de courses
              </p>
              <p class="text-sm font-medium text-gusto-green-900">
                {currentEmail ?? '— non renseigné —'}
              </p>
            </div>
            <button
              type="button"
              onclick={() => (emailEditing = true)}
              class="text-xs text-gusto-green-700 underline-offset-2 hover:underline"
            >
              {currentEmail ? 'Modifier' : 'Renseigner'}
            </button>
          </div>
          {#if emailSavedNotice}
            <p class="text-xs text-gusto-green">Email enregistré.</p>
          {/if}
        {:else}
          <form
            method="post"
            action="/parametres?/saveEmail"
            use:enhance={() =>
              async ({ result }) => {
                if (result.type === 'success') {
                  // The layout's load() resolves notificationEmail — force
                  // it to re-run so the modal reflects the saved value.
                  await invalidateAll();
                  emailSavedNotice = true;
                  emailEditing = false;
                  setTimeout(() => (emailSavedNotice = false), 2000);
                }
              }}
            class="space-y-2"
          >
            <label class="block text-xs font-medium text-gusto-green-700">
              Adresse email
              <input
                name="email"
                type="email"
                bind:value={notificationEmail}
                placeholder="exemple@domaine.fr"
                class="mt-1 block w-full rounded-md text-sm text-gusto-green-900 shadow-sm"
              />
            </label>
            <div class="flex justify-end gap-2">
              <button
                type="button"
                onclick={() => {
                  emailEditing = false;
                  notificationEmail = currentEmail ?? '';
                }}
                class="rounded-md px-3 py-1.5 text-xs text-gusto-green-700 hover:text-gusto-green-900"
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

      <!-- About the points (collapsible, no formula) -->
      <div class="border-t border-gusto-green-100 pt-4">
        <button
          type="button"
          onclick={() => (aboutOpen = !aboutOpen)}
          aria-expanded={aboutOpen}
          class="flex w-full items-center justify-between text-xs font-medium text-gusto-green-700 hover:text-gusto-green-900"
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
          <div class="mt-2 space-y-2 text-xs text-gusto-green-700/85">
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
            <p class="text-gusto-green-700/65">
              <strong>C'est une estimation</strong> — matching imparfait des ingrédients,
              quantités parsées depuis du texte libre. À utiliser pour comparer deux
              recettes entre elles, pas pour un comptage diététique strict.
            </p>
          </div>
        {/if}
      </div>

      <!-- À propos / sources / mentions légales -->
      <div class="border-t border-gusto-green-100 pt-4">
        <button
          type="button"
          onclick={() => (creditsOpen = !creditsOpen)}
          aria-expanded={creditsOpen}
          class="flex w-full items-center justify-between text-xs font-medium text-gusto-green-700 hover:text-gusto-green-900"
        >
          <span>À propos & mentions légales</span>
          <span
            aria-hidden="true"
            class="text-[10px] transition-transform {creditsOpen ? 'rotate-90' : ''}"
          >
            ▶
          </span>
        </button>

        {#if creditsOpen}
          <div class="mt-2 space-y-2 text-xs text-gusto-green-700/85">
            <p>
              <strong>Gusto</strong> — application personnelle de planification de repas. Usage
              privé, non commercial, non affilié aux marques mentionnées ci-dessous.
            </p>
            <p>
              <strong>Sources de données :</strong>
            </p>
            <ul class="ml-4 list-disc space-y-1">
              <li>
                Nutrition des ingrédients :
                <a
                  href="https://ciqual.anses.fr/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="underline">CIQUAL ANSES 2025</a
                > (base publique).
              </li>
              <li>
                Système de points : inspiré du
                <strong>WW SmartPoints</strong>® — formule recalibrée localement, recettes WW ZeroPoints
                saisies à la main depuis l'application WW.
              </li>
              <li>
                Recettes :
                <a
                  href="https://www.amandinecooking.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="underline">Amandine Cooking</a
                >
                +
                <a
                  href="https://www.fourchette-et-bikini.fr/"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="underline">Fourchette & Bikini</a
                >.
              </li>
            </ul>
            <p class="text-gusto-green-700/65">
              Les noms <em>WW</em>, <em>SmartPoints</em>, <em>ZeroPoints</em>, <em>Amandine Cooking</em>
              et <em>Fourchette & Bikini</em> appartiennent à leurs propriétaires respectifs.
              Aucune donnée n'est partagée avec un tiers — tout reste local.
            </p>
          </div>
        {/if}
      </div>

      <!-- Déconnexion -->
      <div class="border-t border-gusto-green-100 pt-4">
        <form method="post" action="/parametres?/logout">
          <button
            type="submit"
            class="text-xs font-medium text-gusto-pink-700 hover:text-gusto-pink-900 hover:underline"
          >
            Changer de profil / se déconnecter
          </button>
        </form>
      </div>
    </div>
  </div>
{/if}
