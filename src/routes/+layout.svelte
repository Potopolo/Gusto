<script lang="ts">
  import '../app.css';
  import Header from '$lib/components/Header.svelte';
  import SettingsModal from '$lib/components/SettingsModal.svelte';
  import { settingsOpen } from '$lib/stores/settings';
  import { page } from '$app/stores';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: any } = $props();

  // The profile picker is the only "logged-out-looking" screen even when
  // the user has a stale cookie — hide the header there so coming back
  // to switch profiles feels like a fresh landing.
  let isProfilePicker = $derived($page.url.pathname === '/choisir-profil');
</script>

{#if !isProfilePicker && data.authed && data.currentUser}
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

  <SettingsModal
    open={$settingsOpen}
    currentLabel={data.currentUser.labelFr}
    currentEmail={data.notificationEmail}
    onClose={() => settingsOpen.set(false)}
  />
{/if}

<main class="mx-auto max-w-4xl px-4 py-8">
  {@render children()}
</main>
