<script lang="ts">
  /**
   * In-app confirmation modal. Replaces window.confirm() for destructive
   * actions so the UI stays inside the Gusto design system.
   *
   * Usage:
   *   <ConfirmDialog
   *     open={pendingDelete !== null}
   *     title="Supprimer le menu ?"
   *     message="Les recettes seront perdues."
   *     confirmLabel="Supprimer"
   *     onConfirm={doDelete}
   *     onCancel={() => (pendingDelete = null)}
   *   />
   */
  type Props = {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Set true while the parent runs the async action — disables both buttons. */
    busy?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  };

  let {
    open,
    title,
    message,
    confirmLabel = 'Supprimer',
    cancelLabel = 'Annuler',
    busy = false,
    onConfirm,
    onCancel
  }: Props = $props();

  let confirmBtn: HTMLButtonElement | null = $state(null);

  // Esc to cancel; focus the confirm button on open.
  $effect(() => {
    if (!open) return;
    confirmBtn?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel();
    }
    window.addEventListener('keydown', onKey);
    // Prevent body scroll while modal is open
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
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-dialog-title"
  >
    <!-- backdrop -->
    <div
      class="absolute inset-0 bg-gusto-green-900/70 backdrop-blur-sm"
      onclick={() => {
        if (!busy) onCancel();
      }}
      aria-hidden="true"
    ></div>

    <!-- panel -->
    <div
      class="relative w-full max-w-sm rounded-lg bg-gusto-cream p-5 shadow-[0_20px_60px_-10px_rgba(0,0,0,0.6)]"
    >
      <h2
        id="confirm-dialog-title"
        class="text-lg font-semibold text-gusto-green-900"
      >
        {title}
      </h2>
      <p class="mt-2 text-sm text-gusto-green-700/80">{message}</p>

      <div class="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onclick={onCancel}
          disabled={busy}
          class="rounded-md px-3 py-1.5 text-sm font-medium text-gusto-green-700 hover:text-gusto-green-900 disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          bind:this={confirmBtn}
          type="button"
          onclick={onConfirm}
          disabled={busy}
          class="rounded-md bg-gusto-pink px-3 py-1.5 text-sm font-medium text-gusto-green-900 hover:bg-gusto-pink-200 disabled:opacity-50"
        >
          {busy ? '…' : confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}
