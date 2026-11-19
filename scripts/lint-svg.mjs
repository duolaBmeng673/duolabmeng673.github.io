#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const DEFAULT_FILES = [
  'src/content/837考研/计算机网络/6 链路层/b WIFI/csma-cd-collision-window.svg',
  'src/content/837考研/计算机网络/6 链路层/a ARP/arp-broadcast-unicast.svg',
  'src/content/837考研/计算机网络/6 链路层/b WIFI/wifi-rts-cts-nav.svg',
];

const CHROME_PATH =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const files = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_FILES;

const dir = mkdtempSync(join(tmpdir(), 'svg-lint-'));
try {
  let totalViolations = 0;

  for (const relPath of files) {
    const absPath = resolve(relPath);
    const svgContent = readFileSync(absPath, 'utf8');
    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { margin: 0; padding: 0; background: #fff; }
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
  const W = vb.width;
  const H = vb.height;
  const violations = [];

  const MARGIN = 24;
  const PAD_X = 16;
  const PAD_Y = 8;
  const STROKE_DIST = 6;

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

  // Collect elements excluding <defs>
  const allVisible = [...svg.querySelectorAll('text, rect, circle, ellipse, line, path, polyline, polygon')]
    .filter((el) => !el.closest('defs'));

  // 1. Margin >= 24 from viewBox edges for all visible elements
  for (const el of allVisible) {
    const b = el.getBBox();
    const label = el.tagName.toLowerCase() === 'text'
      ? 'text "' + el.textContent.trim() + '"'
      : el.tagName.toLowerCase() + (el.getAttribute('data-role') ? '[' + el.getAttribute('data-role') + ']' : '');
    if (b.x < MARGIN - 0.5 || b.y < MARGIN - 0.5 || b.x + b.width > W - MARGIN + 0.5 || b.y + b.height > H - MARGIN + 0.5) {
      violations.push({
        rule: 'viewBox-margin',
        detail: label + ' bbox=[' + b.x.toFixed(1) + ',' + b.y.toFixed(1) + ',' + (b.x + b.width).toFixed(1) + ',' + (b.y + b.height).toFixed(1) + '] violates margin 24 in ' + W + 'x' + H,
      });
    }
  }

  const texts = [...svg.querySelectorAll('text')].filter((el) => !el.closest('defs')).map((el) => ({
    el,
    text: el.textContent.trim(),
    box: el.getBBox(),
  }));

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

    // Find all containers that enclose this text's center
    const enclosing = shapes.filter((s) =>
      s.isContainer &&
      cx >= s.box.x && cx <= s.box.x + s.box.width &&
      cy >= s.box.y && cy <= s.box.y + s.box.height
    );
    // Smallest enclosing container is the direct owner (if any)
    enclosing.sort((a, b) => (a.box.width * a.box.height) - (b.box.width * b.box.height));
    const owner = enclosing[0] || null;
    const ownerSet = new Set(enclosing.map((s) => s.el));

    // Check padding inside direct owning node (rect with role !== 'group')
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

    // Check distance to every non-owning stroked element
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

  document.getElementById('lint-output').textContent = JSON.stringify({
    viewBox: [W, H],
    textCount: texts.length,
    violations,
  });
})();
</script>
</body>
</html>`;

    const htmlPath = join(dir, 'check.html');
    writeFileSync(htmlPath, html, 'utf8');

    const dom = execFileSync(
      CHROME_PATH,
      ['--headless=new', '--disable-gpu', '--no-sandbox', '--dump-dom', `file://${htmlPath}`],
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
    );

    const match = dom.match(/<pre id="lint-output">([\s\S]*?)<\/pre>/);
    if (!match) {
      console.error(`[FAIL] ${relPath}: unable to read lint output from headless Chrome`);
      totalViolations++;
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

    if (count === 0) {
      console.log(`[PASS] ${relPath} (viewBox ${report.viewBox.join('x')}, ${report.textCount} texts, 0 violations)`);
    } else {
      console.log(`[FAIL] ${relPath} (${count} violations):`);
      for (const v of report.violations) {
        console.log(`  - [${v.rule}] ${v.detail}`);
      }
    }
  }

  if (totalViolations > 0) {
    process.exitCode = 1;
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
