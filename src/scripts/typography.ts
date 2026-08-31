type FontSize = 'small' | 'medium' | 'large';
type TypographySettings = { size: FontSize; bold: boolean };

const STORAGE_KEY = 'duolabmeng673:typography:v1';
const scales: Record<FontSize, string> = { small: '0.94', medium: '1', large: '1.12' };
const readSettings = (): TypographySettings => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<TypographySettings>;
    return {
      size: saved.size && saved.size in scales ? saved.size : 'medium',
      bold: saved.bold === true,
    };
  } catch {
    return { size: 'medium', bold: false };
  }
};

const settings = readSettings();
const root = document.documentElement;
const persist = () => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* storage is optional */ }
};
const apply = () => {
  root.style.setProperty('--font-scale', scales[settings.size]);
  root.dataset.fontSize = settings.size;
  root.toggleAttribute('data-font-bold', settings.bold);
  document.querySelectorAll<HTMLButtonElement>('[data-font-size]').forEach((button) => {
    const active = button.dataset.fontSize === settings.size;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll<HTMLInputElement>('[data-font-bold]').forEach((input) => { input.checked = settings.bold; });
};

document.querySelectorAll<HTMLButtonElement>('[data-font-size]').forEach((button) => {
  button.addEventListener('click', () => {
    const size = button.dataset.fontSize as FontSize;
    if (!(size in scales)) return;
    settings.size = size;
    apply();
    persist();
  });
});
document.querySelectorAll<HTMLInputElement>('[data-font-bold]').forEach((input) => {
  input.addEventListener('change', () => {
    settings.bold = input.checked;
    apply();
    persist();
  });
});
apply();
