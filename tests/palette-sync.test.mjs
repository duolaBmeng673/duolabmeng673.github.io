import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { PALETTE } from '../src/lib/palette.ts';
import { scanForPurple } from '../scripts/lint-palette.mjs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const has = (path) => existsSync(new URL('../' + path, import.meta.url));

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

test('heavy background scripts & CardSwap files are removed while Kinetic Crosshair + fixed CSS wallpaper stay wired', () => {
  for (const removed of [
    'src/scripts/ambient-grid.ts',
    'src/scripts/ambient-tuner.ts',
    'src/scripts/gradient-ascii.ts',
    'src/lib/wave-timing.ts',
    'src/components/islands/DotGrid.island.tsx',
    'src/components/islands/CardSwap.island.tsx',
    'src/components/islands/ReactBitsCardSwap.tsx',
    'src/components/islands/CardSwap.css',
  ]) {
    assert.ok(!has(removed), `${removed} must remain deleted`);
  }

  const homeHtml = read('dist/index.html');
  assert.ok(!homeHtml.includes('data-wave-veil'), 'homepage stage must not overlay a wave veil');
  assert.ok(!homeHtml.includes('专题传送门'), 'removed CardSwap portal must not appear on homepage');
  assert.ok(!homeHtml.includes('gradient-ascii-backdrop'), 'removed GradientASCII backdrop must not appear');
  assert.match(homeHtml, /class="kinetic-crosshair-backdrop"/, 'homepage must mount Kinetic Crosshair backdrop');
  assert.match(homeHtml, /class="stage"\s+data-hero-stage\s+data-preset="all"/);
  assert.match(homeHtml, /class="card rb-panel s12"/, 'homepage quick-index danmaku must span full width (s12)');
  assert.match(homeHtml, /aria-label="站点设置"/, 'header settings button must use settings gear aria-label');
  assert.match(homeHtml, /data-bg-style="crosshair"/, 'settings popover must offer Kinetic Crosshair background style');
  assert.match(homeHtml, /data-bg-style="mesh"/, 'settings popover must offer Packet Mesh background style');
  assert.ok(!homeHtml.includes('data-dotgrid-tuner-toggle'), 'header settings popover must not include removed DotGrid tuner switch');
  assert.ok(!homeHtml.includes('data-ambient-tuner-toggle'), 'header settings popover must not include removed legacy ambient tuner switch');

  const crosshairSrc = read('src/scripts/kinetic-crosshair.ts');
  assert.match(crosshairSrc, /--ch-all-rgb/);
  assert.match(crosshairSrc, /--ch-research-rgb/);
  assert.match(crosshairSrc, /--ch-cs-rgb/);
  assert.match(crosshairSrc, /--ch-837-rgb/);
  assert.match(crosshairSrc, /duolabmeng673:preset-change/);
  assert.match(crosshairSrc, /duolabmeng673:bg-style-change/);

  const globalCss = read('src/styles/global.css');
  assert.match(globalCss, /body::before\s*\{[^}]*position:\s*fixed;[^}]*background-image:/, 'global fixed square-tile wallpaper must stay anchored via body::before');
  assert.match(globalCss, /\.kinetic-crosshair-backdrop\s*\{[^}]*background-color:\s*var\(--bg\);/, 'upper backdrop must use solid var(--bg) so tiles only appear via bottom fade transition');
  assert.match(globalCss, /\.settings-switch\s*\{/, 'settings popover must style left-right sliding toggle switches');
  assert.match(globalCss, /\.article\[data-category="Computer Science"\]\s*\{[^}]*--ac:\s*var\(--c2\);/, 'CS articles must use tech rose accent for TOC indicator and links');
  assert.match(globalCss, /\.article\[data-category="Research"\]\s*\{[^}]*--ac:\s*var\(--c1\);/, 'Research articles must use indigo accent for TOC indicator and links');
});
