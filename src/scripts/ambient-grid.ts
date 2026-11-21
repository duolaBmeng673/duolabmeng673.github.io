/**
 * High-resolution continuous unified-grid four-state backdrop & article-page breathing tile grid.
 * - Presets (`data-preset`): all (soft-purple micro-pixels), research (indigo halftone dots),
 *   cs (rose binary 0/1), 837 (ember solid knockout 0/1 blocks).
 * - Continuous void-free field: isotropic per-cell 2D Simplex noise (18-cell rolling swells) modulates
 *   luminance, saturation tiers, and halftone dot size continuously without cutting holes or blank voids.
 * - Multi-zone theme coloring: pre-bakes 4 HiDPI saturation/luminance tiers of each preset's CSS theme
 *   color (`--ch-*-rgb`) at up to 2x DPR so blue halftone dots & ember/rose 0/1 glyphs stay razor-sharp.
 * - Zero mouse-follow hover glow: waves appear ONLY on mouse click (`pointerdown`) and preset switch.
 * - Gates non-home mobile motion via `(hover: none), (pointer: coarse)` and keeps desktop `pointerdown`.
 */

import {
  WAVE_DITHER,
  WAVE_LEAD,
  WAVE_WAKE,
  clamp,
  computeWaveDuration,
  computeWaveRadius,
  smoothstep,
} from '../lib/wave-timing';
import type { PresetSlug } from '../lib/palette';
import {
  loadTuneConfig,
  mountAmbientTuner,
  type AmbientTuneConfig,
} from './ambient-tuner';

const PRESETS: readonly PresetSlug[] = ['all', 'research', 'cs', '837'];
const PRESET_TO_IDX: Record<PresetSlug, number> = { all: 0, research: 1, cs: 2, '837': 3 };
const normalizePreset = (raw?: string | null): PresetSlug =>
  raw && raw in PRESET_TO_IDX ? (raw as PresetSlug) : 'all';

let CELL = 14; // User-tuned crisp dot-matrix pitch
let HALF_CELL = CELL * 0.5;
const DEFAULT_PULSE = { maxR: 280, duration: 2050 };

// Isotropic Simplex field in cell units (user-tuned 30-cell swells)
const FIELD_PERIOD = 30;
const ROT_COS = Math.cos(0.9);
const ROT_SIN = Math.sin(0.9);

type RgbTriplet = [number, number, number];

const hash2 = (ix: number, iy: number): number => {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};

// Deterministic 2D Simplex Noise (triangular lattice -> zero axis-aligned vertical/horizontal cuts)
const SIMPLEX_GRAD_X = new Float32Array([1, -1, 1, -1, 1, -1, 0, 0]);
const SIMPLEX_GRAD_Y = new Float32Array([1, 1, -1, -1, 0, 0, 1, -1]);
const SIMPLEX_PERM = new Uint8Array(512);
(() => {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) p[i] = i;
  let seed = 1337;
  for (let i = 255; i > 0; i -= 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }
  for (let i = 0; i < 256; i += 1) {
    SIMPLEX_PERM[i] = p[i];
    SIMPLEX_PERM[i + 256] = p[i];
  }
})();

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

const simplex2 = (xin: number, yin: number): number => {
  const s = (xin + yin) * F2;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const t = (i + j) * G2;
  const x0 = xin - (i - t);
  const y0 = yin - (j - t);
  const i1 = x0 > y0 ? 1 : 0;
  const j1 = 1 - i1;
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;
  const ii = i & 255;
  const jj = j & 255;

  let n0 = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) {
    const gi0 = SIMPLEX_PERM[ii + SIMPLEX_PERM[jj]] & 7;
    t0 *= t0;
    n0 = t0 * t0 * (SIMPLEX_GRAD_X[gi0] * x0 + SIMPLEX_GRAD_Y[gi0] * y0);
  }

  let n1 = 0;
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) {
    const gi1 = SIMPLEX_PERM[ii + i1 + SIMPLEX_PERM[jj + j1]] & 7;
    t1 *= t1;
    n1 = t1 * t1 * (SIMPLEX_GRAD_X[gi1] * x1 + SIMPLEX_GRAD_Y[gi1] * y1);
  }

  let n2 = 0;
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) {
    const gi2 = SIMPLEX_PERM[ii + 1 + SIMPLEX_PERM[jj + 1]] & 7;
    t2 *= t2;
    n2 = t2 * t2 * (SIMPLEX_GRAD_X[gi2] * x2 + SIMPLEX_GRAD_Y[gi2] * y2);
  }

  return 70 * (n0 + n1 + n2);
};

const valueNoise = (x: number, y: number): number => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
};

const makeCanvas = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
};

const parseCssRgb = (raw: string, fallback: RgbTriplet): RgbTriplet => {
  const parts = raw
    .trim()
    .split(/[\s,]+/)
    .slice(0, 3)
    .map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    return [parts[0], parts[1], parts[2]];
  }
  return fallback;
};

const rgbToHsl = ([r, g, b]: RgbTriplet): [number, number, number] => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const mx = Math.max(rn, gn, bn);
  const mn = Math.min(rn, gn, bn);
  const d = mx - mn;
  const l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    if (mx === rn) h = ((gn - bn) / d) % 6;
    else if (mx === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, s, l];
};

const hslToRgbCss = (h: number, s: number, l: number): string => {
  const sc = clamp(s, 0, 1);
  const lc = clamp(l, 0.06, 0.94);
  const k = (n: number) => (n + h / 30) % 12;
  const a = sc * Math.min(lc, 1 - lc);
  const f = (n: number) => lc - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `rgb(${Math.round(f(0) * 255)} ${Math.round(f(8) * 255)} ${Math.round(f(4) * 255)})`;
};

/**
 * Derive 4 tonal tiers (0: deep muted -> 1: balanced -> 2: rich saturated -> 3: bright highlight)
 * from the active preset's theme color so different regions vary organically in saturation & brightness.
 */
const buildThemeTiers = (
  rgb: RgbTriplet,
  isDark: boolean,
  cfg: AmbientTuneConfig,
): [string, string, string, string] => {
  const [h, s, l] = rgbToHsl(rgb);
  if (isDark) {
    const s0 = cfg.darkLowSat;
    const s3 = cfg.darkHighSat;
    const l0 = cfg.darkLowLit;
    const l3 = cfg.darkHighLit;
    return [
      hslToRgbCss(h, s * s0, clamp(l * l0, 0.2, 0.72)),
      hslToRgbCss(h, s * (s0 + (s3 - s0) * 0.36), clamp(l * (l0 + (l3 - l0) * 0.36), 0.28, 0.78)),
      hslToRgbCss(h, Math.min(1, s * (s0 + (s3 - s0) * 0.75)), clamp(l * (l0 + (l3 - l0) * 0.72), 0.36, 0.86)),
      hslToRgbCss(h, Math.min(1, s * s3), clamp(l * l3, 0.44, 0.92)),
    ];
  }
  return [
    hslToRgbCss(h, s * 0.4, clamp(l * 1.15, 0.46, 0.68)),
    hslToRgbCss(h, s * 0.78, clamp(l * 0.98, 0.36, 0.56)),
    hslToRgbCss(h, Math.min(1, s * 1.1), clamp(l * 0.86, 0.3, 0.48)),
    hslToRgbCss(h, Math.min(1, s * 1.18), clamp(l * 0.76, 0.24, 0.42)),
  ];
};

const readChannelRgbs = (isDark: boolean): Record<PresetSlug, RgbTriplet> => {
  const cs = getComputedStyle(document.documentElement);
  return {
    all: parseCssRgb(cs.getPropertyValue('--ch-all-rgb'), isDark ? [156, 136, 216] : [124, 104, 184]),
    research: parseCssRgb(cs.getPropertyValue('--ch-research-rgb'), isDark ? [122, 162, 255] : [59, 95, 208]),
    cs: parseCssRgb(cs.getPropertyValue('--ch-cs-rgb'), isDark ? [242, 107, 148] : [194, 65, 107]),
    '837': parseCssRgb(cs.getPropertyValue('--ch-837-rgb'), isDark ? [240, 128, 80] : [194, 65, 12]),
  };
};

interface SpriteAtlas {
  allSolid: HTMLCanvasElement[]; // 4 tonal tiers
  resDots: HTMLCanvasElement[][]; // [tier 0..3][radius 0..7]
  csGlyphs: [HTMLCanvasElement, HTMLCanvasElement][]; // [tier 0..3][bit 0|1]
  e837Blocks: [HTMLCanvasElement, HTMLCanvasElement][]; // [tier 0..3][bit 0|1]
}

const buildSpriteAtlas = (isDark: boolean, dpr: number, cfg: AmbientTuneConfig): SpriteAtlas => {
  const rgbs = readChannelRgbs(isDark);
  const allTiers = buildThemeTiers(rgbs.all, isDark, cfg);
  const resTiers = buildThemeTiers(rgbs.research, isDark, cfg);
  const csTiers = buildThemeTiers(rgbs.cs, isDark, cfg);
  const e837Tiers = buildThemeTiers(rgbs['837'], isDark, cfg);
  const pxSize = Math.max(1, Math.round(CELL * dpr));
  const minR = Math.min(cfg.dotMinR, cfg.dotMaxR);
  const maxR = Math.max(cfg.dotMinR, cfg.dotMaxR);
  const radii = Array.from({ length: 8 }, (_, idx) => {
    if (idx === 0) return Math.max(0.4, minR * 0.65);
    return minR + ((idx - 1) / 6) * (maxR - minR);
  });

  const bake = (draw: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement => {
    const c = makeCanvas(pxSize, pxSize);
    const g = c.getContext('2d');
    if (g) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(g);
    }
    return c;
  };

  const rectSprite = (color: string, inset = 1) =>
    bake((g) => {
      g.fillStyle = color;
      g.fillRect(inset, inset, Math.max(1, CELL - inset * 2), Math.max(1, CELL - inset * 2));
    });

  const dotSprite = (color: string, r: number) =>
    bake((g) => {
      g.beginPath();
      g.arc(HALF_CELL, HALF_CELL, Math.min(r, HALF_CELL - 0.5), 0, Math.PI * 2);
      g.fillStyle = color;
      g.fill();
    });

  const glyphSprite = (bit: '0' | '1', color: string) =>
    bake((g) => {
      g.fillStyle = color;
      g.font = `600 ${cfg.glyphFontSize}px ui-monospace, Menlo, Consolas, monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(bit, HALF_CELL, HALF_CELL + 0.5);
    });

  const blockSolidSprite = (bit: '0' | '1', color: string) =>
    bake((g) => {
      g.fillStyle = color;
      g.fillRect(1, 1, Math.max(1, CELL - 2), Math.max(1, CELL - 2));
      g.globalCompositeOperation = 'destination-out';
      g.font = `700 ${cfg.blockFontSize}px ui-monospace, Menlo, Consolas, monospace`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(bit, HALF_CELL, HALF_CELL + 0.5);
      g.globalCompositeOperation = 'source-over';
    });

  return {
    allSolid: allTiers.map((c) => rectSprite(c, 1)),
    resDots: resTiers.map((c) => radii.map((r) => dotSprite(c, r))),
    csGlyphs: csTiers.map((c) => [glyphSprite('0', c), glyphSprite('1', c)]),
    e837Blocks: e837Tiers.map((c) => [blockSolidSprite('0', c), blockSolidSprite('1', c)]),
  };
};

interface ClusterPatch {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  age: number;
  life: number;
}

interface ImpactPulse {
  x: number;
  y: number;
  start: number;
  duration: number;
  maxR: number;
}

interface WaveTransition {
  x: number;
  y: number;
  start: number;
  duration: number;
  maxReach: number;
  toPreset: PresetSlug;
  seed: number;
}

const evalWaveEffDist = (
  ox: number,
  oy: number,
  seed: number,
  gx: number,
  gy: number,
  cx: number,
  cy: number,
): number => {
  const dx = cx - ox;
  const dy = cy - oy;
  const dist = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const warp =
    Math.sin(angle * 3 + seed) * 44 +
    Math.cos(angle * 5 - seed * 1.3) * 26 +
    (valueNoise(gx * 0.11 + seed, gy * 0.11) - 0.5) * 72;
  return dist + warp;
};

const initHeroBackdrop = () => {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-ambient-grid]');
  if (!canvas || canvas.dataset.initialized === '1') return;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;
  canvas.dataset.initialized = '1';

  const homeRoot = document.querySelector<HTMLElement>('[data-home-root]');
  const isHome = Boolean(homeRoot) || document.body.classList.contains('home-page');
  const motionMedia = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const pointerMedia = window.matchMedia?.('(hover: hover) and (pointer: fine)');
  const coarseOrNoHoverMedia = window.matchMedia?.('(hover: none), (pointer: coarse)');

  let systemReduceMotion = motionMedia?.matches ?? false;
  let userPaused = homeRoot?.dataset.motion === 'paused';
  let hasFinePointer = pointerMedia?.matches ?? true;
  let isCoarseOrNoHover = coarseOrNoHoverMedia?.matches ?? false;
  let reduceMotion = systemReduceMotion || userPaused || (!isHome && isCoarseOrNoHover);

  const syncReduceMotion = () => {
    reduceMotion = systemReduceMotion || userPaused || (!isHome && isCoarseOrNoHover);
  };

  const cfg = loadTuneConfig();
  CELL = Math.max(8, Math.round(cfg.cellSize));
  HALF_CELL = CELL * 0.5;

  let isDark = document.documentElement.dataset.theme === 'dark';
  let activePreset = normalizePreset(document.documentElement.dataset.preset);
  let dpr = Math.min(window.devicePixelRatio || 1, cfg.dprCap);
  let width = 0;
  let height = 0;
  let cols = 0;
  let rows = 0;
  let inView = true;
  let rafId = 0;
  let lastTick = performance.now();
  let lastDraw = 0;
  let driftTime = 0;

  let atlas = buildSpriteAtlas(isDark, dpr, cfg);
  let committedPreset = new Uint8Array(0);
  // Precomputed per-cell LUTs (eliminates hash2 calls from hot render loop)
  let cellBit = new Uint8Array(0);
  let cellFlip = new Float32Array(0);
  let cellRand = new Float32Array(0);

  const applyBackdropStyle = () => {
    const host = canvas.parentElement;
    if (!host || document.body.classList.contains('article-page')) return;
    const hVh = clamp(cfg.backdropHeightVh, 40, 100);
    const fadeStart = clamp(cfg.fadeStartPct, 30, 95);
    const fadeMid = Math.min(99, Math.round(fadeStart + (100 - fadeStart) * 0.5));
    host.style.height = `${hVh}vh`;
    const mask =
      hVh >= 100 && fadeStart >= 95
        ? 'none'
        : `linear-gradient(180deg, #000 0%, #000 ${fadeStart}%, rgba(0, 0, 0, 0.42) ${fadeMid}%, transparent 100%)`;
    host.style.maskImage = mask;
    host.style.setProperty('-webkit-mask-image', mask);
  };

  const pulses: ImpactPulse[] = [];
  let wave: WaveTransition | null = null;
  let waveCounter = 1;

  const PATCH_COUNT = 4;
  const patches: ClusterPatch[] = [];
  const patchRadiiSq = new Float32Array(PATCH_COUNT);
  const patchFade = new Float32Array(PATCH_COUNT);

  const spawnPatch = (initial = false): ClusterPatch => {
    const life = 4.8 + Math.random() * 3.4;
    return {
      x: Math.random() * Math.max(12, cols),
      y: Math.random() * Math.max(10, rows),
      vx: (Math.random() - 0.5) * 1.1,
      vy: (Math.random() - 0.5) * 0.85,
      radius: 4.5 + Math.random() * 3.2,
      age: initial ? Math.random() * life : 0,
      life,
    };
  };

  const resetCommitted = (preset: PresetSlug) => {
    committedPreset.fill(PRESET_TO_IDX[preset]);
  };

  const resize = () => {
    CELL = Math.max(8, Math.round(cfg.cellSize));
    HALF_CELL = CELL * 0.5;
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, cfg.dprCap);
    // HiDPI up to cfg.dprCap on upper-region bounded canvas keeps blue circles & ember/rose 0/1 razor-sharp
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(width / CELL) + 1;
    rows = Math.ceil(height / CELL) + 1;

    const len = cols * rows;
    committedPreset = new Uint8Array(len);
    cellBit = new Uint8Array(len);
    cellFlip = new Float32Array(len);
    cellRand = new Float32Array(len);
    const ditherSpan = cfg.waveDither || WAVE_DITHER;
    for (let gy = 0; gy < rows; gy += 1) {
      const rowOff = gy * cols;
      for (let gx = 0; gx < cols; gx += 1) {
        const idx = rowOff + gx;
        cellBit[idx] = hash2(gx * 5 + 23, gy * 7 + 13) > 0.5 ? 1 : 0;
        cellFlip[idx] = hash2(gx * 13 + 7, gy * 17 + 3) * ditherSpan;
        cellRand[idx] = hash2(gx + 97, gy + 53);
      }
    }

    resetCommitted(activePreset);
    pulses.length = 0;
    wave = null;
    atlas = buildSpriteAtlas(isDark, dpr, cfg);
    if (patches.length === 0) {
      for (let i = 0; i < PATCH_COUNT; i += 1) patches.push(spawnPatch(true));
    }
  };

  const getHeaderExclusion = (canvasRect?: DOMRect) => {
    const header = document.querySelector<HTMLElement>('.site-header');
    if (!header) return null;
    const hr = header.getBoundingClientRect();
    const cr = canvasRect ?? canvas.getBoundingClientRect();
    const left = hr.left - cr.left;
    const top = hr.top - cr.top;
    if (hr.width <= 0 || hr.height <= 0 || top > cr.height || top + hr.height < 0) return null;
    return {
      left: Math.max(0, left),
      top: Math.max(0, top - 12),
      right: Math.min(cr.width, left + hr.width),
      bottom: Math.min(cr.height, top + hr.height),
    };
  };

  const renderFrame = (now: number) => {
    const dt = Math.min((now - lastTick) / 1000, 0.08);
    lastTick = now;

    if (!reduceMotion) {
      driftTime += dt * cfg.driftSpeed;
      for (let i = 0; i < patches.length; i += 1) {
        const pt = patches[i];
        pt.age += dt * cfg.driftSpeed;
        pt.x += pt.vx * dt * cfg.driftSpeed;
        pt.y += pt.vy * dt * cfg.driftSpeed;
        if (pt.x < -pt.radius) pt.x = cols + pt.radius;
        else if (pt.x > cols + pt.radius) pt.x = -pt.radius;
        if (pt.y < -pt.radius) pt.y = rows + pt.radius;
        else if (pt.y > rows + pt.radius) pt.y = -pt.radius;
        if (pt.age >= pt.life) patches[i] = spawnPatch(false);
      }

      for (let i = pulses.length - 1; i >= 0; i -= 1) {
        if (now - pulses[i].start >= pulses[i].duration) {
          pulses.splice(i, 1);
        }
      }
    }

    let waveR = 0;
    let activeWave = wave;
    const wLead = cfg.waveLead || WAVE_LEAD;
    const wDither = cfg.waveDither || WAVE_DITHER;
    const wWake = cfg.waveWake || WAVE_WAKE;
    if (activeWave) {
      const elapsed = now - activeWave.start;
      const u = clamp(elapsed / activeWave.duration, 0, 1);
      const progress = 0.88 * u + 0.12 * smoothstep(u);
      waveR = progress * (activeWave.maxReach + wLead + wDither + wWake);
      if (elapsed >= activeWave.duration) {
        wave = null;
        activeWave = null;
        resetCommitted(activePreset);
      }
    }

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < patches.length; i += 1) {
      const p = patches[i];
      patchRadiiSq[i] = p.radius * p.radius;
      patchFade[i] = Math.sin(Math.PI * clamp(p.age / p.life, 0, 1));
    }

    const hasPulses = !reduceMotion && pulses.length > 0;
    const FEATHER = Math.max(8, cfg.clickFeather);
    let pulseRadii: number[] | null = null;
    let pulseFades: number[] | null = null;
    if (hasPulses) {
      pulseRadii = new Array(pulses.length);
      pulseFades = new Array(pulses.length);
      for (let k = 0; k < pulses.length; k += 1) {
        const p = pulses[k];
        const u = clamp((now - p.start) / p.duration, 0, 1);
        const pr = p.maxR * (1 - Math.pow(1 - u, 2.35));
        const fadeStartR = p.maxR * clamp(cfg.clickFadeStart, 0.1, 0.9);
        const horizonFade =
          pr > fadeStartR
            ? Math.pow(clamp(1 - (pr - fadeStartR) / Math.max(1, p.maxR - fadeStartR), 0, 1), 1.55)
            : 1;
        pulseRadii[k] = pr;
        pulseFades[k] = horizonFade * Math.pow(clamp(1 - u, 0, 1), 1.25);
      }
    }

    const minA = isDark ? cfg.darkMinAlpha : cfg.lightMinAlpha;
    const maxA = Math.max(minA, isDark ? cfg.darkMaxAlpha : cfg.lightMaxAlpha);
    const boostCap = isDark ? cfg.darkBoostCap : cfg.lightBoostCap;
    const fieldPeriod = Math.max(4, cfg.fieldPeriod || FIELD_PERIOD);
    const fieldInv = 1 / fieldPeriod;
    const fieldInv2 = 1 / (fieldPeriod * 0.58);
    const toneInv = 1 / Math.max(5, cfg.tonePeriod);
    const hasVoid = cfg.voidRatio > 0.005;
    const voidHi = -0.82 + cfg.voidRatio * 2.1 + cfg.voidSoftness * 0.45;
    const voidLo = voidHi - Math.max(0.15, cfg.voidSoftness * 0.9);
    const voidSpan = Math.max(0.1, voidHi - voidLo);
    const patchMult = cfg.patchStrength;
    const tDx = driftTime * 0.045;
    const tDy = driftTime * 0.032;
    const t2x = driftTime * 0.026;
    const t2y = driftTime * 0.038;
    const rDx = driftTime * 0.032;
    const rDy = driftTime * 0.022;

    for (let gy = 0; gy < rows; gy += 1) {
      const baseY = gy * CELL;
      const cy = baseY + HALF_CELL;
      const rowOff = gy * cols;
      const gyInv1 = gy * fieldInv - tDy;
      const gyTone = gy * toneInv + rDy + 17.2;

      for (let gx = 0; gx < cols; gx += 1) {
        const idx = rowOff + gx;
        const baseX = gx * CELL;
        const cx = baseX + HALF_CELL;

        // Per-cell isotropic 2D Simplex modulation (continuous void-free field when voidRatio === 0)
        const n1 = simplex2(gx * fieldInv + tDx, gyInv1);
        const rx = gx * ROT_COS - gy * ROT_SIN;
        const ry = gx * ROT_SIN + gy * ROT_COS;
        const n2 = simplex2(rx * fieldInv2 - t2x + 19.3, ry * fieldInv2 + t2y - 7.1);
        const raw = n1 * 0.82 + n2 * 0.18;
        const density = smoothstep((raw + 0.72) / 1.44);

        let cellPreset = activeWave ? PRESETS[committedPreset[idx]] ?? activePreset : activePreset;
        let scale = 1;
        let colorBoost = 0;
        let pulseScaleBoost = 0;

        // Compact, soft-feathered click pulse (zero mouse-follow glow)
        if (hasPulses && pulseRadii && pulseFades) {
          for (let k = 0; k < pulses.length; k += 1) {
            const pl = pulses[k];
            const pr = pulseRadii[k];
            const pf = pulseFades[k];
            if (pf <= 0.01) continue;
            const d = Math.hypot(cx - pl.x, cy - pl.y);
            if (d < pr + FEATHER) {
              const edgeEnv = smoothstep(clamp((pr + FEATHER - d) / (FEATHER * 2), 0, 1));
              const behind = Math.max(0, pr - d);
              const coreFill = Math.exp(-behind / 115) * 0.55;
              const rimAccent = Math.exp(-Math.pow((pr - d) / 38, 2)) * 0.3;
              const strength = (coreFill + rimAccent) * edgeEnv * pf;
              if (strength > colorBoost) colorBoost = strength;
              if (strength > pulseScaleBoost) pulseScaleBoost = strength;
              scale = Math.max(scale, 1 + strength * 0.16);
            }
          }
        }

        // 3-zone organic preset transition wave
        if (activeWave) {
          const effDist = evalWaveEffDist(activeWave.x, activeWave.y, activeWave.seed, gx, gy, cx, cy);
          if (effDist < waveR - wDither - wWake) {
            cellPreset = activeWave.toPreset;
          } else if (effDist <= waveR + wLead) {
            if (effDist > waveR) {
              const leadT = 1 - (effDist - waveR) / wLead;
              scale = Math.min(scale, 1 - 0.18 * leadT);
              colorBoost = Math.max(colorBoost, leadT * 0.28);
            } else {
              const behindFront = waveR - effDist;
              const flipThresh = cellFlip[idx];
              if (behindFront < flipThresh) {
                scale = Math.min(scale, 0.82);
                colorBoost = Math.max(colorBoost, 0.36);
              } else {
                cellPreset = activeWave.toPreset;
                const postFlip = behindFront - flipThresh;
                const popT = clamp(postFlip / 95, 0, 1);
                const popScale =
                  popT < 0.45
                    ? 0.82 + (popT / 0.45) * 0.32
                    : 1.14 - ((popT - 0.45) / 0.55) * 0.14;
                scale = Math.max(scale, popScale);
                const wakeAlpha = 0.84 * Math.exp(-postFlip / 165);
                if (wakeAlpha > colorBoost) colorBoost = wakeAlpha;
              }
            }
          }
        }

        let voidVis = 1;
        if (hasVoid) {
          const rawVis = smoothstep((raw - voidLo) / voidSpan);
          voidVis = colorBoost > 0.05 ? Math.max(rawVis, clamp(colorBoost * 0.85, 0, 1)) : rawVis;
          if (voidVis < 0.12) continue;
        }

        let patchW = 0;
        if (!reduceMotion && patchMult > 0) {
          for (let pi = 0; pi < PATCH_COUNT; pi += 1) {
            const p = patches[pi];
            const pdx = gx - p.x;
            const pdy = gy - p.y;
            const dSq = pdx * pdx + pdy * pdy;
            if (dSq < patchRadiiSq[pi]) {
              const s = 1 - Math.sqrt(dSq) / p.radius;
              const w = s * s * patchFade[pi];
              if (w > patchW) patchW = w;
            }
          }
          patchW *= patchMult;
        }

        // Isotropic low-frequency regional saturation/luminance tier [0..3]
        const regionTone = 0.5 + 0.5 * simplex2(gx * toneInv - rDx + 31.4, gyTone);
        const toneEnergy = clamp((regionTone - 0.2) * cfg.toneContrast + patchW * 0.42 + colorBoost * 0.9, 0, 1);
        const toneTier = Math.min(3, Math.floor(toneEnergy * 3.99));

        if (cellPreset === 'all') {
          const visScale = hasVoid ? 0.18 + 0.82 * voidVis : 1;
          const tileSize = Math.min(CELL, CELL * visScale * clamp(scale, 0.78, 1.0));
          const drawX = baseX + (CELL - tileSize) * 0.5;
          const drawY = baseY + (CELL - tileSize) * 0.5;
          const alphaFade = hasVoid ? 0.32 + 0.68 * voidVis : 1;
          ctx.globalAlpha = clamp(
            (minA + density * (maxA - minA)) * alphaFade + patchW * 0.06 + colorBoost * 0.34,
            0,
            boostCap * 0.86,
          );
          ctx.drawImage(atlas.allSolid[toneTier], drawX, drawY, tileSize, tileSize);
          continue;
        }

        if (cellPreset === 'research') {
          const dVal = hasVoid ? density * Math.pow(voidVis, 0.85) : density;
          const rTier = clamp(Math.round((hasVoid ? 0 : 1) + (dVal * 0.88 + pulseScaleBoost * 0.34 + patchW * 0.14) * (hasVoid ? 7 : 6)), hasVoid ? 0 : 1, 7);
          const drawSize = CELL * clamp(scale, 0.78, 1.14);
          const drawX = baseX + (CELL - drawSize) * 0.5;
          const drawY = baseY + (CELL - drawSize) * 0.5;
          const alphaFade = hasVoid ? 0.25 + 0.75 * voidVis : 1;
          ctx.globalAlpha = clamp(
            (minA + dVal * (maxA - minA)) * alphaFade + patchW * 0.07 + colorBoost * 0.42,
            0,
            boostCap,
          );
          ctx.drawImage(atlas.resDots[toneTier][rTier], drawX, drawY, drawSize, drawSize);
          continue;
        }

        if (cellPreset === 'cs') {
          const fade = hasVoid ? Math.pow(voidVis, 1.25) : 1;
          const bit = (cellBit[idx] ^ (patchW > 0.42 + cellRand[idx] * 0.25 ? 1 : 0)) as 0 | 1;
          const drawSize = CELL * clamp(scale, 0.78, 1.14);
          const drawX = baseX + (CELL - drawSize) * 0.5;
          const drawY = baseY + (CELL - drawSize) * 0.5;
          ctx.globalAlpha = clamp(
            (minA + density * (maxA - minA + 0.02)) * fade + patchW * 0.08 * fade + colorBoost * 0.44,
            0,
            boostCap,
          );
          ctx.drawImage(atlas.csGlyphs[toneTier][bit], drawX, drawY, drawSize, drawSize);
          continue;
        }

        // '837': ember solid knockout 0/1 blocks (continuous high-res grid when voidRatio === 0)
        const fade = hasVoid ? Math.pow(voidVis, 1.2) : 1;
        const visScale = hasVoid ? 0.45 + 0.55 * voidVis : 1;
        const bit = cellBit[idx] as 0 | 1;
        const blockSize = Math.min(CELL * 1.02, CELL * visScale * clamp(scale, 0.78, 1.08));
        const drawX = baseX + (CELL - blockSize) * 0.5;
        const drawY = baseY + (CELL - blockSize) * 0.5;
        ctx.globalAlpha = clamp(
          (minA + density * (maxA - minA)) * fade + patchW * 0.07 * fade + colorBoost * 0.42,
          0,
          boostCap,
        );
        ctx.drawImage(atlas.e837Blocks[toneTier][bit], drawX, drawY, blockSize, blockSize);
      }
    }
    ctx.globalAlpha = 1;
  };

  const loop = (now: number) => {
    if (reduceMotion || !inView || document.hidden) {
      rafId = 0;
      return;
    }
    const isInteractive = pulses.length > 0 || wave !== null;
    const minInterval = isInteractive
      ? Math.max(16, Math.round(1000 / Math.max(10, cfg.activeFps)))
      : Math.max(16, Math.round(1000 / Math.max(1, cfg.idleFps)));
    if (now - lastDraw >= minInterval) {
      lastDraw = now;
      renderFrame(now);
    }
    rafId = requestAnimationFrame(loop);
  };

  const startLoop = () => {
    if (reduceMotion || rafId || !inView || document.hidden) return;
    lastTick = performance.now();
    lastDraw = 0;
    rafId = requestAnimationFrame(loop);
  };

  const stopLoop = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };

  const triggerWaveTransition = (
    nextRaw: string | undefined,
    originX?: number,
    originY?: number,
    startTime?: number,
    animate = true,
  ) => {
    const nextPreset = normalizePreset(nextRaw);
    if (nextPreset === activePreset && !wave) return;

    if (!animate || reduceMotion || !inView || document.hidden || width <= 0 || height <= 0) {
      activePreset = nextPreset;
      wave = null;
      resetCommitted(nextPreset);
      renderFrame(performance.now());
      return;
    }

    // Snapshot every cell that has already crossed its flip threshold if interrupting an active wave
    if (wave) {
      const now = performance.now();
      const waveR = computeWaveRadius(now - wave.start, wave.duration, wave.maxReach);
      const toIdx = PRESET_TO_IDX[wave.toPreset];
      for (let gy = 0; gy < rows; gy += 1) {
        const cy = gy * CELL + HALF_CELL;
        const rowOff = gy * cols;
        for (let gx = 0; gx < cols; gx += 1) {
          const cx = gx * CELL + HALF_CELL;
          const idx = rowOff + gx;
          const effDist = evalWaveEffDist(wave.x, wave.y, wave.seed, gx, gy, cx, cy);
          if (waveR - effDist >= cellFlip[idx]) {
            committedPreset[idx] = toIdx;
          }
        }
      }
    } else {
      resetCommitted(activePreset);
    }

    activePreset = nextPreset;
    const rect = canvas.getBoundingClientRect();
    const lx = typeof originX === 'number' && Number.isFinite(originX) ? originX - rect.left : width / 2;
    const ly = typeof originY === 'number' && Number.isFinite(originY) ? originY - rect.top : height * 0.35;
    const cornerDist = Math.hypot(Math.max(lx, width - lx), Math.max(ly, height - ly));
    const maxReach = cornerDist + 115;

    const structSpan = (cfg.waveLead || WAVE_LEAD) + (cfg.waveDither || WAVE_DITHER) + (cfg.waveWake || WAVE_WAKE);
    const waveSpeed = Math.max(120, cfg.waveSpeed);
    const customDuration =
      cfg.waveSpeed === 450 && cfg.waveLead === WAVE_LEAD && cfg.waveDither === WAVE_DITHER && cfg.waveWake === WAVE_WAKE
        ? computeWaveDuration(maxReach)
        : Math.round(clamp(((maxReach + structSpan) / waveSpeed) * 1000, 600, 6500));

    wave = {
      x: lx,
      y: ly,
      start: typeof startTime === 'number' && Number.isFinite(startTime) ? startTime : performance.now(),
      duration: customDuration,
      maxReach,
      toPreset: nextPreset,
      seed: ((waveCounter += 1) * 1.618) % 100,
    };
    startLoop();
  };

  window.addEventListener(
    'resize',
    () => {
      resize();
      renderFrame(performance.now());
    },
    { passive: true },
  );

  // Click-only wave trigger (mouse-follow hover glow completely removed for clarity & performance)
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (reduceMotion || !hasFinePointer) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-preset-slug], [data-ambient-tuner-panel]')) return;
      const rect = canvas.getBoundingClientRect();
      const lx = e.clientX - rect.left;
      const ly = e.clientY - rect.top;
      const headerBox = getHeaderExclusion(rect);
      const insideHeader =
        headerBox && lx >= headerBox.left && lx <= headerBox.right && ly >= headerBox.top && ly <= headerBox.bottom;
      if (!insideHeader && lx >= 0 && lx <= rect.width && ly >= 0 && ly <= rect.height) {
        pulses.push({
          x: lx,
          y: ly,
          start: performance.now(),
          duration: cfg.clickDuration || DEFAULT_PULSE.duration,
          maxR: cfg.clickMaxR || DEFAULT_PULSE.maxR,
        });
        if (pulses.length > 4) pulses.shift();
        startLoop();
      }
    },
    { passive: true },
  );

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && inView && !reduceMotion) startLoop();
    else if (document.hidden) stopLoop();
  });

  window.addEventListener('duolabmeng673:preset-change', (event) => {
    const detail = (
      event as CustomEvent<{
        slug?: string;
        originX?: number;
        originY?: number;
        startTime?: number;
        animate?: boolean;
      }>
    ).detail;
    triggerWaveTransition(
      detail?.slug ?? document.documentElement.dataset.preset,
      detail?.originX,
      detail?.originY,
      detail?.startTime,
      detail?.animate ?? true,
    );
  });

  const handlePauseOrReduce = () => {
    if (reduceMotion) {
      pulses.length = 0;
      wave = null;
      resetCommitted(activePreset);
      stopLoop();
      renderFrame(performance.now());
    } else if (inView && !document.hidden) {
      startLoop();
    }
  };

  motionMedia?.addEventListener('change', (e) => {
    systemReduceMotion = e.matches;
    syncReduceMotion();
    handlePauseOrReduce();
  });

  if (homeRoot) {
    new MutationObserver(() => {
      userPaused = homeRoot.dataset.motion === 'paused';
      syncReduceMotion();
      handlePauseOrReduce();
    }).observe(homeRoot, { attributes: true, attributeFilter: ['data-motion'] });
  }

  const handlePointerMediaChange = () => {
    hasFinePointer = pointerMedia?.matches ?? true;
    isCoarseOrNoHover = coarseOrNoHoverMedia?.matches ?? false;
    syncReduceMotion();
    handlePauseOrReduce();
  };

  pointerMedia?.addEventListener('change', handlePointerMediaChange);
  coarseOrNoHoverMedia?.addEventListener('change', handlePointerMediaChange);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(
      ([entry]) => {
        inView = entry?.isIntersecting ?? true;
        if (inView && !reduceMotion && !document.hidden) startLoop();
        else if (!inView) stopLoop();
      },
      { threshold: 0.01 },
    ).observe(canvas);
  }

  new MutationObserver(() => {
    const nextDark = document.documentElement.dataset.theme === 'dark';
    const nextPreset = normalizePreset(document.documentElement.dataset.preset);
    if (nextDark !== isDark) {
      isDark = nextDark;
      atlas = buildSpriteAtlas(isDark, dpr, cfg);
      renderFrame(performance.now());
    }
    if (nextPreset !== activePreset) {
      triggerWaveTransition(nextPreset);
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-preset'] });

  applyBackdropStyle();
  resize();
  renderFrame(performance.now());
  if (!reduceMotion && inView && !document.hidden) startLoop();

  mountAmbientTuner(cfg, {
    onChange: (_next, rebuild) => {
      if (rebuild === 'backdrop') {
        applyBackdropStyle();
        resize();
      } else if (rebuild === 'grid') {
        resize();
      } else if (rebuild === 'atlas') {
        atlas = buildSpriteAtlas(isDark, dpr, cfg);
      }
      renderFrame(performance.now());
    },
    onTriggerPreset: (slug) => {
      const btn = document.querySelector<HTMLButtonElement>(`[data-preset-slug="${slug}"]`);
      if (btn) {
        btn.click();
        return;
      }
      document.documentElement.dataset.preset = slug;
      triggerWaveTransition(slug, window.innerWidth * 0.5, window.innerHeight * 0.38);
    },
  });
};

const initArticleTileGrid = () => {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-article-tile-grid]');
  if (!canvas || canvas.dataset.initialized === '1') return;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;
  canvas.dataset.initialized = '1';

  const STEP = 20;
  const TILE = 18;
  const FRAME_MS = 90; // ~11 fps ultra-low-power sparse-only redraw
  const motionMedia = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  let reduceMotion = motionMedia?.matches ?? false;
  let isDark = document.documentElement.dataset.theme === 'dark';
  let width = 0;
  let height = 0;
  let rafId = 0;
  let lastDraw = 0;

  let breathers: Array<{ x: number; y: number; phase: number; period: number }> = [];

  const drawStaticBase = () => {
    if (width <= 0 || height <= 0) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.018)' : 'rgba(18, 18, 24, 0.018)';

    const cols = Math.ceil(width / STEP) + 1;
    const rows = Math.ceil(height / STEP) + 1;
    const nextBreathers: typeof breathers = [];

    for (let gy = 0; gy < rows; gy += 1) {
      for (let gx = 0; gx < cols; gx += 1) {
        const x = gx * STEP;
        const y = gy * STEP;
        ctx.fillRect(x, y, TILE, TILE);
        if (hash2(gx + 17, gy + 83) < 0.045) {
          nextBreathers.push({
            x,
            y,
            phase: hash2(gx * 7 + 3, gy * 11 + 5) * Math.PI * 2,
            period: 4800 + hash2(gx + 211, gy + 149) * 4400,
          });
        }
      }
    }
    breathers = nextBreathers;
  };

  // Only update the ~4.5% sparse breathing tiles in place (zero full-screen blit per tick)
  const drawBreathers = (now: number) => {
    if (reduceMotion || breathers.length === 0) return;
    const ink = isDark ? '255 255 255' : '18 18 24';
    const maxAlpha = isDark ? 0.072 : 0.052;
    const baseAlpha = 0.018;
    for (let i = 0; i < breathers.length; i += 1) {
      const b = breathers[i];
      const wave = 0.5 - 0.5 * Math.cos((now / b.period) * Math.PI * 2 + b.phase);
      const alpha = baseAlpha + wave * (maxAlpha - baseAlpha);
      ctx.clearRect(b.x, b.y, TILE, TILE);
      ctx.fillStyle = `rgb(${ink} / ${alpha.toFixed(4)})`;
      ctx.fillRect(b.x, b.y, TILE, TILE);
    }
  };

  const tick = (now: number) => {
    if (reduceMotion || document.hidden) {
      rafId = 0;
      return;
    }
    if (now - lastDraw >= FRAME_MS) {
      lastDraw = now;
      drawBreathers(now);
    }
    rafId = requestAnimationFrame(tick);
  };

  const syncLoop = () => {
    if (reduceMotion || document.hidden) {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      drawStaticBase();
    } else if (!rafId) {
      lastDraw = 0;
      rafId = requestAnimationFrame(tick);
    }
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    canvas.width = width;
    canvas.height = height;
    drawStaticBase();
  };

  window.addEventListener(
    'resize',
    () => {
      resize();
      if (!reduceMotion) drawBreathers(performance.now());
    },
    { passive: true },
  );

  document.addEventListener('visibilitychange', syncLoop);

  motionMedia?.addEventListener('change', (e) => {
    reduceMotion = e.matches;
    syncLoop();
  });

  new MutationObserver(() => {
    const nextDark = document.documentElement.dataset.theme === 'dark';
    if (nextDark !== isDark) {
      isDark = nextDark;
      drawStaticBase();
      if (!reduceMotion) drawBreathers(performance.now());
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  resize();
  syncLoop();
};

initHeroBackdrop();
initArticleTileGrid();

export {};
