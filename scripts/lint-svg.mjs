#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function findSvgs(dirPath) {
  const out = [];
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const full = join(dirPath, entry.name);
    if (entry.isDirectory()) out.push(...findSvgs(full));
    else if (entry.name.endsWith('.svg')) out.push(full);
  }
  return out.sort();
}

export const ALL_837_ROOT = 'src/content/837考研';
export const NETWORK_ROOT = 'src/content/837考研/计算机网络';

export const LEGACY_837_SVGS = new Set([]);

export const CHROME_PATH =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export function lintSvgs(files, { quiet = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'svg-lint-'));
  const results = [];
  try {
    let totalViolations = 0;

    for (const relPath of files) {
      const absPath = resolve(relPath);
      const isLegacy = LEGACY_837_SVGS.has(relPath);
      const isNetworkV1 = relPath.includes('计算机网络') || !isLegacy;
      const svgContent = readFileSync(absPath, 'utf8');
      const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { margin: 0; padding: 0; background: transparent; }
  svg { display: block; }
</style>
</head>
<body>
${svgContent}
<pre id="lint-output"></pre>
<script>
(() => {
  const svg = document.querySelector('svg');
  const vb = svg.viewBox.baseVal;
  const vbX = vb.x;
  const vbY = vb.y;
  const W = vb.width;
  const H = vb.height;
  const violations = [];

  const IS_LEGACY = ${JSON.stringify(isLegacy)};
  const MARGIN = IS_LEGACY ? 24 : 8;
  const MARGIN_TOL = 2;
  const PAD_X = 16;
  const PAD_Y = 8;
  const STROKE_DIST = 6;
  const CHECK_V1_LAYOUT = ${JSON.stringify(isNetworkV1)};

  function boxIntersects(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  function pointToBoxDist(px, py, box) {
    const dx = Math.max(box.x - px, 0, px - (box.x + box.width));
    const dy = Math.max(box.y - py, 0, py - (box.y + box.height));
    return Math.hypot(dx, dy);
  }

  function sampleRectPerimeter(rect, step = 2) {
    const pts = [];
    const x1 = rect.x, y1 = rect.y, x2 = rect.x + rect.width, y2 = rect.y + rect.height;
    for (let x = x1; x <= x2; x += step) { pts.push([x, y1], [x, y2]); }
    for (let y = y1; y <= y2; y += step) { pts.push([x1, y], [x2, y]); }
    return pts;
  }

  function sampleCirclePerimeter(cx, cy, r, step = 2) {
    const pts = [];
    const n = Math.max(24, Math.ceil((2 * Math.PI * r) / step));
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return pts;
  }

  function sampleGeometry(el, step = 2) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'rect') return sampleRectPerimeter(el.getBBox(), step);
    if (tag === 'circle') {
      return sampleCirclePerimeter(Number(el.getAttribute('cx')), Number(el.getAttribute('cy')), Number(el.getAttribute('r')), step);
    }
    if (typeof el.getTotalLength === 'function') {
      const len = el.getTotalLength();
      const pts = [];
      for (let d = 0; d <= len; d += step) {
        const p = el.getPointAtLength(d);
        pts.push([p.x, p.y]);
      }
      const end = el.getPointAtLength(len);
      pts.push([end.x, end.y]);
      return pts;
    }
    return [];
  }

  function getRootBox(el, rootCtmInv) {
    const b = el.getBBox();
    const elCtm = el.getScreenCTM();
    if (!elCtm || !rootCtmInv) return b;
    const m = rootCtmInv.multiply(elCtm);
    const pts = [
      [b.x, b.y],
      [b.x + b.width, b.y],
      [b.x, b.y + b.height],
      [b.x + b.width, b.y + b.height],
    ];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [px, py] of pts) {
      const pt = new DOMPoint(px, py).matrixTransform(m);
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  const rootCtmInv = svg.getScreenCTM()?.inverse() || null;

  // Collect elements excluding <defs>
  const allVisible = [...svg.querySelectorAll('text, rect, circle, ellipse, line, path, polyline, polygon')]
    .filter((el) => !el.closest('defs'))
    .filter((el) => el.tagName.toLowerCase() !== 'text' || el.textContent.trim().length > 0);

  // 1. Tight viewBox margin: content bbox to viewBox edges must be 24 +/- 2px
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of allVisible) {
    const b = getRootBox(el, rootCtmInv);
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }

  const margins = {
    left: minX - vbX,
    top: minY - vbY,
    right: (vbX + W) - maxX,
    bottom: (vbY + H) - maxY,
  };
  for (const [side, dist] of Object.entries(margins)) {
    if (Math.abs(dist - MARGIN) > MARGIN_TOL) {
      violations.push({
        rule: 'viewBox-margin',
        detail: side + ' margin is ' + dist.toFixed(1) + 'px (expected ' + MARGIN + '±' + MARGIN_TOL + 'px, viewBox=' + vbX + ' ' + vbY + ' ' + W + ' ' + H + ')',
      });
    }
  }

  const texts = [...svg.querySelectorAll('text')]
    .filter((el) => !el.closest('defs') && el.textContent.trim().length > 0)
    .map((el) => ({
      el,
      text: el.textContent.trim(),
      box: el.getBBox(),
    }));

  let minDesignFs = Infinity;
  for (const el of svg.querySelectorAll('text, tspan')) {
    if (el.closest('defs')) continue;
    const hasDirectText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    if (!hasDirectText) continue;
    const fsPx = parseFloat(getComputedStyle(el).fontSize);
    if (Number.isFinite(fsPx) && fsPx > 0 && fsPx < minDesignFs) {
      minDesignFs = fsPx;
    }
  }
  const renderedFs720 = Number.isFinite(minDesignFs) ? minDesignFs * Math.min(1, 720 / W) : null;
  const warnings = [];
  const checkNewSpec = (rule, ok, detail) => {
    if (ok) return;
    if (IS_LEGACY) warnings.push({ rule, detail });
    else violations.push({ rule, detail });
  };
  checkNewSpec('viewBox-width-720', W === 720, 'viewBox width is ' + W + ' (v2 SVG spec requires 720)');
  if (Number.isFinite(minDesignFs)) {
    const reqFs = IS_LEGACY ? 12 : 15;
    const reqRenderFs = IS_LEGACY ? 10.5 : 15;
    checkNewSpec('min-font-size', minDesignFs >= reqFs, 'min design font-size is ' + minDesignFs + ' (requires >=' + reqFs + ')');
    checkNewSpec('breakout-rendered-font-size', renderedFs720 >= reqRenderFs, 'rendered font-size at 720px break-out is ' + renderedFs720.toFixed(2) + 'px (requires >=' + reqRenderFs + 'px)');
  }

  if (CHECK_V1_LAYOUT) {
    // 2. Pairwise text-text intersection
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        if (boxIntersects(texts[i].box, texts[j].box)) {
          violations.push({
            rule: 'text-overlap',
            detail: '"' + texts[i].text + '" overlaps "' + texts[j].text + '"',
          });
        }
      }
    }

    // Identify shapes (containers/nodes vs stroke lines)
    const shapes = allVisible.filter((el) => el.tagName.toLowerCase() !== 'text').map((el) => {
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute('data-role') || '';
      const stroke = el.getAttribute('stroke');
      const isStroked = stroke && stroke !== 'none';
      const isContainer = (tag === 'rect' || tag === 'circle') && role !== 'activation' && role !== 'label-bg';
      return { el, tag, role, isStroked, isContainer, box: el.getBBox() };
    });

    // 3. Text inside owning container padding & distance to non-owning strokes >= 6
    for (const t of texts) {
      const cx = t.box.x + t.box.width / 2;
      const cy = t.box.y + t.box.height / 2;

      const enclosing = shapes.filter((s) =>
        s.isContainer &&
        cx >= s.box.x && cx <= s.box.x + s.box.width &&
        cy >= s.box.y && cy <= s.box.y + s.box.height
      );
      enclosing.sort((a, b) => (a.box.width * a.box.height) - (b.box.width * b.box.height));
      const owner = enclosing[0] || null;
      const ownerSet = new Set(enclosing.map((s) => s.el));

      if (owner && owner.tag === 'rect' && owner.role !== 'group' && owner.role !== 'note') {
        const left = t.box.x - owner.box.x;
        const right = (owner.box.x + owner.box.width) - (t.box.x + t.box.width);
        const top = t.box.y - owner.box.y;
        const bottom = (owner.box.y + owner.box.height) - (t.box.y + t.box.height);
        if (left < PAD_X - 0.5 || right < PAD_X - 0.5 || top < PAD_Y - 0.5 || bottom < PAD_Y - 0.5) {
          violations.push({
            rule: 'node-padding',
            detail: 'text "' + t.text + '" padding L=' + left.toFixed(1) + ' R=' + right.toFixed(1) + ' T=' + top.toFixed(1) + ' B=' + bottom.toFixed(1) + ' (need LR>=16, TB>=8)',
          });
        }
      }

      for (const s of shapes) {
        if (!s.isStroked) continue;
        if (ownerSet.has(s.el)) continue;
        if (s.role === 'label-bg') continue;
        const pts = sampleGeometry(s.el, 2);
        let minDist = Infinity;
        for (const [px, py] of pts) {
          const d = pointToBoxDist(px, py, t.box);
          if (d < minDist) minDist = d;
        }
        if (minDist < STROKE_DIST - 0.2) {
          violations.push({
            rule: 'stroke-clearance',
            detail: 'text "' + t.text + '" is ' + minDist.toFixed(1) + 'px from non-owning ' + s.tag + (s.role ? '[' + s.role + ']' : '') + ' (need >=6)',
          });
        }
      }
    }
  }

  document.getElementById('lint-output').textContent = JSON.stringify({
    viewBox: [vbX, vbY, W, H],
    margins,
    minDesignFs: Number.isFinite(minDesignFs) ? minDesignFs : null,
    renderedFs720,
    textCount: texts.length,
    violations,
    warnings,
  });
})();
</script>
</body>
</html>`;

      const htmlPath = join(dir, 'check.html');
      writeFileSync(htmlPath, html, 'utf8');

      const profileDir = join(dir, 'profile');
      const dom = execFileSync(
        CHROME_PATH,
        ['--headless=new', '--disable-gpu', '--no-sandbox', `--user-data-dir=${profileDir}`, '--dump-dom', `file://${htmlPath}`],
        { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: 15000, stdio: ['ignore', 'pipe', 'ignore'] },
      );

      const match = dom.match(/<pre id="lint-output">([\s\S]*?)<\/pre>/);
      if (!match) {
        if (!quiet) console.error(`[FAIL] ${relPath}: unable to read lint output from headless Chrome`);
        totalViolations++;
        results.push({ path: relPath, violations: [{ rule: 'chrome-error', detail: 'unable to read lint output' }] });
        continue;
      }
      const decoded = match[1]
        .replaceAll('&quot;', '"')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&amp;', '&');
      const report = JSON.parse(decoded);
      const count = report.violations.length;
      totalViolations += count;
      results.push({ path: relPath, ...report });

      if (!quiet) {
        const warnSuffix = report.warnings?.length ? ` [${report.warnings.length} legacy warnings]` : '';
        if (count === 0) {
          console.log(`[PASS] ${relPath} (viewBox ${report.viewBox.join(' ')}, ${report.textCount} texts, 0 violations)${warnSuffix}`);
        } else {
          console.log(`[FAIL] ${relPath} (${count} violations):`);
          for (const v of report.violations) {
            console.log(`  - [${v.rule}] ${v.detail}`);
          }
        }
        for (const w of report.warnings ?? []) {
          console.log(`  [WARN legacy] [${w.rule}] ${w.detail}`);
        }
      }
    }

    return { totalViolations, results };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const files = args.length > 0 ? args : findSvgs(ALL_837_ROOT);
  const { totalViolations } = lintSvgs(files);
  if (totalViolations > 0) {
    process.exitCode = 1;
  }
}
