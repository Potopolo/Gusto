/** Shared open-state for the Settings modal so it can be triggered
 *  from multiple places (desktop gear in Header, mobile gear in
 *  the floating nav). The modal itself lives in +layout.svelte. */
import { writable } from 'svelte/store';

export const settingsOpen = writable(false);
