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
    /(?:documentElement|body)\s*\.\s*(?:classList\s*\.\s*(?:add|remove|toggle|replace)|classList\s*=|dataset\b\s*(?:\[[^\]]+\]|\.[A-Za-z0-9_$]+)?\s*=|delete\s+(?:document\.)?(?:documentElement|body)\s*\.\s*dataset)/,
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
      assert.ok(!reactChunkNameRe.test(src), `Non-homepage must not load React runtime script (${src}): ${rel}`);
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

test('duolabmeng673 localStorage key strings appear only in src/lib/storage-keys.ts', () => {
  const canonical = join(ROOT, 'src', 'lib', 'storage-keys.ts');
  const srcFiles = walk(join(ROOT, 'src')).filter((file) => /\.(ts|tsx|js|jsx|mjs|astro)$/.test(file));
  const keyLiteralRe = /['"`]duolabmeng673:[^'"`]+['"`]/g;
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
