/**
 * Light/dark theme. An explicit choice is stored in localStorage and applied as
 * `data-theme` on <html>; with no choice the OS/browser color scheme applies.
 */
export type Theme = 'light' | 'dark';

export const THEME_KEY = 'lw-theme';

/** Runs before first paint (inlined in the root layout) so a saved choice never flashes the wrong theme. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

const listeners = new Set<() => void>();
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export function getTheme(): Theme {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return media().matches ? 'dark' : 'light';
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage blocked: the choice still applies until the page is closed.
  }
  listeners.forEach((fn) => fn());
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

/** Fires whenever the effective theme may have changed (toggle, other tab, or OS setting). */
export function subscribeTheme(fn: () => void): () => void {
  listeners.add(fn);
  const mq = media();
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_KEY) return;
    if (e.newValue === 'light' || e.newValue === 'dark') document.documentElement.dataset.theme = e.newValue;
    else delete document.documentElement.dataset.theme;
    fn();
  };
  mq.addEventListener('change', fn);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    mq.removeEventListener('change', fn);
    window.removeEventListener('storage', onStorage);
  };
}
