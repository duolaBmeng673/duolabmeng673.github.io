import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import {
  detectIsMac,
  getShortcutLabels,
  matchesJumpShortcut,
  matchesSearchShortcut,
} from '../src/lib/platform-shortcuts.ts';

const loadPlatformShortcuts = () => {
  const src = ts.transpileModule(
    readFileSync(new URL('../src/lib/platform-shortcuts.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const mod = { exports: {} };
  runInNewContext(src, { exports: mod.exports, module: mod });
  return mod.exports;
};

test('search keeps native candidate links alive across null focus transitions and pending index loads', async () => {
  const script = ts.transpileModule(readFileSync(new URL('../src/scripts/site-search.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  class Element {
    constructor(tag = 'div') { this.tag = tag; this.children = []; this.handlers = {}; this.dataset = {}; this.attrs = {}; this.value = ''; }
    addEventListener(name, fn) { this.handlers[name] = fn; }
    setAttribute(name, value) { this.attrs[name] = value; }
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
    replaceChildren() { this.children.forEach((child) => { child.parent = null; }); this.children = []; }
    contains(node) { return node === this || this.children.some((child) => child.contains(node)); }
    querySelectorAll() { return this.children.flatMap((node) => [...(node.className === 'search-result' ? [node] : []), ...node.querySelectorAll()]); }
    focus() { document.activeElement = this; }
  }
  const shell = new Element(), input = new Element('input'), popover = new Element(), results = new Element('ul'), status = new Element(), all = new Element('a');
  shell.append(input, popover); popover.append(status, results, all);
  const elements = { '[data-search-shell]': shell, '[data-search-input]': input, '[data-search-popover]': popover, '[data-search-results]': results, '[data-search-status]': status, '[data-search-all]': all };
  const document = { activeElement: input, handlers: {}, querySelector: (selector) => elements[selector], createElement: (tag) => new Element(tag), addEventListener(name, fn) { this.handlers[name] = fn; } };
  const record = { title: 'Kerberos', href: '/study-notes/837/symmetric-authentication-kerberos/', category: 'Study Notes', series: 'HIT 837', date: '2026-11-03' };
  let resolve;
  let pending = new Promise((done) => { resolve = done; });
  const search = { rankSearch: () => [record], searchSnippet: () => '认证流程', loadSearchIndex: () => pending };
  const platformShortcuts = loadPlatformShortcuts();
  runInNewContext(script, {
    document,
    URLSearchParams,
    navigator: { platform: 'Win32', userAgent: 'Mozilla/5.0 (Windows NT 10.0)' },
    exports: {},
    require: (id) => (id.includes('platform-shortcuts') ? platformShortcuts : search),
  });
  input.value = 'Kerberos'; input.handlers.input();
  resolve([record]); await new Promise(setImmediate);
  const link = results.children[0].children[0];
  assert.equal(link.tag, 'a'); assert.equal(link.href, record.href);
  assert.equal(popover.hidden, false);
  shell.handlers.focusout({ relatedTarget: null });
  assert.equal(popover.hidden, false, 'null focusout must not hide the target before click');
  shell.handlers.focusout({ relatedTarget: link });
  assert.equal(popover.hidden, false);
  let prevented = false;
  document.handlers.keydown({ key: 'ArrowDown', target: input, preventDefault() { prevented = true; } });
  assert.equal(document.activeElement, link); assert.equal(prevented, true);
  document.handlers.click({ target: link, preventDefault() { throw new Error('native navigation must not be intercepted'); } });
  assert.equal(popover.hidden, false);
  input.focus();
  pending = new Promise((done) => { resolve = done; });
  input.handlers.focus(); link.focus(); resolve([record]); await new Promise(setImmediate);
  assert.equal(results.children[0].children[0], link, 'async refresh must not replace the focused result');
  document.handlers.keydown({ key: 'Escape', target: link, preventDefault() {} });
  assert.equal(popover.hidden, true); assert.equal(document.activeElement, input);
  input.handlers.input(); await new Promise(setImmediate);
  assert.equal(popover.hidden, false);
  document.handlers.focusin({ target: new Element('button') });
  assert.equal(popover.hidden, true, 'keyboard focus outside still closes candidates');
});

test('platform shortcut detection, labels, event.code matching, and pre-paint HTML adapt per OS', () => {
  assert.equal(detectIsMac({ userAgentData: { platform: 'macOS' }, platform: 'Win32' }), true);
  assert.equal(detectIsMac({ userAgentData: { platform: 'Windows' }, platform: 'MacIntel' }), false);
  assert.equal(detectIsMac({ platform: 'MacIntel', userAgent: 'Mozilla/5.0' }), true);
  assert.equal(detectIsMac({ platform: 'Linux x86_64', userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' }), false);
  assert.equal(detectIsMac({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)' }), true);
  assert.equal(detectIsMac({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64)' }), false);

  assert.deepEqual(getShortcutLabels(true), { search: '⌘ K', jump: '⌥ J', jumpTitle: '快捷键 ⌥ J' });
  assert.deepEqual(getShortcutLabels(false), { search: 'Ctrl K', jump: 'Alt J', jumpTitle: '快捷键 Alt + J' });

  assert.equal(matchesSearchShortcut({ code: 'KeyK', key: '˚', metaKey: true }, true), true);
  assert.equal(matchesSearchShortcut({ code: 'KeyK', key: 'k', ctrlKey: true }, true), false);
  assert.equal(matchesSearchShortcut({ code: 'KeyK', key: 'л', ctrlKey: true }, false), true);
  assert.equal(matchesSearchShortcut({ code: 'KeyK', key: 'k', metaKey: true }, false), false);
  assert.equal(matchesSearchShortcut({ code: 'KeyK', key: 'k', metaKey: true, altKey: true }, true), false);

  assert.equal(matchesJumpShortcut({ code: 'KeyJ', key: '∆', altKey: true }), true);
  assert.equal(matchesJumpShortcut({ code: 'KeyJ', key: 'j', altKey: true, shiftKey: true }), false);
  assert.equal(matchesJumpShortcut({ code: 'KeyJ', key: 'j', ctrlKey: true }), false);

  const script = ts.transpileModule(
    readFileSync(new URL('../src/scripts/site-search.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const platformShortcuts = loadPlatformShortcuts();
  for (const scenario of [
    { name: 'mac', navigator: { userAgentData: { platform: 'macOS' } }, accept: { code: 'KeyK', key: '˚', metaKey: true }, reject: { code: 'KeyK', key: 'k', ctrlKey: true } },
    { name: 'win', navigator: { platform: 'Win32' }, accept: { code: 'KeyK', key: 'л', ctrlKey: true }, reject: { code: 'KeyK', key: 'k', metaKey: true } },
  ]) {
    let focused = false;
    let prevented = false;
    const handlers = {};
    const input = { addEventListener() {}, focus() { focused = true; }, setAttribute() {}, value: '' };
    const document = { activeElement: null, querySelector: (sel) => (sel === '[data-search-input]' ? input : null), addEventListener: (ev, cb) => { handlers[ev] = cb; } };
    runInNewContext(script, {
      document,
      URLSearchParams,
      navigator: scenario.navigator,
      exports: {},
      require: (id) => (id.includes('platform-shortcuts') ? platformShortcuts : { rankSearch: () => [], searchSnippet: () => '', loadSearchIndex: async () => [] }),
    });
    handlers.keydown({ ...scenario.reject, preventDefault() { prevented = true; } });
    assert.equal(focused, false, `${scenario.name} must ignore wrong modifier`);
    handlers.keydown({ ...scenario.accept, preventDefault() { prevented = true; } });
    assert.equal(focused, true, `${scenario.name} must focus search input via event.code KeyK`);
    assert.equal(prevented, true);
  }

  const homeHtml = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  const studyHtml = readFileSync(new URL('../dist/study-notes/837/symmetric-key-cryptography-des/index.html', import.meta.url), 'utf8');
  assert.match(homeHtml, /dataset\.platform\s*=\s*\/Mac/);
  assert.match(homeHtml, /data-search-shortcut\s+data-shortcut-kind="search"/);
  assert.doesNotMatch(homeHtml, /Cmd K/);
  assert.match(studyHtml, /data-jump-shortcut\s+data-shortcut-kind="jump"/);
});

test('mobile search icon button toggles search drawer and restores focus on Escape', () => {
  const script = ts.transpileModule(
    readFileSync(new URL('../src/scripts/site-search.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;

  class Element {
    constructor(tag = 'div') { this.tag = tag; this.children = []; this.handlers = {}; this.dataset = {}; this.attrs = {}; this.value = ''; }
    addEventListener(name, fn) { this.handlers[name] = fn; }
    setAttribute(name, value) { this.attrs[name] = value; }
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
    replaceChildren() { this.children.forEach((child) => { child.parent = null; }); this.children = []; }
    contains(node) { return node === this || this.children.some((child) => child.contains(node)); }
    querySelectorAll() { return []; }
    focus() { document.activeElement = this; }
  }

  const shell = new Element(), trigger = new Element('button'), input = new Element('input'), popover = new Element(), results = new Element('ul'), status = new Element(), all = new Element('a');
  shell.append(trigger, input, popover); popover.append(status, results, all);
  const elements = {
    '[data-search-shell]': shell,
    '[data-search-trigger]': trigger,
    '[data-search-input]': input,
    '[data-search-popover]': popover,
    '[data-search-results]': results,
    '[data-search-status]': status,
    '[data-search-all]': all,
  };
  const document = { activeElement: null, handlers: {}, querySelector: (selector) => elements[selector], createElement: (tag) => new Element(tag), addEventListener(name, fn) { this.handlers[name] = fn; } };
  const platformShortcuts = loadPlatformShortcuts();

  runInNewContext(script, {
    document,
    URLSearchParams,
    navigator: { platform: 'Linux', userAgent: 'Mozilla/5.0' },
    exports: {},
    require: (id) => (id.includes('platform-shortcuts') ? platformShortcuts : { rankSearch: () => [], searchSnippet: () => '', loadSearchIndex: async () => [] }),
  });

  trigger.handlers.click();
  assert.equal(shell.dataset.mobileSearchOpen, 'true');
  assert.equal(trigger.attrs['aria-expanded'], 'true');
  assert.equal(popover.hidden, false);
  assert.equal(document.activeElement, input);

  document.handlers.keydown({ key: 'Escape', target: input, preventDefault() {} });
  assert.equal(shell.dataset.mobileSearchOpen, undefined);
  assert.equal(trigger.attrs['aria-expanded'], 'false');
  assert.equal(popover.hidden, true);
  assert.equal(document.activeElement, trigger);
});
