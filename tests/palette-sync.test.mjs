import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PALETTE } from '../src/lib/palette.ts';
import {
  WAVE_DITHER,
  WAVE_LEAD,
  WAVE_SPEED,
  WAVE_WAKE,
  computeStageArrivalDelay,
  computeWaveDuration,
  computeWaveRadius,
} from '../src/lib/wave-timing.ts';
import { scanForPurple } from '../scripts/lint-palette.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('tokens.css mirrors every core hex defined in src/lib/palette.ts (single source of truth)', () => {
  const tokens = read('src/styles/tokens.css').toLowerCase();
  const requiredHexes = [
    PALETTE.neutral.light.bg,
    PALETTE.neutral.light.elev,
    PALETTE.neutral.light.accent,
    PALETTE.neutral.light.accentStrong,
    PALETTE.neutral.dark.bg,
    PALETTE.neutral.dark.elev,
    PALETTE.neutral.dark.accent,
    PALETTE.neutral.dark.accentStrong,
    PALETTE.study.light,
    PALETTE.study.lightStrong,
    PALETTE.study.dark,
    PALETTE.study.darkStrong,
    PALETTE.syntaxFunction.light,
    PALETTE.syntaxFunction.dark,
    ...Object.values(PALETTE.channels).flatMap((ch) => [ch.light, ch.lightHi, ch.dark, ch.darkHi]),
    ...Object.values(PALETTE.heatmap.light),
    ...Object.values(PALETTE.heatmap.dark),
  ];

  for (const hex of requiredHexes) {
    assert.ok(tokens.includes(hex.toLowerCase()), `tokens.css is missing ${hex} from src/lib/palette.ts`);
  }

  assert.ok(!tokens.includes('--dot:'), 'dead --dot token must be removed');
  assert.ok(!tokens.includes('--spot:'), 'dead --spot token must be removed');
});

test('no disallowed purple color literals remain in src/ or public/*.svg', () => {
  const violations = scanForPurple();
  assert.deepEqual(violations, [], `Unexpected purple literals: ${JSON.stringify(violations)}`);
});

test('shared wave-timing model provides user-tuned speed, monotonic radius, and stage delay', () => {
  assert.equal(WAVE_SPEED, 450);
  assert.equal(WAVE_LEAD, 130);
  assert.equal(WAVE_DITHER, 230);
  assert.equal(WAVE_WAKE, 330);

  const dur = computeWaveDuration(1500);
  assert.ok(dur >= 2200 && dur <= 6000, `wave duration should be in 2.2..6.0s, got ${dur}ms`);

  let prevR = -1;
  for (let ms = 0; ms <= dur; ms += 100) {
    const r = computeWaveRadius(ms, dur, 1500);
    assert.ok(r >= prevR, `wave radius must be monotonic at ${ms}ms`);
    prevR = r;
  }

  const delay = computeStageArrivalDelay(240, 680, { left: 140, top: 270, width: 1160, height: 610 });
  assert.ok(delay >= 60 && delay <= 1400, `stage arrival delay out of range: ${delay}ms`);
});

test('homepage stage responds immediately without wave veil and ambient-grid keeps user-tuned defaults and settings toggle', () => {
  const homeHtml = read('dist/index.html');
  assert.ok(!homeHtml.includes('data-wave-veil'), 'homepage stage must not overlay a wave veil');
  assert.match(homeHtml, /class="stage"\s+data-hero-stage\s+data-preset="all"/);
  assert.match(homeHtml, /aria-label="站点设置"/, 'header settings button must use settings gear aria-label');
  assert.match(homeHtml, /role="switch"[^>]*data-ambient-tuner-toggle|data-ambient-tuner-toggle[^>]*role="switch"/, 'header settings popover must provide sliding switch for dot-matrix tuner');

  const gridSrc = read('src/scripts/ambient-grid.ts');
  assert.match(gridSrc, /--ch-all-rgb/);
  assert.match(gridSrc, /--ch-research-rgb/);
  assert.match(gridSrc, /--ch-cs-rgb/);
  assert.match(gridSrc, /--ch-837-rgb/);
  assert.ok(!gridSrc.includes('data-wave-veil'), 'ambient-grid must not draw over the stage');
  assert.ok(!gridSrc.includes('outX'), 'mouse disturbance must not apply outward repulsion that cracks grid gaps');
  assert.ok(!gridSrc.includes("'pointermove'"), 'mouse-follow hover glow must stay removed');
  assert.ok(!gridSrc.includes('resAccRing'), 'blue halftone dots must stay solid without hollow rings');
  assert.ok(!gridSrc.includes('e837AccWire'), 'ember 837 blocks must stay solid without hollow wireframes');
  assert.ok(!gridSrc.includes('COARSE_STRIDE'), 'coarse-grid bilinear upsampling must stay removed so no vertical cuts appear');
  assert.ok(!gridSrc.includes('allSmall'), 'stray small-square debris must stay removed');
  assert.match(gridSrc, /FIELD_PERIOD\s*=\s*30/, 'user-tuned simplex modulation period must stay at 30 cells');
  assert.match(gridSrc, /simplex2\(/, 'isotropic 2D simplex noise must drive smooth modulation');
  assert.match(gridSrc, /Math\.min\(CELL,/, 'all-preset pixel squares must stay <= CELL so gaps never blur into a glow blob');
  assert.match(gridSrc, /maxR:\s*280/, 'user-tuned click pulse radius default must stay at 280');
  assert.match(gridSrc, /committedPreset\[idx\]\s*=\s*toIdx/, 'mid-wave interruption snapshotting must be preserved');

  const globalCss = read('src/styles/global.css');
  assert.match(globalCss, /\.dotgrid-hero-backdrop\s*\{[^}]*position:\s*absolute;[^}]*height:\s*100vh;/, 'non-article dot-matrix backdrop must default to 100vh matching user-tuned backdropHeightVh=100');
  assert.match(globalCss, /\.settings-switch\s*\{/, 'settings popover must style left-right sliding toggle switches');
  assert.match(globalCss, /\.article\[data-category="Computer Science"\]\s*\{[^}]*--ac:\s*var\(--c2\);/, 'CS articles must use tech rose accent for TOC indicator and links');
  assert.match(globalCss, /\.article\[data-category="Research"\]\s*\{[^}]*--ac:\s*var\(--c1\);/, 'Research articles must use indigo accent for TOC indicator and links');
});
