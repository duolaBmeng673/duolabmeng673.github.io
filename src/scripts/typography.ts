import { STORAGE_KEYS } from '../lib/storage-keys';

type FontSize = 'small' | 'medium' | 'large';
type ThemeMode = 'dark' | 'light' | 'system';
const scales = { small: '0.94', medium: '1', large: '1.12' };
const root = document.documentElement;
const sizes = document.querySelectorAll<HTMLButtonElement>('[data-font-size]');
const bold = document.querySelector<HTMLInputElement>('[data-font-bold]');
const tunerToggle = document.querySelector<HTMLInputElement>('[data-ambient-tuner-toggle]');
const panel = document.querySelector<HTMLDetailsElement>('.type-settings');
const theme = document.querySelector<HTMLButtonElement>('[data-theme-cycle]');
const modes: ThemeMode[] = ['system', 'light', 'dark'];
const media = matchMedia('(prefers-color-scheme: dark)');
let settings: { size: FontSize; bold: boolean } = { size: 'medium', bold: false };
let tunerEnabled = false;
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.typography) || '{}');
  if (saved.size in scales) settings.size = saved.size;
  settings.bold = saved.bold === true;
} catch { /* Preferences are optional. */ }
try {
  tunerEnabled = localStorage.getItem(STORAGE_KEYS.tuner) === 'true';
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
const applyTunerToggle = () => {
  root.dataset.ambientTuner = tunerEnabled ? 'on' : 'off';
  if (tunerToggle) tunerToggle.checked = tunerEnabled;
  save(STORAGE_KEYS.tuner, String(tunerEnabled));
  window.dispatchEvent(new CustomEvent('duolabmeng673:tuner-toggle', { detail: { enabled: tunerEnabled } }));
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
tunerToggle?.addEventListener('change', () => { tunerEnabled = tunerToggle.checked; applyTunerToggle(); });
theme?.addEventListener('click', () => {
  mode = modes[(modes.indexOf(mode) + 1) % 3];
  applyTheme(); save(STORAGE_KEYS.theme, mode);
});
const shortcut = document.querySelector('[data-search-shortcut]');
if (shortcut && /Mac/.test(navigator.userAgent)) shortcut.textContent = 'Cmd K';
media.addEventListener('change', () => { if (mode === 'system') applyTheme(); });
document.addEventListener('click', (event) => { if (panel && !panel.contains(event.target as Node)) panel.open = false; });
applyTypography(); applyTunerToggle(); applyTheme();
