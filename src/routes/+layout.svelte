<script lang="ts">
  import '../app.css';
  import Header from '$lib/components/Header.svelte';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: any } = $props();
</script>

{#if data.authed && data.currentUser}
  <Header currentUser={data.currentUser} householdUsers={data.householdUsers} />

  <!-- Pink 2-row checker strip (matches the "efficiency & swift" motif under the GUSTO logo).
       Sits on the body background, just below the header shadow. -->
  <div
    class="h-6 w-full"
    style="
      background-image:
        linear-gradient(to right, #E5A5C8 50%, transparent 50%),
        linear-gradient(to right, transparent 50%, #E5A5C8 50%);
      background-size: 24px 12px, 24px 12px;
      background-position: 0 0, 0 12px;
      background-repeat: repeat-x;
    "
    aria-hidden="true"
  ></div>
{/if}

<main class="mx-auto max-w-4xl px-4 py-8">
  {@render children()}
</main>
