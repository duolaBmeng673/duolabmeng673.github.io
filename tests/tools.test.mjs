import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { defineTools, tools } from '../src/data/tools.ts';

const file = (path) => new URL('../' + path, import.meta.url);
const read = (path) => readFileSync(file(path), 'utf8');

test('tool links can be maintained with only a name and URL', () => {
  assert.deepEqual(defineTools([{ name: ' 我的工具 ', url: ' https://example.com/tool ' }]), [
    { name: '我的工具', url: 'https://example.com/tool' },
  ]);
  assert.deepEqual(defineTools([{ name: '工具', url: 'https://example.com', description: ' ', category: '' }]), [
    { name: '工具', url: 'https://example.com' },
  ]);
  assert.deepEqual(defineTools([]), []);
  for (const url of ['javascript:alert(1)', 'data:text/html,test', '/tools/test/', 'https://user:password@example.com']) {
    assert.throws(() => defineTools([{ name: '工具', url }]), /HTTP|http/);
  }
  assert.throws(() => defineTools([{ name: ' ', url: 'https://example.com' }]), /名称/);
  assert.throws(() => defineTools([{ name: '工具', url: 'https://example.com' }, { name: '重复', url: 'https://example.com/' }]), /重复/);
});

test('configured tools render as external links in configuration order', () => {
  const expected = JSON.parse(read('src/data/tools.json')).map((tool) => tool.url.trim());
  assert.deepEqual(tools.map((tool) => tool.url), expected);
  const html = read('dist/tools/index.html');
  const cards = [...html.matchAll(/<a\b[^>]*class="tool-card"[^>]*>([^]*?)<\/a>/g)];
  assert.equal(cards.length, tools.length);
  for (const [index, card] of cards.entries()) {
    assert.ok(card[0].includes(`href="${tools[index].url}"`));
    assert.match(card[0], /target="_blank"/);
    assert.match(card[0], /rel="noopener noreferrer"/);
    assert.ok(card[1].includes(tools[index].name));
    assert.ok(card[1].includes('新窗口打开'));
    assert.ok(!card[1].includes('undefined'));
    assert.ok(!card[1].includes('<script'));
  }
});

test('tool navigation and homepage entry remain available on existing pages', () => {
  const expected = ['首页', '技术笔记', '学习笔记', '工具', '关于'];
  for (const path of ['dist/index.html', 'dist/blog/index.html', 'dist/study-notes/index.html', 'dist/about/index.html', 'dist/tools/index.html']) {
    const html = read(path);
    const nav = html.match(/<nav\b[^>]*aria-label="主导航"[^>]*>([^]*?)<\/nav>/)[1];
    assert.deepEqual([...nav.matchAll(/<a\b[^>]*>([^]*?)<\/a>/g)].map(([, label]) => label.trim()), expected, path);
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1, path);
  }
  assert.ok(read('dist/index.html').includes('class="home-tool-entry" href="/tools/"'));
  assert.ok(read('dist/tools/index.html').includes('aria-current="page">工具'));
  assert.ok(!read('dist/index.html').includes('哈工大空教室查询'));
});

test('removed classroom code is not built and external tools stay out of the sitemap and article search', () => {
  for (const path of [
    'src/pages/tools/classrooms.astro', 'src/scripts/tools/classrooms.ts', 'src/styles/tools/classrooms.css',
    'public/vendor/hit-classroom/room-app.js', 'public/vendor/hit-classroom/README.md',
    'dist/tools/classrooms/index.html', 'dist/vendor/hit-classroom/room-app.js',
  ]) assert.equal(existsSync(file(path)), false, path);
  const locations = [...read('dist/sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(([, loc]) => new URL(loc));
  assert.ok(locations.some((url) => url.pathname === '/tools/'));
  assert.ok(locations.every((url) => url.hostname === 'duolabmeng673.github.io'));
  assert.ok(!locations.some((url) => url.pathname.startsWith('/tools/classrooms/')));
  assert.ok(!JSON.parse(read('dist/search-index.json')).some((post) => post.href.startsWith('/tools/')));
  assert.doesNotMatch(read('dist/tools/index.html'), /hit-classroom|room-app\.js|classroom|<iframe/);
});
