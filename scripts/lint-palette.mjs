#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCAN_EXTS = new Set(['.css', '.ts', '.tsx', '.astro', '.mjs', '.js', '.svg']);
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.astro', '.git', 'content']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (IGNORE_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (SCAN_EXTS.has(extname(name))) out.push(full);
  }
  return out;
}

function rgbToHsl(r, g, b) {
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
}

function isDisallowedPurple(r, g, b) {
  const [h, s] = rgbToHsl(r, g, b);
  return h >= 255 && h <= 300 && s > 0.2;
}

// Explicitly approved homepage-stage `all` (Dusk) preset violet literals only.
// Purple remains strictly forbidden across global accents, headers, subpages, heatmaps, and SVGs.
const STAGE_ALL_ALLOWLIST = new Map([
  ['src/lib/palette.ts', new Set(['#7c68b8', '#9480cf', '#9c88d8', '#b8a6eb', '#5227ff', '#c084fc', '#f3e8ff'])],
  ['src/styles/tokens.css', new Set(['#7c68b8', '#9480cf', '#9c88d8', '#b8a6eb'])],
  ['src/components/islands/GradientWaves.island.tsx', new Set(['#5227ff', '#c084fc', '#f3e8ff'])],
]);

export function scanForPurple(rootDir = ROOT) {
  const files = [
    ...walk(join(rootDir, 'src')),
    ...readdirSync(join(rootDir, 'public'))
      .filter((f) => f.endsWith('.svg'))
      .map((f) => join(rootDir, 'public', f)),
  ];
  const violations = [];
  const hexRe = /#([0-9a-fA-F]{6})\b/g;
  const rgbRe = /rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})/g;

  for (const file of files) {
    const rel = relative(rootDir, file);
    const allowed = STAGE_ALL_ALLOWLIST.get(rel);
    const text = readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      for (const m of line.matchAll(hexRe)) {
        const hex = m[1];
        const lower = `#${hex.toLowerCase()}`;
        if (allowed?.has(lower)) continue;
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        if (isDisallowedPurple(r, g, b)) {
          const [h, s] = rgbToHsl(r, g, b);
          violations.push({
            file: rel,
            line: i + 1,
            literal: `#${hex}`,
            hue: Math.round(h),
            sat: Number(s.toFixed(2)),
          });
        }
      }
      for (const m of line.matchAll(rgbRe)) {
        const r = Number(m[1]);
        const g = Number(m[2]);
        const b = Number(m[3]);
        if (r <= 255 && g <= 255 && b <= 255 && isDisallowedPurple(r, g, b)) {
          const [h, s] = rgbToHsl(r, g, b);
          violations.push({
            file: rel,
            line: i + 1,
            literal: `rgb(${r},${g},${b})`,
            hue: Math.round(h),
            sat: Number(s.toFixed(2)),
          });
        }
      }
    }
  }
  return violations;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const violations = scanForPurple();
  if (violations.length > 0) {
    console.error(`Found ${violations.length} disallowed purple color literal(s) (hue 255°-300°, sat > 0.2):`);
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}  ${v.literal}  (H=${v.hue}°, S=${v.sat})`);
    }
    process.exit(1);
  }
  console.log('Palette lint passed: 0 disallowed purple literals across src/ and public/*.svg.');
}
