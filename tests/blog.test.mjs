import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownToHtml, markdownToMdast } from 'satteri';
import { articleHeadings } from '../src/plugins/article-headings.mjs';
import { rankSearch, searchSnippet } from '../src/lib/search.ts';

const render = async (source) => (await markdownToHtml(source, { mdastPlugins: [articleHeadings], data: { astro: { frontmatter: { title: '标题' } } } })).html;
test('outline removes duplicate H1, demotes section trees, and preserves anchor IDs', async () => {
  const html = await render('# 标题\n\n## 正确章节\n\n# Introduction\n\n## Details\n\n### More');
  assert.ok(!html.includes('<h1'));
  assert.ok(html.includes('id="标题"'));
  assert.match(html, /<h2[^>]*>正确章节<\/h2>/);
  assert.match(html, /<h2[^>]*>Introduction<\/h2>/);
  assert.match(html, /<h3[^>]*>Details<\/h3>/);
  assert.match(html, /<h4[^>]*>More<\/h4>/);
});
test('correct hierarchy, fenced code, tables and math nodes survive AST heading plugin', async () => {
  const source = '## Section\n\n### Child\n\n```python\n# unchanged code\n```\n\n|A|B|\n|-|-|\n|1|2|';
  const html = await render(source);
  assert.match(html, /<h2[^>]*>Section/); assert.match(html, /<h3[^>]*>Child/);
  assert.ok(html.includes('# unchanged code')); assert.ok(html.includes('<table>'));
  const result = await markdownToMdast('## H\n\n$$\nx^2\n$$', { features: { math: true }, mdastPlugins: [articleHeadings], data: { astro: { frontmatter: { title: '标题' } } } });
  assert.ok(JSON.stringify(result).includes('math'));
});
test('a fresh plugin pass does not demote already normalized headings again', async () => {
  const html = await render('## Introduction\n\n### Details');
  assert.match(html, /<h2[^>]*>Introduction/); assert.match(html, /<h3[^>]*>Details/);
});
const record = (title, body, tags=[],date='2026-10-28') => ({ title, body, tags, date, shortTitle:null, subtitle:null,description:'',category:'Research',subcategory:'Paper Notes',series:'NLP',href:`/${title}/`,searchText:[title,...tags].join(' ') });
test('Chinese, full body, mixed technical terms and ranking work without tokenization services', () => {
  const records=[record('正文命中','BERT 与跨站请求伪造和 CSRF Token。'),record('BERT','语言模型',[],'2024-07-13'),record('标签命中','',['BERT'])];
  assert.deepEqual(rankSearch(records,'BERT').map(r=>r.title),['BERT','标签命中','正文命中']);
  assert.equal(rankSearch(records,'跨站请求伪造')[0].title,'正文命中');
  assert.equal(rankSearch(records,'csrf Token')[0].title,'正文命中');
  assert.equal(rankSearch(records,'BERT 跨站')[0].title,'正文命中');
  assert.equal(rankSearch(records,'不存在xyz').length,0);
  assert.ok(searchSnippet(records[0],'CSRF').includes('CSRF'));
});
test('search tie breaking is deterministic and uses date only after score', () => {
  const records=[record('b','ssl',[],'2024-01-01'),record('a','ssl',[],'2024-01-01'),record('c','ssl')];
  assert.deepEqual(rankSearch(records,'ssl').map(r=>r.title),['c','a','b']);
});
