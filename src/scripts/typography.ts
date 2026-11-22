import { STORAGE_KEYS } from '../lib/storage-keys';

type FontSize = 'small' | 'medium' | 'large';
type ThemeMode = 'dark' | 'light' | 'system';
const scales = { small: '0.94', medium: '1', large: '1.12' };
const root = document.documentElement;
const sizes = document.querySelectorAll<HTMLButtonElement>('[data-font-size]');
const bold = document.querySelector<HTMLButtonElement>('[data-font-bold]');
const scrim = document.querySelector<HTMLButtonElement>('[data-svg-scrim]');
const panel = document.querySelector<HTMLDetailsElement>('.type-settings');
const summary = panel?.querySelector<HTMLElement>('summary');
const theme = document.querySelector<HTMLButtonElement>('[data-theme-cycle]');
const modes: ThemeMode[] = ['system', 'light', 'dark'];
const media = matchMedia('(prefers-color-scheme: dark)');
let settings: { size: FontSize; bold: boolean } = { size: 'medium', bold: false };
let svgScrim = false;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.typography) || '{}');
  if (saved.size in scales) settings.size = saved.size;
  settings.bold = saved.bold === true;
} catch { /* Preferences are optional. */ }
try {
  svgScrim = localStorage.getItem(STORAGE_KEYS.svgScrim) === 'true';
} catch { /* Preferences are optional. */ }
let mode = (root.dataset.themeMode ?? 'system') as ThemeMode;
const save = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch {} };
const syncPanelExpanded = () => {
  summary?.setAttribute('aria-expanded', String(Boolean(panel?.open)));
};
const applyTypography = () => {
  root.style.setProperty('--font-scale', scales[settings.size]);
  root.toggleAttribute('data-font-bold', settings.bold);
  sizes.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.fontSize === settings.size)));
  bold?.setAttribute('aria-checked', String(settings.bold));
  save(STORAGE_KEYS.typography, JSON.stringify(settings));
};
const applyScrim = () => {
  root.style.setProperty('--svg-scrim-opacity', svgScrim ? '0.8' : '0');
  scrim?.setAttribute('aria-checked', String(svgScrim));
  save(STORAGE_KEYS.svgScrim, String(svgScrim));
};
const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
const applyTheme = () => {
  const resolved = mode === 'system' ? (media.matches ? 'dark' : 'light') : mode;
  root.dataset.theme = resolved;
  root.dataset.themeMode = mode;
  if (themeMeta) themeMeta.content = resolved === 'dark' ? '#08070c' : '#f7f6f2';
};
sizes.forEach((button) => button.addEventListener('click', () => {
  settings.size = button.dataset.fontSize as FontSize;
  applyTypography();
}));
bold?.addEventListener('click', () => { settings.bold = !settings.bold; applyTypography(); });
scrim?.addEventListener('click', () => { svgScrim = !svgScrim; applyScrim(); });
panel?.addEventListener('toggle', syncPanelExpanded);
theme?.addEventListener('click', () => {
  mode = modes[(modes.indexOf(mode) + 1) % 3];
  applyTheme(); save(STORAGE_KEYS.theme, mode);
});
const shortcut = document.querySelector('[data-search-shortcut]');
if (shortcut && /Mac/.test(navigator.userAgent)) shortcut.textContent = 'Cmd K';
media.addEventListener('change', () => { if (mode === 'system') applyTheme(); });
document.addEventListener('click', (event) => {
  if (panel?.open && !panel.contains(event.target as Node)) {
    panel.open = false;
    syncPanelExpanded();
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && panel?.open) {
    panel.open = false;
    syncPanelExpanded();
    summary?.focus();
  }
});
syncPanelExpanded(); applyTypography(); applyScrim(); applyTheme();
