import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
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

test('reading down hides the header, reading up reveals it, and focus or open settings keep it available', () => {
  const callbacks = {}, headerEvents = {};
  const root = { dataset: {}, scrollHeight: 4000 };
  let focused = false, settingsOpen = false, frame;
  const header = {
    contains: () => focused,
    querySelector: () => settingsOpen ? {} : null,
    getBoundingClientRect: () => ({ height: 73 }),
    addEventListener: (event, callback) => { headerEvents[event] = callback; },
  };
  const window = { scrollY: 0, innerHeight: 800, addEventListener: (event, callback) => { callbacks[event] = callback; } };
  const document = { documentElement: root, activeElement: null, querySelector: () => header };
  const script = ts.transpileModule(read('src/scripts/site-header.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(script, { document, window, exports: {}, requestAnimationFrame: (callback) => { frame = callback; } });
  const scroll = (y) => { window.scrollY = y; callbacks.scroll(); frame(); };
  scroll(50); assert.equal(root.dataset.headerHidden, undefined, 'page top stays visible');
  scroll(500); assert.equal(root.dataset.headerHidden, 'true');
  scroll(497); scroll(499); assert.equal(root.dataset.headerHidden, 'true', 'small reversals do not flicker');
  scroll(480); assert.equal(root.dataset.headerHidden, undefined);
  scroll(700); assert.equal(root.dataset.headerHidden, 'true');
  focused = true; headerEvents.focusin(); assert.equal(root.dataset.headerHidden, undefined);
  scroll(800); assert.equal(root.dataset.headerHidden, undefined, 'search and keyboard focus stay usable');
  focused = false; settingsOpen = true; scroll(900); assert.equal(root.dataset.headerHidden, undefined);
  settingsOpen = false; scroll(1100); assert.equal(root.dataset.headerHidden, 'true');
  scroll(3200); scroll(3240); scroll(3220); assert.equal(root.dataset.headerHidden, 'true', 'bottom bounce is not a scroll-up gesture');
  scroll(3170); assert.equal(root.dataset.headerHidden, undefined);
  scroll(-30); assert.equal(root.dataset.headerHidden, undefined, 'top bounce remains visible');
  scroll(1000); callbacks.pageshow(); assert.equal(root.dataset.headerHidden, undefined, 'back/forward restores an accessible header');
});
