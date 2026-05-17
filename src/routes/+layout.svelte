<script lang="ts">
  import '../app.css';
  import Header from '$lib/components/Header.svelte';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: any } = $props();
</script>

{#if data.authed && data.currentUser}
  <Header currentUser={data.currentUser} householdUsers={data.householdUsers} />
{/if}

<main class="mx-auto max-w-4xl px-4 py-8">
  {@render children()}
</main>
