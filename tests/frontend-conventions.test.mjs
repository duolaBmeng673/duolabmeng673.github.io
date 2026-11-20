import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

test('React imports are strictly confined to src/components/islands/', () => {
  const srcFiles = walk(join(ROOT, 'src')).filter((file) => /\.(ts|tsx|js|jsx|mjs|astro)$/.test(file));
  const islandsDir = join(ROOT, 'src', 'components', 'islands') + '/';
  const reactImport = /(?:import\s+[^;]*?\s+from\s+|import\s*\(|require\s*\()\s*['"]react(?:-dom)?(?:\/[^'"]*)?['"]/g;

  for (const file of srcFiles) {
    if (file.startsWith(islandsDir)) continue;
    const content = readFileSync(file, 'utf8');
    const matches = content.match(reactImport);
    assert.equal(matches, null, `Disallowed React import outside src/components/islands/: ${relative(ROOT, file)} -> ${matches}`);
  }
});

test('islands do not mutate global documentElement/body state or touch localStorage', () => {
  const islandsDir = join(ROOT, 'src', 'components', 'islands');
  let files = [];
  try {
    files = walk(islandsDir).filter((file) => /\.island\.tsx$/.test(file));
  } catch {
    files = [];
  }
  const forbidden = [
    /\blocalStorage\b/,
    /documentElement\s*\.\s*setAttribute\b/,
    /documentElement\s*\.\s*style\s*\.\s*setProperty\b/,
    /(?:documentElement|body)\s*\.\s*(?:classList\s*\.\s*(?:add|remove|toggle|replace)|classList\s*=(?!=)|dataset\b\s*(?:\[[^\]]+\]|\.[A-Za-z0-9_$]+)?\s*=(?!=)|delete\s+(?:document\.)?(?:documentElement|body)\s*\.\s*dataset)/,
  ];
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    for (const pattern of forbidden) {
      assert.equal(
        pattern.test(content),
        false,
        `Island ${relative(ROOT, file)} violates boundary rule (${pattern})`,
      );
    }
  }
});

test('non-homepage built HTML files do not reference any React runtime or island scripts', () => {
  const distDir = join(ROOT, 'dist');
  const htmlFiles = walk(distDir).filter((file) => file.endsWith('.html'));
  assert.ok(htmlFiles.length > 1, 'Expected built HTML pages in dist/');

  const nonHomeHtml = htmlFiles.filter((file) => file !== join(distDir, 'index.html'));
  const scriptSrcRe = /<script\b[^>]*\bsrc="([^"]+)"/gi;
  const reactChunkNameRe = /(?:^|\/)(?:client\.|react(?:-dom)?\.|jsx-runtime\.)[^/]*\.js$/i;
  const reactRuntimeMarkers = ['createRoot', 'hydrateRoot', 'react.production', 'REACT_ELEMENT_TYPE', 'jsxDEV', '@astrojs/react'];

  for (const file of nonHomeHtml) {
    const rel = relative(ROOT, file);
    const html = readFileSync(file, 'utf8');
    assert.ok(!/<astro-island\b/i.test(html), `Non-homepage must not contain <astro-island>: ${rel}`);

    for (const [, src] of html.matchAll(scriptSrcRe)) {
      assert.ok(!reactChunkNameRe.test(src), `Non-approved page must not load React runtime script (${src}): ${rel}`);
      if (src.startsWith('/_astro/')) {
        const assetPath = join(distDir, src);
        const js = readFileSync(assetPath, 'utf8');
        for (const marker of reactRuntimeMarkers) {
          assert.ok(
            !js.includes(marker),
            `Script referenced by ${rel} (${src}) must not bundle React runtime marker "${marker}"`,
          );
        }
      }
    }
  }
});

test('homepage positively mounts expected React islands without client:load', () => {
  const homeHtml = readFileSync(join(ROOT, 'dist', 'index.html'), 'utf8');
  const islands = [...homeHtml.matchAll(/<astro-island\b[^>]*>/gi)].map(([tag]) => tag);
  assert.ok(islands.length >= 3, 'Expected at least 3 <astro-island> elements on homepage');
  const waves = islands.find((tag) => tag.includes('GradientWaves'));
  const heatmap = islands.find((tag) => tag.includes('ActivityHeatmap'));
  const cardSwap = islands.find((tag) => tag.includes('CardSwap'));
  assert.ok(waves && waves.includes('client="idle"'), 'GradientWaves island must use client:idle');
  assert.ok(heatmap && heatmap.includes('client="visible"'), 'ActivityHeatmap island must use client:visible');
  assert.ok(cardSwap && cardSwap.includes('client="visible"'), 'CardSwap island must use client:visible');
  for (const tag of islands) {
    assert.ok(!tag.includes('client="load"'), `Homepage island must not use client:load: ${tag}`);
  }
});

test('duolabmeng673 localStorage key strings appear only in src/lib/storage-keys.ts', () => {
  const canonical = join(ROOT, 'src', 'lib', 'storage-keys.ts');
  const srcFiles = walk(join(ROOT, 'src')).filter((file) => /\.(ts|tsx|js|jsx|mjs|astro)$/.test(file));
  const keyLiteralRe = /['"`]duolabmeng673:(?:theme|typography|preset)(?::[^'"`]*)?['"`]/g;
  const directStorageLiteralRe = /localStorage\.(?:get|set|remove)Item\s*\(\s*['"`]/g;

  const canonicalContent = readFileSync(canonical, 'utf8');
  const definedKeys = canonicalContent.match(keyLiteralRe) ?? [];
  assert.ok(definedKeys.length >= 4, 'storage-keys.ts should define the canonical duolabmeng673:* keys');

  for (const file of srcFiles) {
    if (file === canonical) continue;
    const content = readFileSync(file, 'utf8');
    const found = content.match(keyLiteralRe);
    assert.equal(
      found,
      null,
      `Hardcoded localStorage key string found outside storage-keys.ts in ${relative(ROOT, file)}: ${found}`,
    );
    const directLiteral = content.match(directStorageLiteralRe);
    assert.equal(
      directLiteral,
      null,
      `Direct localStorage literal key access found outside storage-keys.ts in ${relative(ROOT, file)}: ${directLiteral}`,
    );
  }
});

test('homepage total shipped JS stays within 120 KB gzip budget', async () => {
  const { gzipSync } = await import('node:zlib');
  const distDir = join(ROOT, 'dist');
  const homeHtml = readFileSync(join(distDir, 'index.html'), 'utf8');
  const entries = new Set();
  for (const [, src] of homeHtml.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/gi)) {
    if (src.startsWith('/_astro/')) entries.add(src);
  }
  for (const [, url] of homeHtml.matchAll(/\b(?:component|renderer)-url="([^"]+)"/gi)) {
    if (url.startsWith('/_astro/')) entries.add(url);
  }

  const visited = new Set();
  const collectImports = (assetUrl) => {
    if (visited.has(assetUrl)) return;
    visited.add(assetUrl);
    const code = readFileSync(join(distDir, assetUrl), 'utf8');
    for (const [, relImport] of code.matchAll(/(?:from|import)\s*['"](\.[^'"]+\.js)['"]/g)) {
      const next = join('/', '_astro', relImport.replace(/^\.\//, ''));
      collectImports(next);
    }
  };
  for (const entry of entries) collectImports(entry);

  assert.ok(visited.size >= 4, `Expected React + island + page scripts on homepage, got ${visited.size}`);
  let totalGzipBytes = 0;
  for (const asset of visited) {
    totalGzipBytes += gzipSync(readFileSync(join(distDir, asset))).length;
  }
  const budgetBytes = 120 * 1024;
  assert.ok(
    totalGzipBytes <= budgetBytes,
    `Homepage JS gzip total ${(totalGzipBytes / 1024).toFixed(2)} KB exceeds 120 KB budget`,
  );
});

test('ambient-grid uses (hover: none) / (pointer: coarse) media query for non-home static mode and click-only desktop waves', () => {
  const layoutSource = readFileSync(join(ROOT, 'src/layouts/BaseLayout.astro'), 'utf8');
  assert.ok(!layoutSource.includes('data-ambient-static'), 'BaseLayout must not hardcode data-ambient-static for non-homepage routes');

  const gridSource = readFileSync(join(ROOT, 'src/scripts/ambient-grid.ts'), 'utf8');
  assert.match(gridSource, /hover:\s*none|pointer:\s*coarse/, 'ambient-grid must gate non-home static mode via (hover: none) / (pointer: coarse)');
  assert.ok(!gridSource.includes("'pointermove'"), 'ambient-grid must not run mouse-follow hover glow on pointermove');
  assert.ok(gridSource.includes("'pointerdown'"), 'ambient-grid must register pointerdown listener for desktop click waves');
});
