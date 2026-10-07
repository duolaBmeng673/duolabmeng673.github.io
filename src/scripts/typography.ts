type FontSize = 'small' | 'medium' | 'large';
type ThemeMode = 'dark' | 'light' | 'system';
type TypographySettings = { size: FontSize; bold: boolean };
const STORAGE_KEY = 'duolabmeng673:typography:v1';
const THEME_STORAGE_KEY = 'duolabmeng673:theme:v2';
const scales: Record<FontSize, string> = { small: '0.94', medium: '1', large: '1.12' };
const root = document.documentElement;
const readSettings = (): TypographySettings => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<TypographySettings>;
    return { size: saved.size && saved.size in scales ? saved.size : 'medium', bold: saved.bold === true };
  } catch { return { size: 'medium', bold: false }; }
};
const settings = readSettings();
let mode = (root.dataset.themeMode ?? 'system') as ThemeMode;
const media = matchMedia('(prefers-color-scheme: dark)');
const applyTypography = () => {
  root.style.setProperty('--font-scale', scales[settings.size]);
  root.toggleAttribute('data-font-bold', settings.bold);
  document.querySelectorAll<HTMLButtonElement>('[data-font-size]').forEach((button) => {
    const active = button.dataset.fontSize === settings.size;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll<HTMLInputElement>('[data-font-bold]').forEach((input) => { input.checked = settings.bold; });
};
const applyTheme = () => {
  root.dataset.theme = mode === 'system' ? (media.matches ? 'dark' : 'light') : mode;
  root.dataset.themeMode = mode;
  document.querySelectorAll<HTMLSelectElement>('[data-theme-select]').forEach((select) => { select.value = mode; });
};
const persistTypography = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* optional storage */ } };
document.querySelectorAll<HTMLButtonElement>('[data-font-size]').forEach((button) => button.addEventListener('click', () => {
  const size = button.dataset.fontSize as FontSize;
  if (!(size in scales)) return;
  settings.size = size; applyTypography(); persistTypography();
}));
document.querySelectorAll<HTMLInputElement>('[data-font-bold]').forEach((input) => input.addEventListener('change', () => {
  settings.bold = input.checked; applyTypography(); persistTypography();
}));
document.querySelectorAll<HTMLSelectElement>('[data-theme-select]').forEach((select) => select.addEventListener('change', () => {
  if (!['light', 'dark', 'system'].includes(select.value)) return;
  mode = select.value as ThemeMode; applyTheme();
  try { localStorage.setItem(THEME_STORAGE_KEY, mode); } catch { /* optional storage */ }
}));
media.addEventListener('change', () => { if (mode === 'system') applyTheme(); });
document.addEventListener('click', (event) => {
  document.querySelectorAll<HTMLDetailsElement>('.type-settings[open]').forEach((details) => {
    if (event.target instanceof Node && !details.contains(event.target)) details.open = false;
  });
});
applyTypography(); applyTheme();
