import { STORAGE_KEYS } from '../lib/storage-keys';

type FontSize = 'small' | 'medium' | 'large';
type ThemeMode = 'dark' | 'light' | 'system';
type TocFoldMode = 'expanded' | 'collapsed';
const scales = { small: '0.94', medium: '1', large: '1.12' };
const root = document.documentElement;
const sizes = document.querySelectorAll<HTMLButtonElement>('[data-font-size]');
const bold = document.querySelector<HTMLButtonElement>('[data-font-bold]');
const scrim = document.querySelector<HTMLButtonElement>('[data-svg-scrim]');
const tocFolds = document.querySelectorAll<HTMLButtonElement>('[data-toc-fold]');
const panel = document.querySelector<HTMLDetailsElement>('.type-settings');
const summary = panel?.querySelector<HTMLElement>('summary');
const theme = document.querySelector<HTMLButtonElement>('[data-theme-cycle]');
const modes: ThemeMode[] = ['system', 'light', 'dark'];
const media = matchMedia('(prefers-color-scheme: dark)');
let settings: { size: FontSize; bold: boolean } = { size: 'medium', bold: false };
let svgScrim = false;
let tocFold: TocFoldMode = 'expanded';
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.typography) || '{}');
  if (saved.size in scales) settings.size = saved.size;
  settings.bold = saved.bold === true;
} catch { /* Preferences are optional. */ }
try {
  svgScrim = localStorage.getItem(STORAGE_KEYS.svgScrim) === 'true';
} catch { /* Preferences are optional. */ }
try {
  if (localStorage.getItem(STORAGE_KEYS.tocFold) === 'collapsed') tocFold = 'collapsed';
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
const applyTocFold = (notify = false) => {
  const collapsed = tocFold === 'collapsed';
  root.toggleAttribute('data-toc-collapsed', collapsed);
  tocFolds.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.tocFold === tocFold)));
  save(STORAGE_KEYS.tocFold, tocFold);
  if (notify && typeof CustomEvent === 'function' && typeof document.dispatchEvent === 'function') {
    document.dispatchEvent(new CustomEvent('duolabmeng673:toc-fold-change', { detail: { mode: tocFold } }));
  }
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
tocFolds.forEach((button) => button.addEventListener('click', () => {
  const next = button.dataset.tocFold;
  if (next !== 'expanded' && next !== 'collapsed') return;
  tocFold = next;
  applyTocFold(true);
}));
panel?.addEventListener('toggle', syncPanelExpanded);
theme?.addEventListener('click', () => {
  mode = modes[(modes.indexOf(mode) + 1) % 3];
  applyTheme(); save(STORAGE_KEYS.theme, mode);
});
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
syncPanelExpanded(); applyTypography(); applyScrim(); applyTocFold(false); applyTheme();
