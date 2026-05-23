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

  <section class="space-y-3 rounded-lg border border-gusto-cream/15 p-5 text-sm text-gusto-cream/85">
    <header class="space-y-1">
      <h2 class="text-lg font-semibold text-gusto-cream">À propos des points</h2>
      <p class="text-xs text-gusto-cream/60">
        Tous les chiffres affichés dans Gusto sont des <em>estimations</em> — utiles pour comparer
        deux recettes entre elles, pas pour un comptage diététique strict.
      </p>
    </header>

    <p>
      Le score est inspiré du <strong>WW SmartPoints</strong>. Pour chaque recette,
      Gusto agrège la nutrition des ingrédients via la base <a
        href="https://ciqual.anses.fr/"
        target="_blank"
        rel="noopener noreferrer"
        class="underline hover:text-gusto-cream">CIQUAL 2025 (ANSES)</a
      >, puis applique cette formule :
    </p>

    <pre class="overflow-x-auto rounded-md bg-gusto-green-900/40 p-3 font-mono text-[11px] leading-relaxed text-gusto-cream/90">
points = kcal / 80
       + sat_fat_g × 0,15
       + sugar_g   × 0,06
       − protein_g × 0,05
       − fiber_g   × 0,05</pre>

    <p>
      Les <strong>protéines</strong> et les <strong>fibres</strong> sont des crédits (ils
      réduisent le total), les <strong>graisses saturées</strong> et le <strong>sucre</strong> le font monter.
      Le résultat est arrondi entre 0 et 60 pts et toujours rapporté à
      <strong>une portion</strong> (ou une part, une tranche…).
    </p>

    <div class="rounded-md bg-gusto-cream/5 p-3 text-xs text-gusto-cream/75">
      <p class="mb-1 font-semibold text-gusto-cream">Pourquoi c'est une estimation ?</p>
      <ul class="list-disc space-y-1 pl-4">
        <li>
          Les ingrédients d'Amandine Cooking sont matchés à CIQUAL par similarité de nom
          (taux de matching ~96 %). Les rares lignes non matchées ne sont pas comptées.
        </li>
        <li>
          Quand le matching ne couvre pas assez d'ingrédients (≥ 50 %), le score
          provient d'un estimateur à base de mots-clés (catégorie + nom de la recette).
        </li>
        <li>
          Les quantités sont parsées depuis du texte libre — parfois « 2 oignons » est
          interprété comme « 2 × 100 g d'oignon », ce qui peut décaler le total.
        </li>
      </ul>
    </div>
  </section>
</section>
