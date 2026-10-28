import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const index = JSON.parse(read('dist/search-index.json'));
test('publication holds never enter the public index, feed or sitemap and retain safe old routes', () => {
  const directory = new URL('../src/content/blog_huawei_examination/', import.meta.url);
  for (const file of readdirSync(directory).filter((name) => name.endsWith('.md'))) {
    const source = readFileSync(new URL(file, directory), 'utf8');
    if (!/^publicationHoldReason:/m.test(source.split('\n---\n')[0])) continue;
    const route = `/blog/${file.slice(0, -3)}/`;
    assert.ok(!index.some((post) => post.href === route));
    assert.ok(!read('dist/rss.xml').includes(route));
    assert.ok(!read('dist/sitemap.xml').includes(route));
    const html = read('dist' + route + 'index.html');
    assert.ok(html.includes('noindex, nofollow'));
    assert.ok(!html.includes('class="article-body"'));
    assert.ok(!html.includes('原题描述'));
  }
});
test('all public articles have one H1, real images and article-level metadata', () => {
  for (const post of index) {
    const html = read('dist' + post.href + 'index.html');
    assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 1, post.href);
    assert.ok(html.includes('lang="zh-CN"'));
    assert.ok(html.includes('property="og:type" content="article"'));
    assert.ok(html.includes('property="article:published_time" content="' + post.date));
    assert.ok(html.includes('name="twitter:card" content="summary_large_image"'));
    assert.ok(!html.includes('分钟阅读'));
    for (const [, path] of html.matchAll(/<img[^>]*src="([^"?#]+)"/g)) {
      if (path.startsWith('/')) assert.ok(existsSync(new URL('../dist' + decodeURIComponent(path), import.meta.url)), path);
    }
  }
});
test('new Web note is in the syllabus, full-text index, RSS and sitemap', () => {
  const path = '/study-notes/837/web-attack-techniques/';
  const post = index.find((post) => post.href === path);
  assert.ok(post); assert.equal(post.date, '2026-10-28');
  assert.ok(post.body.includes('Referer'));
  for (const file of ['dist/rss.xml', 'dist/sitemap.xml', 'dist/study-notes/837/index.html', 'dist/study-notes/837/chapter/network-security-01/index.html']) assert.ok(read(file).includes(path), file);
  const html = read('dist' + path + 'index.html');
  assert.ok(html.includes('/study-notes/837/format-string-buffer-overflow/'));
});

test('real Chinese, English, mixed, body-only and empty queries find expected published notes', async () => {
  const { rankSearch } = await import('../src/lib/search.ts');
  for (const [query, expected] of [
    ['跨站请求伪造', '/study-notes/837/web-attack-techniques/'],
    ['Referer', '/study-notes/837/web-attack-techniques/'],
    ['CSRF Token', '/study-notes/837/web-attack-techniques/'],
    ['缺乏反污染机制', '/study-notes/837/network-protocol-vulnerabilities/'],
    ['IPSec 抗重放', '/study-notes/837/ipsec/'],
    ['SSL', '/study-notes/837/ssl/'],
    ['BERT', '/blog/bert/'],
    ['Web 攻击技术', '/study-notes/837/web-attack-techniques/'],
  ]) assert.ok(rankSearch(index, query).some((post) => post.href === expected), query);
  assert.equal(rankSearch(index, '不存在的术语-xyz-98765').length, 0);
  assert.equal(rankSearch(index, 'BERT')[0].href, '/blog/bert/');
});
