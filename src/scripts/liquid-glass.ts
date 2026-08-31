import type { KubeProfile } from './kube/profiles';
import { generateDisplacementTexture } from './kube/displacementTexture';
import { generateSpecularTexture } from './kube/specularTexture';

const FONT_SIZE_KEY = 'duolabmeng673:typography:v1';
const defaultTypography = { size: 'medium', bold: false } as const;
type FontSize = keyof typeof fontScales;
const fontScales = { small: '0.94', medium: '1', large: '1.12' } as const;

function readTypography() {
  try {
    const value = JSON.parse(localStorage.getItem(FONT_SIZE_KEY) || '{}') as Partial<{ size: FontSize; bold: boolean }>;
    return { size: value.size && value.size in fontScales ? value.size : defaultTypography.size, bold: value.bold === true };
  } catch {
    return { ...defaultTypography };
  }
}

const typography = readTypography();
const root = document.documentElement;
const saveTypography = () => {
  try { localStorage.setItem(FONT_SIZE_KEY, JSON.stringify(typography)); } catch { /* optional storage */ }
};

const applyTypography = () => {
  root.dataset.fontSize = typography.size;
  root.toggleAttribute('data-font-bold', typography.bold);
  root.style.setProperty('--font-scale', fontScales[typography.size]);
  document.querySelectorAll<HTMLButtonElement>('[data-font-size]').forEach((button) => {
    const active = button.dataset.fontSize === typography.size;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll<HTMLInputElement>('[data-font-bold]').forEach((input) => { input.checked = typography.bold; });
};

document.querySelectorAll<HTMLButtonElement>('[data-font-size]').forEach((button) => {
  button.addEventListener('click', () => {
    const size = button.dataset.fontSize as FontSize;
    if (!(size in fontScales)) return;
    typography.size = size;
    applyTypography();
    saveTypography();
  });
});
document.querySelectorAll<HTMLInputElement>('[data-font-bold]').forEach((input) => {
  input.addEventListener('change', () => {
    typography.bold = input.checked;
    applyTypography();
    saveTypography();
  });
});
applyTypography();

const displacement = document.querySelector<SVGFEImageElement>('#blog-liquid-displacement-map');
const liteDisplacement = document.querySelector<SVGFEImageElement>('#blog-liquid-lite-displacement-map');
const specular = document.querySelector<SVGFEImageElement>('#blog-liquid-specular-map');
const liteSpecular = document.querySelector<SVGFEImageElement>('#blog-liquid-specular-lite-map');
const supportsKube = typeof CSS !== 'undefined' && Boolean(CSS.supports?.('backdrop-filter', 'url(#blog-liquid-glass)'));
root.dataset.liquidGlassSupported = supportsKube ? 'true' : 'false';

const setHref = (node: SVGFEImageElement | null, value: string | null) => {
  if (!node || !value) return;
  node.setAttribute('href', value);
  node.setAttributeNS('http://www.w3.org/1999/xlink', 'href', value);
};

const generateTextures = () => {
  const options = { width: 192, height: 192, bezel: 24, profile: 'convex-squircle' as KubeProfile, thickness: 0.9, borderRadius: 0.06 };
  const map = generateDisplacementTexture(options);
  setHref(displacement, map);
  setHref(liteDisplacement, map);
  setHref(specular, generateSpecularTexture({ ...options, lightAngle: -150, shininess: 6 }));
  setHref(liteSpecular, generateSpecularTexture({ ...options, lightAngle: -150, shininess: 6, opacity: 0.24 }));
  root.classList.add('liquid-glass-ready');
};

if (supportsKube && document.querySelector('.site-header, .post-card, .post-row, .detail-panel')) {
  const schedule = window.requestIdleCallback?.bind(window);
  if (schedule) schedule(generateTextures, { timeout: 700 });
  else window.setTimeout(generateTextures, 120);
}
