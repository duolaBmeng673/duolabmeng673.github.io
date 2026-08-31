import type { KubeProfile } from './kube/profiles';
import { generateDisplacementTexture } from './kube/displacementTexture';
import { generateSpecularTexture } from './kube/specularTexture';

type GlassControl = 'bezel' | 'refraction' | 'thickness' | 'light-angle' | 'specular-opacity' | 'transparency' | 'blur' | 'saturation' | 'background-motion';
type GlassSettings = {
  profile: KubeProfile;
  bezel: number;
  refraction: number;
  thickness: number;
  lightAngle: number;
  specularOpacity: number;
  transparency: number;
  blur: number;
  saturation: number;
  backgroundMotion: boolean;
};

const STORAGE_KEY = 'duolabmeng673:liquid-glass:v3';
const LEGACY_KEY = 'duolabmeng673:liquid-glass:v2';
const defaults: GlassSettings = {
  profile: 'convex-squircle', bezel: 24, refraction: 86, thickness: 90,
  lightAngle: -150, specularOpacity: 24, transparency: 26, blur: 14,
  saturation: 112, backgroundMotion: false,
};
const limits: Record<Exclude<GlassControl, 'background-motion'>, readonly [number, number]> = {
  bezel: [6, 80], refraction: [0, 100], thickness: [10, 140], 'light-angle': [-180, 180],
  'specular-opacity': [0, 100], transparency: [0, 100], blur: [0, 100], saturation: [0, 200],
};
const clamp = (control: Exclude<GlassControl, 'background-motion'>, value: number) => {
  const [min, max] = limits[control];
  return Math.max(min, Math.min(max, value));
};

function readSettings(): GlassSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY) || '{}') as Record<string, unknown>;
    const number = (key: string, fallback: number) => Number.isFinite(Number(saved[key])) ? Number(saved[key]) : fallback;
    return {
      profile: ['convex-circle', 'convex-squircle', 'concave', 'lip'].includes(String(saved.profile)) ? saved.profile as KubeProfile : defaults.profile,
      bezel: clamp('bezel', number('bezel', defaults.bezel)),
      refraction: clamp('refraction', saved.refraction === undefined ? number('refraction-level', defaults.refraction / 100) * 100 : number('refraction', defaults.refraction)),
      thickness: clamp('thickness', number('thickness', defaults.thickness)),
      lightAngle: clamp('light-angle', number('lightAngle', defaults.lightAngle)),
      specularOpacity: clamp('specular-opacity', saved.specularOpacity === undefined ? number('specular-opacity', defaults.specularOpacity / 100) * 100 : number('specularOpacity', defaults.specularOpacity)),
      transparency: clamp('transparency', saved.transparency === undefined ? number('background-opacity', defaults.transparency / 100) * 100 : number('transparency', defaults.transparency)),
      blur: clamp('blur', saved.blur === undefined ? number('blur-level', defaults.blur / 5) * 5 : number('blur', defaults.blur)),
      saturation: clamp('saturation', saved.saturation === undefined ? number('specular-saturation', defaults.saturation / 100) * 100 : number('saturation', defaults.saturation)),
      backgroundMotion: saved.backgroundMotion === true,
    };
  } catch { return { ...defaults }; }
}

const displacement = document.querySelector<SVGFEImageElement>('#blog-liquid-displacement-map');
const liteDisplacement = document.querySelector<SVGFEImageElement>('#blog-liquid-lite-displacement-map');
const specular = document.querySelector<SVGFEImageElement>('#blog-liquid-specular-map');
const liteSpecular = document.querySelector<SVGFEImageElement>('#blog-liquid-specular-lite-map');
const fullBlur = document.querySelector<SVGFEGaussianBlurElement>('#blog-liquid-blur');
const liteBlur = document.querySelector<SVGFEGaussianBlurElement>('#blog-liquid-lite-blur');
const displacementPrimitive = document.querySelector<SVGFEDisplacementMapElement>('#blog-liquid-displacement');
const liteDisplacementPrimitive = document.querySelector<SVGFEDisplacementMapElement>('#blog-liquid-lite-displacement');
const specularOpacity = document.querySelector<SVGFEFuncAElement>('#blog-liquid-specular-opacity');
const controlInputs = Array.from(document.querySelectorAll<HTMLInputElement>('[data-glass-control]'));
const profileInputs = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-glass-profile]'));
const resetButton = document.querySelector<HTMLButtonElement>('#glass-reset');
const supportBadge = document.querySelector<HTMLElement>('[data-glass-support]');
let settings = readSettings();
let generationTimer = 0;
let generationFrame = 0;

const setHref = (node: SVGFEImageElement | null, value: string | null) => {
  if (!node || !value) return;
  node.setAttribute('href', value);
  node.setAttributeNS('http://www.w3.org/1999/xlink', 'href', value);
};
const formatValue = (control: GlassControl, value: number | boolean) => {
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  if (control === 'light-angle') return `${Math.round(value)}°`;
  if (control === 'bezel') return `${Math.round(value)} px`;
  return `${Math.round(value)}%`;
};
const controlKey = (control: GlassControl): keyof GlassSettings => control === 'light-angle' ? 'lightAngle' : control === 'background-motion' ? 'backgroundMotion' : control.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()) as keyof GlassSettings;

const syncControls = () => {
  controlInputs.forEach((input) => {
    const control = input.dataset.glassControl as GlassControl;
    const key = controlKey(control);
    if (input.type === 'checkbox') input.checked = Boolean(settings[key]);
    else input.value = String(settings[key]);
    const output = document.querySelector<HTMLOutputElement>(`#${input.id}-output`);
    if (output) output.textContent = formatValue(control, settings[key] as number | boolean);
  });
  profileInputs.forEach((button) => {
    const active = button.dataset.glassProfile === settings.profile;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
};

const applyCssSettings = () => {
  const root = document.documentElement;
  root.style.setProperty('--glass-panel-alpha', (0.055 + settings.transparency / 100 * 0.22).toFixed(3));
  root.style.setProperty('--glass-backdrop-blur', `${(settings.blur / 100 * 18).toFixed(1)}px`);
  root.style.setProperty('--glass-saturation', (settings.saturation / 100).toFixed(2));
  root.style.setProperty('--glass-highlight-opacity', (0.24 + settings.specularOpacity / 100 * 0.7).toFixed(2));
  root.toggleAttribute('data-background-motion', settings.backgroundMotion);
  const blur = settings.blur / 100 * 0.075;
  fullBlur?.setAttribute('stdDeviation', blur.toFixed(4));
  liteBlur?.setAttribute('stdDeviation', (blur * 0.55).toFixed(4));
  const scale = settings.refraction / 100 * 0.15 * (settings.thickness / 90);
  displacementPrimitive?.setAttribute('scale', scale.toFixed(4));
  liteDisplacementPrimitive?.setAttribute('scale', scale.toFixed(4));
  specularOpacity?.setAttribute('slope', (settings.specularOpacity / 100).toFixed(3));
  syncControls();
};

const generateTextures = () => {
  const options = { width: 256, height: 256, bezel: Math.max(2, settings.bezel), profile: settings.profile, thickness: settings.thickness / 100, borderRadius: 0.06 };
  const displacementTexture = generateDisplacementTexture(options);
  setHref(displacement, displacementTexture);
  setHref(liteDisplacement, displacementTexture);
  setHref(specular, generateSpecularTexture({ ...options, lightAngle: settings.lightAngle, shininess: 6 }));
  setHref(liteSpecular, generateSpecularTexture({ ...options, lightAngle: settings.lightAngle, shininess: 6, opacity: settings.specularOpacity / 100 }));
  document.documentElement.classList.add('liquid-glass-ready');
};
const scheduleTextures = () => {
  window.clearTimeout(generationTimer);
  window.cancelAnimationFrame(generationFrame);
  generationTimer = window.setTimeout(() => { generationFrame = window.requestAnimationFrame(generateTextures); }, 100);
};
const saveSettings = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* optional storage */ } };

const supportsKube = typeof CSS !== 'undefined' && Boolean(CSS.supports?.('backdrop-filter', 'url(#blog-liquid-glass)'));
document.documentElement.dataset.liquidGlassSupported = supportsKube ? 'true' : 'false';
if (supportBadge) supportBadge.textContent = supportsKube ? 'Chromium refraction' : 'Frosted fallback';
applyCssSettings();
generateTextures();

controlInputs.forEach((input) => input.addEventListener('input', () => {
  const control = input.dataset.glassControl as GlassControl;
  const key = controlKey(control);
  settings = { ...settings, [key]: input.type === 'checkbox' ? input.checked : Number(input.value) };
  applyCssSettings();
  saveSettings();
  if (!['transparency', 'blur', 'saturation', 'specular-opacity', 'refraction', 'background-motion'].includes(control)) scheduleTextures();
}));
profileInputs.forEach((button) => button.addEventListener('click', () => {
  const profile = button.dataset.glassProfile as KubeProfile;
  if (!profile) return;
  settings = { ...settings, profile };
  applyCssSettings();
  saveSettings();
  scheduleTextures();
}));
resetButton?.addEventListener('click', () => { settings = { ...defaults }; applyCssSettings(); saveSettings(); generateTextures(); });
window.addEventListener('storage', (event) => { if (event.key === STORAGE_KEY) { settings = readSettings(); applyCssSettings(); scheduleTextures(); } });
document.addEventListener('visibilitychange', () => document.documentElement.toggleAttribute('data-page-hidden', document.hidden));
