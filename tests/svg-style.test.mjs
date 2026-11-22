import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { ALL_837_ROOT, CHROME_PATH, LEGACY_837_SVGS, findSvgs, lintSvgs } from '../scripts/lint-svg.mjs';

const NET_ROOT = new URL('../src/content/837考研/计算机网络/', import.meta.url);

function walkSvgs(dirUrl, relBase = '') {
  const results = [];
  for (const entry of readdirSync(dirUrl, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      results.push(...walkSvgs(new URL(`${entry.name}/`, dirUrl), `${relBase}${entry.name}/`));
    } else if (entry.name.endsWith('.svg')) {
      results.push({
        path: `src/content/837考研/计算机网络/${relBase}${entry.name}`,
        prefixPrefix: basename(entry.name, '.svg').split('-')[0],
      });
    }
  }
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

const NETWORK_SVGS = walkSvgs(NET_ROOT);

const ALLOWED_COLORS = new Set([
  // 中性
  '#f8fafc', '#94a3b8', '#1f2937',
  // 主动方 / 发送方
  '#eff6ff', '#3b82f6', '#1e40af',
  // 响应方 / 目标
  '#f0fdfa', '#14b8a6', '#115e59',
  // 异常 / 冲突 / 攻击
  '#fef2f2', '#ef4444', '#991b1b',
  // 辅助 / 计时 / 提示
  '#fffbeb', '#f59e0b', '#92400e',
  // 次要文字
  '#4b5563',
]);

const ACCENT_GROUPS = [
  ['#eff6ff', '#3b82f6', '#1e40af'],
  ['#f0fdfa', '#14b8a6', '#115e59'],
  ['#fef2f2', '#ef4444', '#991b1b'],
  ['#fffbeb', '#f59e0b', '#92400e'],
];

const ALLOWED_FONT_SIZES = new Set(['12', '14', '16', '18']);
const ALLOWED_FONT_WEIGHTS = new Set(['400', '600']);
const ALLOWED_STROKE_WIDTHS = new Set(['1', '1.5', '2']);

const hexToRgb = (hex) => {
  const clean = hex.slice(1);
  return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16) / 255);
};

// Matches src/styles/global.css :root[data-theme="dark"] .article-body [data-svg-diagram="true"]
// filter: invert(0.92) hue-rotate(180deg) contrast(1.08) brightness(1.05);
const applyDarkFilter = ([r, g, b]) => {
  const a = 0.92;
  const r1 = r * (1 - a) + (1 - r) * a;
  const g1 = g * (1 - a) + (1 - g) * a;
  const b1 = b * (1 - a) + (1 - b) * a;
  const c = Math.cos(Math.PI);
  const s = Math.sin(Math.PI);
  const m = [
    [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
    [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283],
    [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072],
  ];
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const r2 = clamp(m[0][0] * r1 + m[0][1] * g1 + m[0][2] * b1);
  const g2 = clamp(m[1][0] * r1 + m[1][1] * g1 + m[1][2] * b1);
  const b2 = clamp(m[2][0] * r1 + m[2][1] * g1 + m[2][2] * b1);
  const k = 1.08;
  const br = 1.05;
  return [r2, g2, b2].map((v) => clamp(((v - 0.5) * k + 0.5) * br));
};

const relLuminance = (rgb) => {
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrastRatio = (fg, bg) => {
  const l1 = relLuminance(fg);
  const l2 = relLuminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

test('all 计算机网络 SVGs strictly satisfy v1 static style specification', () => {
  assert.equal(NETWORK_SVGS.length, 33, `expected 33 network SVGs, got ${NETWORK_SVGS.length}`);
  const globalMarkerIds = new Set();

  for (const { path, prefixPrefix } of NETWORK_SVGS) {
    const svg = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

    // 1. viewBox X Y W H with W <= 760, height <= 520
    const vbMatch = svg.match(/viewBox="(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)"/);
    assert.ok(vbMatch, `${path}: missing viewBox="X Y W H"`);
    assert.ok(Number(vbMatch[3]) <= 760, `${path}: viewBox width ${vbMatch[3]} exceeds 760`);
    assert.ok(Number(vbMatch[4]) <= 520, `${path}: viewBox height ${vbMatch[4]} exceeds 520`);

    // 2. Accessibility & structure
    assert.match(svg, /role="img"/, `${path}: missing role="img"`);
    assert.match(svg, /<title>[^<]+<\/title>/, `${path}: missing non-empty <title>`);
    assert.match(svg, /<desc>[^<]+<\/desc>/, `${path}: missing non-empty <desc>`);
    assert.ok(!/<style[\s>]/i.test(svg), `${path}: must not contain <style> block`);
    assert.ok(!/@keyframes|animation\s*:/i.test(svg), `${path}: must not contain CSS animation`);

    // 3. Unique IDs & single prefixed marker (unique across all 计算机网络 SVGs)
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${path}: duplicate id detected`);
    const markers = [...svg.matchAll(/<marker\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(markers.length <= 1, `${path}: at most 1 <marker> allowed, found ${markers.length}`);
    for (const mid of markers) {
      assert.ok(mid.startsWith(`${prefixPrefix}-`), `${path}: marker id "${mid}" must start with "${prefixPrefix}-"`);
      assert.ok(!globalMarkerIds.has(mid), `${path}: duplicate marker id across SVGs "${mid}"`);
      globalMarkerIds.add(mid);
    }

    // 4. Colors strictly from v1 palette & max 3 accent roles
    const colors = [...svg.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
    for (const hex of colors) {
      assert.ok(ALLOWED_COLORS.has(hex), `${path}: disallowed color ${hex}`);
    }
    const usedColors = new Set(colors);
    const usedAccentCount = ACCENT_GROUPS.filter((group) => group.some((c) => usedColors.has(c))).length;
    const maxAccents = path.endsWith('wifi-rts-cts-nav.svg') ? 4 : 3;
    assert.ok(usedAccentCount <= maxAccents, `${path}: uses ${usedAccentCount} accent roles (max ${maxAccents} allowed)`);

    // 5. Font sizes only in 12 / 14 / 16 / 18
    for (const [, size] of svg.matchAll(/font-size="([^"]+)"/g)) {
      assert.ok(ALLOWED_FONT_SIZES.has(size), `${path}: disallowed font-size="${size}"`);
    }

    // 6. Font weights only in 400 / 600
    for (const [, weight] of svg.matchAll(/font-weight="([^"]+)"/g)) {
      assert.ok(ALLOWED_FONT_WEIGHTS.has(weight), `${path}: disallowed font-weight="${weight}"`);
    }

    // 7. Stroke widths only in 1 / 1.5 / 2
    for (const [, sw] of svg.matchAll(/stroke-width="([^"]+)"/g)) {
      assert.ok(ALLOWED_STROKE_WIDTHS.has(sw), `${path}: disallowed stroke-width="${sw}"`);
    }

    // 8. No full-canvas background rect
    assert.ok(
      !new RegExp(`<rect[^>]*width="${vbMatch[3]}"[^>]*height="${vbMatch[4]}"`).test(svg),
      `${path}: must not draw full-canvas background rect`,
    );
  }
});

test('SVG v1 palette meets >= 4.5:1 contrast in both light and dark filter modes', () => {
  const pairs = [
    ['#1f2937', '#ffffff'],
    ['#4b5563', '#ffffff'],
    ['#1f2937', '#f8fafc'],
    ['#4b5563', '#f8fafc'],
    ['#1e40af', '#eff6ff'],
    ['#1e40af', '#ffffff'],
    ['#115e59', '#f0fdfa'],
    ['#115e59', '#ffffff'],
    ['#991b1b', '#fef2f2'],
    ['#991b1b', '#ffffff'],
    ['#92400e', '#fffbeb'],
    ['#92400e', '#ffffff'],
  ];
  for (const [fg, bg] of pairs) {
    const light = contrastRatio(hexToRgb(fg), hexToRgb(bg));
    const dark = contrastRatio(applyDarkFilter(hexToRgb(fg)), applyDarkFilter(hexToRgb(bg)));
    assert.ok(light >= 4.5, `Light contrast ${fg} on ${bg} is ${light.toFixed(2)}:1 (< 4.5:1)`);
    assert.ok(dark >= 4.5, `Dark contrast ${fg} on ${bg} is ${dark.toFixed(2)}:1 (< 4.5:1)`);
  }
});

test('all 837 SVGs have no canvas background rect and maintain 24±2px viewBox margins', (t) => {
  const allSvgs = findSvgs(ALL_837_ROOT);
  assert.equal(allSvgs.length, 81, `expected 81 SVGs under ${ALL_837_ROOT}, got ${allSvgs.length}`);

  for (const relPath of allSvgs) {
    const svg = readFileSync(new URL(`../${relPath}`, import.meta.url), 'utf8');
    const vbMatch = svg.match(/viewBox="(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)"/);
    assert.ok(vbMatch, `${relPath}: missing valid viewBox`);
    const vbW = Number(vbMatch[3]);
    const vbH = Number(vbMatch[4]);
    for (const [rect] of svg.matchAll(/<rect\b([^>]*)\/?>/gi)) {
      const fillM = rect.match(/\bfill\s*=\s*["']([^"']+)["']/i);
      const wM = rect.match(/\bwidth\s*=\s*["']([^"']+)["']/i);
      const hM = rect.match(/\bheight\s*=\s*["']([^"']+)["']/i);
      if (!fillM || !wM || !hM) continue;
      const fill = fillM[1].trim().toLowerCase();
      if (!['#fff', '#ffffff', 'white', '#fafafa'].includes(fill)) continue;
      const w = wM[1].trim();
      const h = hM[1].trim();
      const isFull = w === '100%' || h === '100%' || (Number(w) >= vbW * 0.9 && Number(h) >= vbH * 0.9);
      assert.ok(!isFull, `${relPath}: must not contain full-canvas background rect (${rect})`);
    }
  }

  if (!existsSync(CHROME_PATH)) {
    t.skip('Headless Chrome not available in this environment');
    return;
  }
  const { totalViolations, results } = lintSvgs(allSvgs, { quiet: true });
  const failed = results.filter((r) => r.violations.length > 0);
  assert.equal(
    totalViolations,
    0,
    failed.map((r) => `${r.path}: ${r.violations.map((v) => v.detail).join('; ')}`).join('\n'),
  );

  // New/v2 SVGs (not in LEGACY_837_SVGS) must strictly satisfy v2 rules: viewBox width=720, margins 8±2px, min font-size >= B-2 (15px)
  for (const r of results) {
    if (LEGACY_837_SVGS.has(r.path)) continue;
    assert.equal(r.viewBox[2], 720, `${r.path}: v2 SVG viewBox width must be 720`);
    for (const [side, dist] of Object.entries(r.margins)) {
      assert.ok(Math.abs(dist - 8) <= 2, `${r.path}: ${side} margin ${dist.toFixed(1)}px must be within 8±2px`);
    }
    assert.ok(r.minDesignFs >= 15, `${r.path}: v2 SVG min font-size ${r.minDesignFs} < 15 (B - 2)`);
    assert.ok(r.renderedFs720 >= 15, `${r.path}: v2 SVG rendered font-size ${r.renderedFs720} < 15px (B - 2)`);

    const svg = readFileSync(new URL(`../${r.path}`, import.meta.url), 'utf8');
    assert.match(svg, /role="img"/, `${r.path}: missing role="img"`);
    assert.match(svg, /<title>[^<]+<\/title>/, `${r.path}: missing non-empty <title>`);
    assert.match(svg, /<desc>[^<]+<\/desc>/, `${r.path}: missing non-empty <desc>`);
    assert.ok(!/<style[\s>]/i.test(svg), `${r.path}: must not contain <style> block`);
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${r.path}: duplicate id detected`);
  }
});
