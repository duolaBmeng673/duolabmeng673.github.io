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

test('desktop header across all pages stays always visible at top: 12px and switches to 12px sheer glass frame at scrollY >= 8', () => {
  for (const page of ['home', 'subpage']) {
    const callbacks = {}, mediaListeners = [];
    const root = { dataset: {}, scrollHeight: 4000 };
    const classes = new Set();
    let frame;
    const media = {
      matches: true,
      addEventListener: (_type, cb) => mediaListeners.push(cb),
    };
    const header = {
      dataset: { page },
      classList: { toggle: (name, force) => (force ? classes.add(name) : classes.delete(name)) },
      contains: () => false,
      querySelector: () => null,
      getBoundingClientRect: () => ({ height: 50 }),
      addEventListener: () => {},
    };
    const window = {
      scrollY: 0,
      innerHeight: 900,
      matchMedia: (q) => (q.includes('1024px') ? media : { matches: false }),
      addEventListener: (event, callback) => { callbacks[event] = callback; },
    };
    const document = { documentElement: root, activeElement: null, querySelector: () => header };
    const script = ts.transpileModule(read('src/scripts/site-header.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    runInNewContext(script, { document, window, exports: {}, requestAnimationFrame: (callback) => { frame = callback; } });
    const scroll = (y) => { window.scrollY = y; callbacks.scroll(); frame(); };

    scroll(6);
    assert.equal(classes.has('is-scrolled'), false, `${page}: scrollY < 8 stays flat`);
    assert.equal(root.dataset.headerHidden, undefined);

    scroll(500);
    assert.equal(classes.has('is-scrolled'), true, `${page}: scrollY >= 8 activates 12px sheer glass frame`);
    assert.equal(root.dataset.headerHidden, undefined, `${page}: desktop header never hides on scroll down`);

    scroll(0);
    assert.equal(classes.has('is-scrolled'), false, `${page}: scrolling back to top restores flat resting frame`);

    media.matches = false;
    mediaListeners.forEach((cb) => cb());
    scroll(500);
    assert.equal(root.dataset.headerHidden, 'true', `${page}: mobile (<1024px) hides header on downscroll`);

    media.matches = true;
    mediaListeners.forEach((cb) => cb());
    assert.equal(root.dataset.headerHidden, undefined, `${page}: crossing back to desktop reveals header`);
  }

  const css = read('src/styles/global.css');
  assert.match(css, /@media \(min-width: 1024px\) and \(hover: hover\) and \(pointer: fine\) \{[^]*?body \.site-header \{[^}]*top: 12px;[^}]*\}[^]*?body \.site-header\.is-scrolled \.header-inner \{[^}]*min-height:\s*3\.15rem;[^}]*border-radius:\s*12px;[^}]*backdrop-filter:\s*blur\(12px\)\s*saturate\(140%\);[^}]*box-shadow:\s*none;/);
  assert.match(read('docs/frontend-conventions.md'), /top: 12px/);
  assert.match(read('dist/index.html'), /<header\b[^>]*class="site-header"[^>]*data-page="home"/);
  assert.match(read('dist/blog/index.html'), /<header\b[^>]*class="site-header"[^>]*data-page="subpage"/);
});

test('sticky lower dock auto-hides on downscroll once stuck and reveals on upscroll, top return, focus, or explicit reveal', () => {
  const winHandlers = {}, barHandlers = {}, barClasses = new Set();
  const root = { scrollHeight: 4000 };
  let focused = false, frame;
  const bar = {
    dataset: {},
    classList: { toggle: (name, force) => (force ? barClasses.add(name) : barClasses.delete(name)) },
    contains: () => focused,
    addEventListener: (ev, cb) => { barHandlers[ev] = cb; },
  };
  const window = {
    scrollY: 0,
    innerHeight: 900,
    matchMedia: () => ({ matches: true, addEventListener: () => {} }),
    addEventListener: (ev, cb) => { winHandlers[ev] = cb; },
  };
  const sentinel = { getBoundingClientRect: () => ({ top: 200 - window.scrollY }) };
  const document = { documentElement: root, activeElement: null };
  const src = ts.transpileModule(read('src/lib/sticky-dock.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  runInNewContext(src, {
    document,
    window,
    getComputedStyle: () => ({ top: '70px' }),
    requestAnimationFrame: (cb) => { frame = cb; },
    exports: mod.exports,
    module: mod,
  });
  const dock = mod.exports.bindStickyAutoHide({ bar, sentinel });
  const scroll = (y) => { window.scrollY = y; winHandlers.scroll(); frame(); };

  scroll(100);
  assert.equal(barClasses.has('is-stuck'), false);
  assert.equal(bar.dataset.dockHidden, undefined, 'above sticky threshold stays visible');

  scroll(220);
  assert.equal(barClasses.has('is-stuck'), true);
  assert.equal(bar.dataset.dockHidden, 'true', 'downscroll hides stuck lower dock');

  scroll(215);
  assert.equal(bar.dataset.dockHidden, 'true', 'sub-12px reverse jitter does not flicker');

  scroll(195);
  assert.equal(bar.dataset.dockHidden, undefined, 'upscroll >= 12px reveals dock');

  scroll(400);
  assert.equal(bar.dataset.dockHidden, 'true');
  focused = true; barHandlers.focusin();
  assert.equal(bar.dataset.dockHidden, undefined, 'focus inside dock reveals it');
  scroll(500);
  assert.equal(bar.dataset.dockHidden, undefined, 'focus pins dock open while scrolling');

  focused = false;
  scroll(700);
  assert.equal(bar.dataset.dockHidden, 'true');
  dock.reveal();
  assert.equal(bar.dataset.dockHidden, undefined, 'interaction reveal() keeps dock accessible');

  scroll(3200); scroll(3240); scroll(3220);
  assert.equal(bar.dataset.dockHidden, 'true', 'elastic overscroll bounce does not count as upscroll');
});

test('settings gear popover controls typography, SVG scrim, persistence, fallback and keyboard Esc', () => {
  const html = read('dist/index.html');
  assert.match(html, /<details class="type-settings">\s*<summary\b[^>]*aria-expanded="false"[^>]*>\s*<svg\b/);
  assert.doesNotMatch(html, /<details class="type-settings">[^]*?<summary[^>]*>Aa<\/summary>/);
  assert.match(html, /<button\b[^>]*role="switch"[^>]*aria-checked="false"[^>]*data-font-bold/);
  assert.match(html, /<button\b[^>]*role="switch"[^>]*aria-checked="false"[^>]*data-svg-scrim/);
  assert.match(html, /<button\b[^>]*data-toc-fold="expanded"[^>]*aria-pressed="true">全部展开<\/button>/);
  assert.match(html, /<button\b[^>]*data-toc-fold="collapsed"[^>]*aria-pressed="false">全部折叠<\/button>/);

  const css = read('src/styles/global.css');
  assert.match(css, /\.pill-switch:focus-visible\s*\{/);
  assert.match(css, /max-width:\s*calc\(100vw - 2 \* var\(--gutter\)\)/);

  const headScript = [...html.matchAll(/<script\b[^>]*>([^]*?)<\/script>/g)]
    .find(([, code]) => code.includes('--svg-scrim-opacity'))?.[1];
  assert.ok(headScript, 'inline pre-paint script must restore --svg-scrim-opacity');

  const createHarness = (initialStore = {}, throwStorage = false) => {
    const store = new Map(Object.entries(initialStore));
    const styles = new Map();
    const attrs = new Map();
    const docListeners = new Map();
    let focusedElement = null;

    const makeEl = (extra = {}) => {
      const elAttrs = new Map(Object.entries(extra.attrs ?? {}));
      const listeners = new Map();
      return {
        ...extra,
        dataset: { ...(extra.dataset ?? {}) },
        setAttribute: (k, v) => elAttrs.set(k, String(v)),
        getAttribute: (k) => elAttrs.get(k) ?? null,
        addEventListener: (ev, cb) => {
          if (!listeners.has(ev)) listeners.set(ev, []);
          listeners.get(ev).push(cb);
        },
        dispatch: (ev, payload = {}) => {
          for (const cb of listeners.get(ev) ?? []) cb({ target: extra.selfTarget, ...payload });
        },
        focus: () => { focusedElement = extra.name ?? 'focused'; },
        click() { this.dispatch('click'); },
      };
    };

    const summary = makeEl({ name: 'summary', attrs: { 'aria-expanded': 'false' } });
    const boldBtn = makeEl({ attrs: { role: 'switch', 'aria-checked': 'false' } });
    const scrimBtn = makeEl({ attrs: { role: 'switch', 'aria-checked': 'false' } });
    const sizeBtns = ['small', 'medium', 'large'].map((size) =>
      makeEl({ dataset: { fontSize: size }, attrs: { 'aria-pressed': 'false' } }),
    );
    const tocFoldBtns = ['expanded', 'collapsed'].map((mode) =>
      makeEl({ dataset: { tocFold: mode }, attrs: { 'aria-pressed': String(mode === 'expanded') } }),
    );
    const panel = makeEl({ open: false });
    panel.contains = (node) => node === panel || node === boldBtn || node === scrimBtn;
    panel.querySelector = (sel) => (sel === 'summary' ? summary : null);

    const root = {
      dataset: { themeMode: 'system' },
      style: {
        setProperty: (k, v) => styles.set(k, v),
        getPropertyValue: (k) => styles.get(k) ?? '',
      },
      setAttribute: (name, value) => attrs.set(name, String(value)),
      toggleAttribute: (name, force) => {
        if (force) attrs.set(name, '');
        else attrs.delete(name);
      },
      hasAttribute: (name) => attrs.has(name),
    };

    const localStorage = {
      getItem: (k) => {
        if (throwStorage) throw new Error('SecurityError');
        return store.has(k) ? store.get(k) : null;
      },
      setItem: (k, v) => {
        if (throwStorage) throw new Error('SecurityError');
        store.set(k, String(v));
      },
    };

    const document = {
      documentElement: root,
      querySelectorAll: (sel) => {
        if (sel === '[data-font-size]') return sizeBtns;
        if (sel === '[data-toc-fold]') return tocFoldBtns;
        return [];
      },
      querySelector: (sel) => {
        if (sel === '[data-font-bold]') return boldBtn;
        if (sel === '[data-svg-scrim]') return scrimBtn;
        if (sel === '.type-settings') return panel;
        return null;
      },
      addEventListener: (ev, cb) => {
        if (!docListeners.has(ev)) docListeners.set(ev, []);
        docListeners.get(ev).push(cb);
      },
    };

    const storageKeysSrc = ts.transpileModule(read('src/lib/storage-keys.ts'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const storageExports = {};
    runInNewContext(storageKeysSrc, { exports: storageExports });

    const scriptSrc = ts.transpileModule(read('src/scripts/typography.ts'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;

    const matchMedia = () => ({ matches: false, addEventListener: () => {} });
    runInNewContext(scriptSrc, {
      document,
      localStorage,
      matchMedia,
      navigator: { userAgent: 'Mozilla/5.0' },
      exports: {},
      require: (id) => (id.includes('storage-keys') ? storageExports : {}),
    });

    const emitDoc = (ev, payload) => {
      for (const cb of docListeners.get(ev) ?? []) cb(payload);
    };

    return {
      store,
      styles,
      root,
      summary,
      boldBtn,
      scrimBtn,
      sizeBtns,
      tocFoldBtns,
      panel,
      emitDoc,
      getFocused: () => focusedElement,
      runHead: () => runInNewContext(headScript, { document, localStorage, matchMedia }),
    };
  };

  // 1. Toggle all three settings and verify DOM + localStorage persistence
  const session1 = createHarness();
  assert.equal(session1.styles.get('--svg-scrim-opacity'), '0');
  assert.equal(session1.scrimBtn.getAttribute('aria-checked'), 'false');
  assert.equal(session1.boldBtn.getAttribute('aria-checked'), 'false');

  session1.sizeBtns[2].click(); // large
  session1.boldBtn.click();
  session1.scrimBtn.click();
  session1.tocFoldBtns[1].click(); // collapsed

  assert.equal(session1.styles.get('--font-scale'), '1.12');
  assert.equal(session1.sizeBtns[2].getAttribute('aria-pressed'), 'true');
  assert.equal(session1.root.hasAttribute('data-font-bold'), true);
  assert.equal(session1.boldBtn.getAttribute('aria-checked'), 'true');
  assert.equal(session1.styles.get('--svg-scrim-opacity'), '0.8');
  assert.equal(session1.scrimBtn.getAttribute('aria-checked'), 'true');
  assert.equal(session1.root.hasAttribute('data-toc-collapsed'), true);
  assert.equal(session1.tocFoldBtns[1].getAttribute('aria-pressed'), 'true');
  assert.equal(session1.tocFoldBtns[0].getAttribute('aria-pressed'), 'false');

  // 2. Reload with persisted storage: inline head script restores before paint & module syncs controls
  const persisted = Object.fromEntries(session1.store.entries());
  const session2 = createHarness(persisted);
  session2.styles.clear();
  session2.root.toggleAttribute('data-font-bold', false);
  session2.root.toggleAttribute('data-toc-collapsed', false);
  session2.runHead();
  assert.equal(session2.styles.get('--font-scale'), '1.12');
  assert.equal(session2.root.hasAttribute('data-font-bold'), true);
  assert.equal(session2.styles.get('--svg-scrim-opacity'), '0.8');
  assert.equal(session2.root.hasAttribute('data-toc-collapsed'), true);

  // 3. Keyboard Escape closes panel & returns focus to summary; outside click closes panel; toggle syncs aria-expanded
  session2.panel.open = true;
  session2.panel.dispatch('toggle');
  assert.equal(session2.summary.getAttribute('aria-expanded'), 'true');
  session2.emitDoc('keydown', { key: 'Escape' });
  assert.equal(session2.panel.open, false);
  assert.equal(session2.summary.getAttribute('aria-expanded'), 'false');
  assert.equal(session2.getFocused(), 'summary');

  session2.panel.open = true;
  session2.panel.dispatch('toggle');
  session2.emitDoc('click', { target: {} });
  assert.equal(session2.panel.open, false);
  assert.equal(session2.summary.getAttribute('aria-expanded'), 'false');

  // 4. Storage unavailable (incognito / blocked) remains interactive without throwing
  const incognito = createHarness({}, true);
  incognito.runHead();
  incognito.sizeBtns[0].click();
  incognito.boldBtn.click();
  incognito.scrimBtn.click();
  incognito.tocFoldBtns[1].click();
  assert.equal(incognito.styles.get('--font-scale'), '0.94');
  assert.equal(incognito.root.hasAttribute('data-font-bold'), true);
  assert.equal(incognito.styles.get('--svg-scrim-opacity'), '0.8');
  assert.equal(incognito.root.hasAttribute('data-toc-collapsed'), true);
});
