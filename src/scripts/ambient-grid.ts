/**
 * High-performance unified-grid four-state backdrop & article-page breathing tile grid.
 * - Presets (`data-preset`): all (soft-purple micro-pixels), research (indigo halftone dots),
 *   cs (rose binary 0/1), 837 (ember solid knockout 0/1 blocks).
 * - Multi-zone theme coloring: pre-bakes 4 saturation/luminance tiers of each preset's CSS theme color
 *   (`--ch-*-rgb`) so different viewport regions naturally vary in brightness & saturation.
 * - Zero mouse-follow hover glow: waves appear ONLY on mouse click (`pointerdown`) and preset switch.
 * - Performance optimizations: DPR=1 integer-aligned canvas (4x fewer pixels on Retina), 1/4 coarse-grid
 *   bilinear noise (16x less noise math), precomputed per-cell LUTs (zero hash calls per frame),
 *   single `drawImage` per visible cell, 14 fps calm idle -> 45 fps during click/preset wave,
 *   and sparse-only tile redraw on article pages.
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

const PRESETS: readonly PresetSlug[] = ['all', 'research', 'cs', '837'];
const PRESET_TO_IDX: Record<PresetSlug, number> = { all: 0, research: 1, cs: 2, '837': 3 };
const normalizePreset = (raw?: string | null): PresetSlug =>
  raw && raw in PRESET_TO_IDX ? (raw as PresetSlug) : 'all';

const CELL = 15; // 13x13 visual tile with 2px crisp gap
const COARSE_STRIDE = 4;
const RES_RADII = [1.5, 2.5, 3.4, 4.3, 5.1, 5.8] as const;

type RgbTriplet = [number, number, number];

const hash2 = (ix: number, iy: number): number => {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
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
const buildThemeTiers = (rgb: RgbTriplet, isDark: boolean): [string, string, string, string] => {
  const [h, s, l] = rgbToHsl(rgb);
  if (isDark) {
    return [
      hslToRgbCss(h, s * 0.42, clamp(l * 0.72, 0.28, 0.48)),
      hslToRgbCss(h, s * 0.78, clamp(l * 0.92, 0.42, 0.62)),
      hslToRgbCss(h, Math.min(1, s * 1.12), clamp(l * 1.04, 0.5, 0.7)),
      hslToRgbCss(h, Math.min(1, s * 1.18), clamp(l * 1.18, 0.62, 0.82)),
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
  allSmall: HTMLCanvasElement[]; // 4 tonal tiers
  resDots: HTMLCanvasElement[][]; // [tier 0..3][radius 0..5]
  csGlyphs: [HTMLCanvasElement, HTMLCanvasElement][]; // [tier 0..3][bit 0|1]
  e837Blocks: [HTMLCanvasElement, HTMLCanvasElement][]; // [tier 0..3][bit 0|1]
}

const buildSpriteAtlas = (isDark: boolean): SpriteAtlas => {
  const rgbs = readChannelRgbs(isDark);
  const allTiers = buildThemeTiers(rgbs.all, isDark);
  const resTiers = buildThemeTiers(rgbs.research, isDark);
  const csTiers = buildThemeTiers(rgbs.cs, isDark);
  const e837Tiers = buildThemeTiers(rgbs['837'], isDark);

  const bake = (draw: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement => {
    const c = makeCanvas(CELL, CELL);
    const g = c.getContext('2d');
    if (g) draw(g);
    return c;
  };

  const rectSprite = (color: string, inset = 1) =>
    bake((g) => {
      g.fillStyle = color;
      g.fillRect(inset, inset, CELL - inset * 2, CELL - inset * 2);
    });

  const dotSprite = (color: string, r: number) =>
    bake((g) => {
      g.beginPath();
      g.arc(CELL / 2, CELL / 2, r, 0, Math.PI * 2);
      g.fillStyle = color;
      g.fill();
    });

  const glyphSprite = (bit: '0' | '1', color: string) =>
    bake((g) => {
      g.fillStyle = color;
      g.font = '600 10.5px ui-monospace, Menlo, Consolas, monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(bit, CELL / 2, CELL / 2 + 0.5);
    });

  const blockSolidSprite = (bit: '0' | '1', color: string) =>
    bake((g) => {
      g.fillStyle = color;
      g.fillRect(1, 1, CELL - 2, CELL - 2);
      g.globalCompositeOperation = 'destination-out';
      g.font = '700 10px ui-monospace, Menlo, Consolas, monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(bit, CELL / 2, CELL / 2 + 0.5);
      g.globalCompositeOperation = 'source-over';
    });

  return {
    allSolid: allTiers.map((c) => rectSprite(c, 1)),
    allSmall: allTiers.map((c) => rectSprite(c, 3)),
    resDots: resTiers.map((c) => RES_RADII.map((r) => dotSprite(c, r))),
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

  let isDark = document.documentElement.dataset.theme === 'dark';
  let activePreset = normalizePreset(document.documentElement.dataset.preset);
  let width = 0;
  let height = 0;
  let cols = 0;
  let rows = 0;
  let coarseCols = 0;
  let coarseRows = 0;
  let inView = true;
  let rafId = 0;
  let lastTick = performance.now();
  let lastDraw = 0;
  let driftTime = 0;

  let atlas = buildSpriteAtlas(isDark);
  let committedPreset = new Uint8Array(0);
  // Precomputed per-cell LUTs (eliminates hash2 calls from hot render loop)
  let cellBit = new Uint8Array(0);
  let cellFlip = new Float32Array(0);
  let cellRand = new Float32Array(0);
  // 1/4-resolution coarse noise buffers (16x less noise math per frame)
  let coarseDensity = new Float32Array(0);
  let coarseTone = new Float32Array(0);

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
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    // DPR=1 integer-aligned canvas slashes fill-rate 4x on Retina while keeping 15px tiles sharp
    canvas.width = width;
    canvas.height = height;
    cols = Math.ceil(width / CELL) + 1;
    rows = Math.ceil(height / CELL) + 1;
    coarseCols = Math.ceil(cols / COARSE_STRIDE) + 2;
    coarseRows = Math.ceil(rows / COARSE_STRIDE) + 2;

    const len = cols * rows;
    committedPreset = new Uint8Array(len);
    cellBit = new Uint8Array(len);
    cellFlip = new Float32Array(len);
    cellRand = new Float32Array(len);
    for (let gy = 0; gy < rows; gy += 1) {
      const rowOff = gy * cols;
      for (let gx = 0; gx < cols; gx += 1) {
        const idx = rowOff + gx;
        cellBit[idx] = hash2(gx * 5 + 23, gy * 7 + 13) > 0.5 ? 1 : 0;
        cellFlip[idx] = hash2(gx * 13 + 7, gy * 17 + 3) * WAVE_DITHER;
        cellRand[idx] = hash2(gx + 97, gy + 53);
      }
    }

    coarseDensity = new Float32Array(coarseCols * coarseRows);
    coarseTone = new Float32Array(coarseCols * coarseRows);
    resetCommitted(activePreset);
    pulses.length = 0;
    wave = null;
    atlas = buildSpriteAtlas(isDark);
    if (patches.length === 0) {
      for (let i = 0; i < PATCH_COUNT; i += 1) patches.push(spawnPatch(true));
    }
  };

  const updateCoarseFields = (t: number) => {
    const tDx = t * 0.13;
    const tDy = t * 0.085;
    const t2x = t * 0.065;
    const t2y = t * 0.1;
    const rDx = t * 0.06;
    const rDy = t * 0.045;
    for (let cy = 0; cy < coarseRows; cy += 1) {
      const gy = cy * COARSE_STRIDE;
      const rowOff = cy * coarseCols;
      for (let cx = 0; cx < coarseCols; cx += 1) {
        const gx = cx * COARSE_STRIDE;
        const idx = rowOff + cx;
        coarseDensity[idx] =
          valueNoise(gx * 0.072 + tDx, gy * 0.072 - tDy) * 0.68 +
          valueNoise(gx * 0.165 - t2x, gy * 0.165 + t2y) * 0.32;
        // Separate low-frequency regional field drives different saturation & luminance across areas
        coarseTone[idx] =
          valueNoise(gx * 0.048 - rDx + 31.4, gy * 0.048 + rDy + 17.2) * 0.72 +
          valueNoise(gx * 0.11 + rDy + 9.7, gy * 0.11 - rDx + 43.1) * 0.28;
      }
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
      driftTime += dt;
      for (let i = 0; i < patches.length; i += 1) {
        const pt = patches[i];
        pt.age += dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
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

    updateCoarseFields(driftTime);

    let waveR = 0;
    let activeWave = wave;
    if (activeWave) {
      const elapsed = now - activeWave.start;
      waveR = computeWaveRadius(elapsed, activeWave.duration, activeWave.maxReach);
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
    const FEATHER = 54;
    let pulseRadii: number[] | null = null;
    let pulseFades: number[] | null = null;
    if (hasPulses) {
      pulseRadii = new Array(pulses.length);
      pulseFades = new Array(pulses.length);
      for (let k = 0; k < pulses.length; k += 1) {
        const p = pulses[k];
        const u = clamp((now - p.start) / p.duration, 0, 1);
        const pr = p.maxR * (1 - Math.pow(1 - u, 2.35));
        const fadeStartR = p.maxR * 0.5;
        const horizonFade =
          pr > fadeStartR
            ? Math.pow(clamp(1 - (pr - fadeStartR) / (p.maxR - fadeStartR), 0, 1), 1.55)
            : 1;
        pulseRadii[k] = pr;
        pulseFades[k] = horizonFade * Math.pow(clamp(1 - u, 0, 1), 1.25);
      }
    }

    const minA = isDark ? 0.1 : 0.08;
    const maxA = isDark ? 0.25 : 0.19;
    const boostCap = isDark ? 0.52 : 0.42;
    const invStride = 1 / COARSE_STRIDE;

    for (let gy = 0; gy < rows; gy += 1) {
      const baseY = gy * CELL;
      const cy = baseY + 7.5;
      const cgy = gy >> 2;
      const fy = (gy & 3) * invStride;
      const cRow0 = cgy * coarseCols;
      const cRow1 = (cgy + 1) * coarseCols;
      const rowOff = gy * cols;

      for (let gx = 0; gx < cols; gx += 1) {
        const idx = rowOff + gx;
        const baseX = gx * CELL;
        const cx = baseX + 7.5;

        // Fast bilinear lookup from 1/4 coarse fields
        const cgx = gx >> 2;
        const fx = (gx & 3) * invStride;
        const i00 = cRow0 + cgx;
        const i10 = i00 + 1;
        const i01 = cRow1 + cgx;
        const i11 = i01 + 1;

        const dTop = coarseDensity[i00] + (coarseDensity[i10] - coarseDensity[i00]) * fx;
        const dBot = coarseDensity[i01] + (coarseDensity[i11] - coarseDensity[i01]) * fx;
        const n = dTop + (dBot - dTop) * fy;

        const tTop = coarseTone[i00] + (coarseTone[i10] - coarseTone[i00]) * fx;
        const tBot = coarseTone[i01] + (coarseTone[i11] - coarseTone[i01]) * fx;
        const regionTone = tTop + (tBot - tTop) * fy;

        let patchW = 0;
        if (!reduceMotion) {
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
        }

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
          if (effDist < waveR - WAVE_DITHER - WAVE_WAKE) {
            cellPreset = activeWave.toPreset;
          } else if (effDist <= waveR + WAVE_LEAD) {
            if (effDist > waveR) {
              const leadT = 1 - (effDist - waveR) / WAVE_LEAD;
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

        // Regional saturation/brightness tier [0..3] + boost from patches/click/wave
        const toneEnergy = clamp((regionTone - 0.22) * 1.45 + patchW * 0.48 + colorBoost * 0.9, 0, 1);
        const toneTier = Math.min(3, Math.floor(toneEnergy * 3.99));

        if (cellPreset === 'all') {
          if (n <= 0.34 && colorBoost < 0.05 && patchW < 0.3) continue;
          const t = clamp((n - 0.34) / 0.58, 0, 1);
          const tileSize = Math.min(CELL, CELL * clamp(scale, 0.78, 1.0));
          const drawX = baseX + (CELL - tileSize) * 0.5;
          const drawY = baseY + (CELL - tileSize) * 0.5;
          const useSmall = patchW > 0.34 && colorBoost < 0.15 && cellRand[idx] > 0.55;
          ctx.globalAlpha = clamp(minA + t * (maxA - minA) + patchW * 0.07 + colorBoost * 0.34, 0, boostCap * 0.86);
          ctx.drawImage(useSmall ? atlas.allSmall[toneTier] : atlas.allSolid[toneTier], drawX, drawY, tileSize, tileSize);
          continue;
        }

        if (cellPreset === 'research') {
          const tNorm = clamp((n - 0.14) / 0.74, 0, 1);
          if (tNorm <= 0.04 && colorBoost < 0.04 && patchW < 0.3) continue;
          const shaped = Math.pow(tNorm, 0.72);
          const rTier = clamp(Math.round((shaped + pulseScaleBoost * 0.34 + Math.sin(patchW * Math.PI) * 0.16) * 5), 0, 5);
          const drawSize = CELL * clamp(scale, 0.78, 1.14);
          const drawX = baseX + (CELL - drawSize) * 0.5;
          const drawY = baseY + (CELL - drawSize) * 0.5;
          ctx.globalAlpha = clamp(minA + shaped * (maxA - minA) + patchW * 0.08 + colorBoost * 0.42, 0, boostCap);
          ctx.drawImage(atlas.resDots[toneTier][rTier], drawX, drawY, drawSize, drawSize);
          continue;
        }

        if (cellPreset === 'cs') {
          if (n <= 0.39 && colorBoost < 0.05 && patchW < 0.34) continue;
          const t = clamp((n - 0.39) / 0.53, 0, 1);
          const bit = (cellBit[idx] ^ (patchW > 0.38 + cellRand[idx] * 0.25 ? 1 : 0)) as 0 | 1;
          const drawSize = CELL * clamp(scale, 0.78, 1.14);
          const drawX = baseX + (CELL - drawSize) * 0.5;
          const drawY = baseY + (CELL - drawSize) * 0.5;
          ctx.globalAlpha = clamp(minA + t * (maxA - minA) + patchW * 0.09 + colorBoost * 0.44, 0, boostCap);
          ctx.drawImage(atlas.csGlyphs[toneTier][bit], drawX, drawY, drawSize, drawSize);
          continue;
        }

        // '837': forest-green solid knockout 0/1 blocks (never hollow wireframe)
        if (n <= 0.42 && colorBoost < 0.05 && patchW < 0.32) continue;
        const t = clamp((n - 0.42) / 0.52, 0, 1);
        const bit = cellBit[idx] as 0 | 1;
        const blockSize = Math.min(CELL * 1.02, CELL * clamp(scale, 0.78, 1.08));
        const drawX = baseX + (CELL - blockSize) * 0.5;
        const drawY = baseY + (CELL - blockSize) * 0.5;
        ctx.globalAlpha = clamp(minA + t * (maxA - minA) + patchW * 0.08 + colorBoost * 0.42, 0, boostCap);
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
    // Calm 14 fps idle drift (~72ms) -> smooth 45 fps (~22ms) only during click pulse or preset wave
    const minInterval = isInteractive ? 22 : 72;
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
        const cy = gy * CELL + 7.5;
        const rowOff = gy * cols;
        for (let gx = 0; gx < cols; gx += 1) {
          const cx = gx * CELL + 7.5;
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

    wave = {
      x: lx,
      y: ly,
      start: typeof startTime === 'number' && Number.isFinite(startTime) ? startTime : performance.now(),
      duration: computeWaveDuration(maxReach),
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
      if (target?.closest('[data-preset-slug]')) return;
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
          duration: 1250,
          maxR: 210,
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
      atlas = buildSpriteAtlas(isDark);
      renderFrame(performance.now());
    }
    if (nextPreset !== activePreset) {
      triggerWaveTransition(nextPreset);
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-preset'] });

  resize();
  renderFrame(performance.now());
  if (!reduceMotion && inView && !document.hidden) startLoop();
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
