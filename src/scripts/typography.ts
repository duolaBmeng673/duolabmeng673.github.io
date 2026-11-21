import { STORAGE_KEYS } from '../lib/storage-keys';

type FontSize = 'small' | 'medium' | 'large';
type ThemeMode = 'dark' | 'light' | 'system';
type BgStyle = 'crosshair' | 'mesh';
const scales = { small: '0.94', medium: '1', large: '1.12' };
const root = document.documentElement;
const sizes = document.querySelectorAll<HTMLButtonElement>('[data-font-size]');
const bgStyles = document.querySelectorAll<HTMLButtonElement>('[data-bg-style]');
const bold = document.querySelector<HTMLInputElement>('[data-font-bold]');
const panel = document.querySelector<HTMLDetailsElement>('.type-settings');
const theme = document.querySelector<HTMLButtonElement>('[data-theme-cycle]');
const modes: ThemeMode[] = ['system', 'light', 'dark'];
const media = matchMedia('(prefers-color-scheme: dark)');
let settings: { size: FontSize; bold: boolean } = { size: 'medium', bold: false };
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.typography) || '{}');
  if (saved.size in scales) settings.size = saved.size;
  settings.bold = saved.bold === true;
} catch { /* Preferences are optional. */ }
let mode = (root.dataset.themeMode ?? 'system') as ThemeMode;
const save = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch {} };
const applyTypography = () => {
  root.style.setProperty('--font-scale', scales[settings.size]);
  root.toggleAttribute('data-font-bold', settings.bold);
  sizes.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.fontSize === settings.size)));
  if (bold) bold.checked = settings.bold;
  save(STORAGE_KEYS.typography, JSON.stringify(settings));
};
const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
const applyTheme = () => {
  const resolved = mode === 'system' ? (media.matches ? 'dark' : 'light') : mode;
  root.dataset.theme = resolved;
  root.dataset.themeMode = mode;
  if (themeMeta) themeMeta.content = resolved === 'dark' ? '#050505' : '#f7f6f2';
};
sizes.forEach((button) => button.addEventListener('click', () => {
  settings.size = button.dataset.fontSize as FontSize;
  applyTypography();
}));
bold?.addEventListener('change', () => { settings.bold = bold.checked; applyTypography(); });
theme?.addEventListener('click', () => {
  mode = modes[(modes.indexOf(mode) + 1) % 3];
  applyTheme(); save(STORAGE_KEYS.theme, mode);
});
const shortcut = document.querySelector('[data-search-shortcut]');
if (shortcut && /Mac/.test(navigator.userAgent)) shortcut.textContent = 'Cmd K';
media.addEventListener('change', () => { if (mode === 'system') applyTheme(); });
document.addEventListener('click', (event) => { if (panel && !panel.contains(event.target as Node)) panel.open = false; });

let bgStyle: BgStyle = root.dataset.bgStyle === 'mesh' ? 'mesh' : 'crosshair';
try {
  const savedBg = localStorage.getItem(STORAGE_KEYS.bgStyle);
  if (savedBg === 'crosshair' || savedBg === 'mesh') bgStyle = savedBg;
} catch { /* Preferences are optional. */ }
const applyBgStyle = (persist: boolean) => {
  root.dataset.bgStyle = bgStyle;
  bgStyles.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.bgStyle === bgStyle)));
  if (persist) save(STORAGE_KEYS.bgStyle, bgStyle);
  window.dispatchEvent(new CustomEvent('duolabmeng673:bg-style-change', { detail: { style: bgStyle } }));
};
bgStyles.forEach((button) => button.addEventListener('click', () => {
  const next = button.dataset.bgStyle;
  if (next === 'crosshair' || next === 'mesh') {
    bgStyle = next;
    applyBgStyle(true);
  }
}));

applyTypography(); applyTheme(); applyBgStyle(false);
