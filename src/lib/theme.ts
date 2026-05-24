/**
 * Theme management — dark mode toggle, persisted to localStorage.
 *
 * Strategy:
 *   - 'light'  → no `dark` class on <html>, current cream-on-green look.
 *   - 'dark'   → `dark` class on <html>, surfaces darken via Tailwind dark: variants.
 *   - 'system' → follows prefers-color-scheme (default).
 *
 * On a fresh visit the system pref is read once and applied; subsequent
 * explicit choices win. The class on <html> is set as early as possible
 * via an inline script in app.html to avoid a flash.
 */
import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'system';
const KEY = 'gusto.theme';

function readInitial(): Theme {
  if (!browser) return 'system';
  const raw = localStorage.getItem(KEY) as Theme | null;
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  return 'system';
}

export const theme = writable<Theme>(readInitial());

/** Reflect the current theme on the <html> element. */
export function applyTheme(t: Theme): void {
  if (!browser) return;
  const isDark =
    t === 'dark' ||
    (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}

export function setTheme(t: Theme): void {
  theme.set(t);
  if (browser) {
    localStorage.setItem(KEY, t);
    applyTheme(t);
  }
}

/** Cycle light → dark → system. Convenience for a single button toggle. */
export function cycleTheme(): void {
  const current = get(theme);
  const next: Theme = current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
  setTheme(next);
}

if (browser) {
  applyTheme(get(theme));
  // Track OS pref changes while in 'system' mode.
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (get(theme) === 'system') applyTheme('system');
    });
}
