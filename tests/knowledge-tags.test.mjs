import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { getKnowledgeTags, validateKnowledgeTags, validateKnowledgePosts, knowledgeCategories } from '../src/lib/knowledge-tags.ts';
import * as filtering from '../src/lib/knowledge-filter.ts';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const entries = JSON.parse(read('src/data/knowledge-entries.json'));
const dictionary = JSON.parse(read('src/data/tags.json'));

test('all 35 notes have knowledge points while the eight approved entries and 47 mappings remain exact', () => {
  const approvedIds = ['symmetric-key-cryptography-des', 'public-key-cryptography-dh-rsa', 'hash-functions-principles', 'symmetric-authentication-kerberos', 'public-key-authentication-pki', 'access-control-models', 'windows-authentication-access-control', 'traditional-computer-viruses'];
  const approved = Object.fromEntries(approvedIds.map((id) => [id, entries[id]]));
  const approvedDictionary = Object.fromEntries(Object.values(approved).flatMap((entry) => entry.knowledgeTags.map((name) => [name, dictionary[name]])));
  const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  assert.equal(digest(approved), 'b06a4aa4926edd0cce7d11d90bcab8a69c5bd8bc0283f69d420b2e8c6c7cde36');
  assert.equal(digest(approvedDictionary), 'ca8282f493f0eb920826aad3443049789a11e791f9efcecc09d1efcff7b42574');
  assert.equal(Object.keys(entries).length, 35);
  assert.deepEqual(Object.keys(knowledgeCategories), ['concept', 'algorithm', 'protocol', 'model', 'struct', 'threat', 'defense']);
  for (const entry of Object.values(entries)) {
    assert.ok(entry.knowledgeTags.length > 0);
    assert.equal(new Set(entry.knowledgeTags).size, entry.knowledgeTags.length, 'no repeated label within a note');
  }
  assert.equal(new Set(Object.values(entries).flatMap((entry) => entry.knowledgeTags)).size, Object.keys(dictionary).length);
  const warnings = [];
  validateKnowledgeTags(entries, dictionary, (message) => warnings.push(message));
  assert.deepEqual(warnings, []);
  assert.ok(getKnowledgeTags('security-basics').length > 0);
  assert.deepEqual(getKnowledgeTags('unknown-note'), []);
});

test('chapter-only numbering validates without changing note metadata; missing and mismatched notes fail', () => {
  const posts = Object.entries(entries).map(([id, entry]) => ({ id, data: ['security-basics', 'risk-management'].includes(id) ? { syllabusChapter: entry.section } : { syllabusSection: entry.section, syllabusChapter: 'ignored' } }));
  assert.doesNotThrow(() => validateKnowledgePosts(posts));
  assert.throws(() => validateKnowledgePosts(posts.filter((post) => post.id !== 'security-basics')), /security-basics/);
  assert.throws(() => validateKnowledgePosts(posts.map((post) => post.id === 'risk-management' ? { ...post, data: { syllabusChapter: '01' } } : post)), /risk-management/);
  assert.throws(() => validateKnowledgePosts([]), /未匹配/);
});

test('missing dictionary items fail together, unknown categories fail, unused labels warn', () => {
  const items = { sample: { section: 'x', knowledgeTags: ['缺项 A', '缺项 B', '缺项 A'] } };
  assert.throws(() => validateKnowledgeTags(items, {}), /缺项 A、缺项 B$/);
  assert.throws(() => validateKnowledgeTags(items, { '缺项 A': 'new-category' }), /类别无效/);
  const warnings = [];
  validateKnowledgeTags({}, { unused: 'concept' }, (message) => warnings.push(message));
  assert.deepEqual(warnings, ['tags.json 未使用的知识点标签：unused']);
  assert.throws(() => validateKnowledgeTags({ x: { section: '3.a', knowledgeTags: ['对称 Needham-Schroeder'] } }, dictionary), /缺少知识点标签/);
});

test('knowledge filters use intersection and round-trip exact labels without losing unrelated URL state', () => {
  const selected = new Set(['挑战—应答', '对称 Needham–Schroeder']);
  const href = filtering.writeKnowledgeFilter('https://example.com/study-notes/837/?view=outline#chapter', selected);
  const url = new URL(href, 'https://example.com');
  assert.deepEqual(filtering.readKnowledgeFilter(url.search), selected);
  assert.equal(url.searchParams.get('view'), 'outline');
  assert.equal(url.hash, '#chapter');
  assert.equal(filtering.matchesKnowledgeTags(['挑战—应答'], selected), false);
  assert.equal(filtering.matchesKnowledgeTags([...selected, '票据'], selected), true);
  assert.equal(filtering.matchesKnowledgeTags([], new Set()), true);
  assert.equal(filtering.matchesKnowledgeTags(['ACL'], filtering.readKnowledgeFilter('?tag=unknown')), false);
  assert.equal(filtering.writeKnowledgeFilter('https://example.com/path/?tag=ACL&view=x#y', new Set()), '/path/?view=x#y');
});

test('both modules and every chapter render exact chip labels as siblings of working article links', () => {
  const modules = ['dist/study-notes/837/information-security/index.html', 'dist/study-notes/837/network-security/index.html'];
  const chapters = readdirSync(new URL('../dist/study-notes/837/chapter/', import.meta.url)).map((name) => `dist/study-notes/837/chapter/${name}/index.html`);
  const moduleIds = new Set(), chapterIds = new Set();
  for (const page of [...modules, ...chapters]) {
    const html = read(page);
    assert.equal((html.match(/data-knowledge-category=/g) ?? []).length, page === modules[0] ? 7 : 0);
    const rows = [...html.matchAll(/<li\b[^>]*data-knowledge-entry[^]*?<\/li>/g)].map(([row]) => row);
    assert.ok(rows.length > 0, page);
    if (modules.includes(page)) assert.equal(rows.length, page === modules[0] ? 16 : 19);
    for (const row of rows) {
      const id = row.match(/href="\/study-notes\/837\/([^/]+)\/"/)?.[1];
      assert.ok(entries[id], `configured note: ${id}`);
      const ids = modules.includes(page) ? moduleIds : chapterIds;
      assert.ok(!ids.has(id), `no duplicated note in a directory level: ${id}`);
      ids.add(id);
      const labels = [...row.matchAll(/data-t="([^"]+)"/g)].map((match) => match[1]);
      assert.deepEqual(labels, entries[id].knowledgeTags);
      assert.equal((row.match(/<a\b/g) ?? []).length, 1);
      assert.ok(!/<a\b[^>]*>[^]*?<button[^]*?<\/a>/.test(row), 'no nested interactive controls');
      assert.ok(!row.includes('<small>'), `description replaced: ${id}`);
      assert.ok(!row.includes('undefined'));
      assert.ok(html.includes('data-knowledge-directory'));
    }
  }
  assert.deepEqual([...moduleIds].sort(), Object.keys(entries).sort());
  assert.deepEqual([...chapterIds].sort(), Object.keys(entries).sort());
});

function control(dataset = {}) {
  return { dataset, hidden: false, attrs: {}, handlers: {}, classes: new Set(), textContent: '', focused: false,
    setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(name, fn) { this.handlers[name] = fn; }, focus() { this.focused = true; },
    get classList() { return { toggle: (name, value) => value ? this.classes.add(name) : this.classes.delete(name) }; },
  };
}
test('directory clicks toggle AND filters, legend only dims, clear and browser history restore state', () => {
  const buttons = [control({ t: 'ACL', c: 'struct' }), control({ t: 'RBAC', c: 'model' }), control({ t: 'ACL', c: 'struct' })];
  const rows = [['ACL', 'RBAC'], ['ACL'], []].map((tags) => control({ knowledgeTags: JSON.stringify(tags) }));
  const legends = [control({ knowledgeCategory: 'struct' }), control({ knowledgeCategory: 'model' })];
  const selection = control(), status = control(), empty = control(), clear = control(), controls = control();
  const root = {
    querySelectorAll(selector) { return selector === '[data-knowledge-entry]' ? rows : selector === '[data-t]' ? buttons : selector === '[data-knowledge-category]' ? legends : []; },
    querySelector(selector) { return { '[data-knowledge-selection]': selection, '[data-knowledge-status]': status, '[data-knowledge-empty]': empty, '[data-knowledge-clear]': clear, '[data-knowledge-controls]': controls }[selector]; },
  };
  const location = new URL('https://example.com/study-notes/837/?view=outline#chapter');
  const window = { addEventListener(name, fn) { this[name] = fn; } };
  const history = { pushState(_state, _title, path) { location.href = new URL(path, location).href; } };
  const script = ts.transpileModule(read('src/scripts/knowledge-directory.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(script, { document: { querySelectorAll: () => [root] }, location, window, history, exports: {}, require: () => filtering });
  buttons[0].handlers.click();
  assert.deepEqual(rows.map((row) => row.hidden), [false, false, true]);
  assert.equal(buttons[2].attrs['aria-pressed'], 'true', 'duplicate labels synchronize');
  buttons[1].handlers.click();
  assert.deepEqual(rows.map((row) => row.hidden), [false, true, true]);
  assert.equal(status.textContent, '已选 2 个标签');
  assert.equal(location.searchParams.get('tag'), 'ACL,RBAC');
  legends[0].handlers.click();
  assert.equal(buttons[1].classes.has('is-muted'), true);
  assert.deepEqual(rows.map((row) => row.hidden), [false, true, true]);
  legends[0].handlers.click();
  assert.equal(buttons[1].classes.has('is-muted'), false);
  location.search = '?tag=unknown'; window.popstate();
  assert.equal(empty.hidden, false);
  clear.handlers.click();
  assert.equal(selection.hidden, true);
  assert.deepEqual(rows.map((row) => row.hidden), [false, false, false]);
  assert.equal(legends[0].focused, true);
});

test('only the information-security module renders one legend, with no copied mobile legend or empty placeholders', () => {
  const html = read('dist/study-notes/837/information-security/index.html');
  assert.equal((html.match(/<aside\b[^>]*aria-label="知识点类别图例"/g) ?? []).length, 1);
  assert.equal((html.match(/data-knowledge-category=/g) ?? []).length, 7);
  assert.equal((html.match(/<button\b[^>]*\sdata-knowledge-toggle(?:\s|>)/g) ?? []).length, 1);
  assert.ok(html.includes('aria-controls="knowledge-legend-panel"'));
  assert.ok(!html.includes('class="knowledge-controls"'));
  const container = html.indexOf('class="knowledge-directory"');
  assert.ok(container < html.indexOf('class="page-intro"'), 'legend container starts before the page intro');
  assert.ok(container < html.indexOf('class="study-chapters"'), 'all chapters share the page-level reference');
  assert.match(html, /class="home-about-links"[^]*?<\/p>\s*<\/div>/, 'container also includes the bottom navigation');
  for (const page of ['dist/index.html', 'dist/blog/index.html', 'dist/study-notes/837/network-security/index.html', 'dist/study-notes/837/chapter/02/index.html', 'dist/study-notes/837/security-basics/index.html']) {
    const other = read(page);
    assert.ok(!other.includes('aria-label="知识点类别图例"'), page);
    assert.ok(!/<button\b[^>]*\sdata-knowledge-toggle(?:\s|>)/.test(other), page);
  }
});

test('one responsive legend opens, closes outside or with Escape, and transfers focus when crossing its breakpoint', () => {
  const buttons = [control({ t: 'ACL', c: 'struct' })];
  const row = control({ knowledgeTags: '["ACL"]' });
  const legend = control({ knowledgeCategory: 'struct' });
  const selection = control(), status = control(), empty = control(), clear = control(), controls = control(), toggle = control();
  const media = { matches: false, addEventListener(_name, fn) { this.change = fn; } };
  const document = { handlers: {}, activeElement: null, querySelectorAll: () => [root], addEventListener(name, fn) { this.handlers[name] = fn; } };
  controls.contains = (element) => element === legend;
  toggle.contains = (element) => element === toggle;
  const root = {
    querySelectorAll(selector) { return selector === '[data-knowledge-entry]' ? [row] : selector === '[data-t]' ? buttons : selector === '[data-knowledge-category]' ? [legend] : []; },
    querySelector(selector) { return { '[data-knowledge-selection]': selection, '[data-knowledge-status]': status, '[data-knowledge-empty]': empty, '[data-knowledge-clear]': clear, '[data-knowledge-controls]': controls, '[data-knowledge-toggle]': toggle }[selector]; },
  };
  const location = new URL('https://example.com/study-notes/837/information-security/');
  const window = { matchMedia(query) { assert.equal(query, '(min-width: 1500px)'); return media; }, addEventListener() {} };
  const script = ts.transpileModule(read('src/scripts/knowledge-directory.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(script, { document, location, window, history: { pushState() {} }, exports: {}, require: () => filtering });
  assert.equal(controls.hidden, true);
  assert.equal(toggle.hidden, false);
  assert.equal(controls.dataset.legendMode, 'popover');
  toggle.handlers.click();
  assert.equal(controls.hidden, false);
  assert.equal(toggle.attrs['aria-expanded'], 'true');
  legend.handlers.click();
  assert.equal(row.hidden, false);
  document.handlers.click({ target: legend });
  assert.equal(controls.hidden, false);
  document.handlers.click({ target: {} });
  assert.equal(controls.hidden, true);
  toggle.handlers.click();
  document.handlers.keydown({ key: 'Escape', preventDefault() {} });
  assert.equal(controls.hidden, true);
  assert.equal(toggle.focused, true);
  media.matches = true; document.activeElement = toggle; media.change();
  assert.equal(controls.hidden, false);
  assert.equal(toggle.hidden, true);
  assert.equal(controls.dataset.legendMode, 'sidebar');
  assert.equal(legend.focused, true);
  media.matches = false; document.activeElement = legend; media.change();
  assert.equal(controls.hidden, true);
  assert.equal(toggle.hidden, false);
  assert.equal(toggle.attrs['aria-expanded'], 'false');
  assert.equal(toggle.focused, true);
});
