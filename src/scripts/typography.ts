type FontSize = 'small' | 'medium' | 'large';
type ThemeMode = 'dark' | 'light' | 'system';
const STORAGE_KEY = 'duolabmeng673:typography:v1';
const THEME_STORAGE_KEY = 'duolabmeng673:theme:v2';
const scales = { small: '0.94', medium: '1', large: '1.12' };
const root = document.documentElement;
const sizes = document.querySelectorAll<HTMLButtonElement>('[data-font-size]');
const bold = document.querySelector<HTMLInputElement>('[data-font-bold]');
const panel = document.querySelector<HTMLDetailsElement>('.type-settings');
const theme = document.querySelector<HTMLButtonElement>('[data-theme-cycle]');
const modes: ThemeMode[] = ['system', 'light', 'dark'];
const media = matchMedia('(prefers-color-scheme: dark)');
let settings: { size: FontSize; bold: boolean } = { size: 'medium', bold: false };
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
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
  save(STORAGE_KEY, JSON.stringify(settings));
};
const applyTheme = () => {
  root.dataset.theme = mode === 'system' ? (media.matches ? 'dark' : 'light') : mode;
  root.dataset.themeMode = mode;
};
sizes.forEach((button) => button.addEventListener('click', () => {
  settings.size = button.dataset.fontSize as FontSize;
  applyTypography();
}));
bold?.addEventListener('change', () => { settings.bold = bold.checked; applyTypography(); });
theme?.addEventListener('click', () => {
  mode = modes[(modes.indexOf(mode) + 1) % 3];
  applyTheme(); save(THEME_STORAGE_KEY, mode);
});
const shortcut = document.querySelector('[data-search-shortcut]');
if (shortcut && /Mac/.test(navigator.userAgent)) shortcut.textContent = 'Cmd K';
media.addEventListener('change', () => { if (mode === 'system') applyTheme(); });
document.addEventListener('click', (event) => { if (panel && !panel.contains(event.target as Node)) panel.open = false; });
applyTypography(); applyTheme();
