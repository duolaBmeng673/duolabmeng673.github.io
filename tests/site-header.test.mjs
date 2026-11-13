import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('header offset follows its measured height without changing header geometry', () => {
  const html = read('dist/index.html');
  const script = [...html.matchAll(/<script\b[^>]*>([^]*?)<\/script>/g)].find(([, code]) => code.includes('const syncHeight'))?.[1];
  assert.ok(script);
  const style = new Map();
  let height = 73, onResize;
  const header = { getBoundingClientRect: () => ({ height }) };
  const document = { querySelector: () => header, documentElement: { style: { setProperty: (key, value) => style.set(key, value) } } };
  class ResizeObserver { constructor(callback) { onResize = callback; } observe(element) { assert.equal(element, header); } }
  runInNewContext(script, { document, window: { ResizeObserver }, ResizeObserver });
  assert.equal(style.get('--header-h'), '73px');
  height = 170.5; onResize();
  assert.equal(style.get('--header-h'), '170.5px');
  const css = read('src/styles/global.css');
  assert.match(css, /\.site-header \{[^}]*position: sticky;[^}]*top: 0;[^}]*z-index: 100;[^}]*background: var\(--bg\)/);
  assert.match(css, /html \{[^}]*scroll-padding-top: var\(--header-h\)/);
});
