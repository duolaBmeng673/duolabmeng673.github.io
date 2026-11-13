import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

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
  runInNewContext(script, { document, URLSearchParams, exports: {}, require: () => search });
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
