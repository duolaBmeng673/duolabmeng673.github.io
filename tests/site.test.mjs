import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const index = JSON.parse(read('dist/search-index.json'));
test('six algorithm and I/O notes are public with their original URLs and appropriate tags', () => {
  const slugs = ['acm_io', 'ci-cd-pipeline-jobs', 'photovoltaic-optimizer-greedy', '推理设备覆盖', 'two-team-greedy-partition', 'maze-shortest-rescue-bfs'];
  for (const slug of slugs) {
    const route = `/blog/${slug}/`;
    const post = index.find((post) => post.href === route);
    assert.ok(post, route);
    assert.equal(post.series, 'ACM / OJ');
    assert.equal(post.category, 'Computer Science');
    if (slug !== 'acm_io') assert.ok(!post.tags.includes('Huawei Examination'), slug);
    const html = read('dist' + route + 'index.html');
    assert.ok(html.includes('class="article-body"'));
    assert.ok(!html.includes('noindex, nofollow'));
    const url = 'https://duolabmeng673.github.io' + encodeURI(route);
    assert.ok(read('dist/rss.xml').includes(url));
    assert.ok(read('dist/sitemap.xml').includes(url));
    assert.ok(read('dist/blog/index.html').includes(route));
  }
  assert.ok(index.find((post) => post.href === '/blog/acm_io/').tags.includes('Huawei Examination'), 'I/O tags remain unchanged');
});
test('any future publication holds stay out of public discovery and retain safe old routes', () => {
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
    // Embedded documents have their own outline; inspect only the article document.
    const html = read('dist' + post.href + 'index.html').replace(/\ssrcdoc="[^"]*"/g, '');
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
  for (const file of ['dist/rss.xml', 'dist/sitemap.xml', 'dist/study-notes/837/network-security/index.html', 'dist/study-notes/837/chapter/network-security-01/index.html']) assert.ok(read(file).includes(path), file);
  const html = read('dist' + path + 'index.html');
  assert.ok(html.includes('/study-notes/837/format-string-buffer-overflow/'));
});

test('study entry points select independent modules and preserve existing chapter and article navigation', () => {
  const modules = {
    'information-security': ['security-basics', 'traditional-computer-viruses', 'firewall-netfilter', 'intrusion-detection-snort', 'ipsec', 'ssl', 'set', 'risk-management'],
    'network-security': ['network-protocol-vulnerabilities', 'dos-ddos-attacks', 'format-string-buffer-overflow', 'web-attack-techniques', 'network-packet-capture', 'packet-capture-bpf', 'libpcap-winpcap', 'host-discovery', 'port-scanning', 'kmp-algorithm'],
  };
  const prefix = '/study-notes/837/';
  for (const entry of ['dist/study-notes/index.html', 'dist/study-notes/837/index.html']) {
    const html = read(entry);
    for (const module of Object.keys(modules)) assert.ok(html.includes(`href="${prefix}${module}/"`));
    assert.ok(!html.includes('class="study-note-list"'), 'entry does not repeat all knowledge points');
  }
  for (const [module, slugs] of Object.entries(modules)) {
    const route = prefix + module + '/';
    const html = read('dist' + route + 'index.html');
    assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 1);
    assert.ok(html.includes(`${slugs.length} 篇公开笔记`));
    assert.ok(read('dist/sitemap.xml').includes(route));
    const positions = slugs.map((slug) => html.indexOf(`href="${prefix}${slug}/"`));
    assert.ok(positions.every((position) => position >= 0));
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b), 'syllabus order');
    const others = Object.entries(modules).filter(([key]) => key !== module).flatMap(([, values]) => values);
    for (const slug of others) assert.ok(!html.includes(`href="${prefix}${slug}/"`), 'no cross-module articles');
    slugs.forEach((slug, i) => {
      const article = read('dist' + prefix + slug + '/index.html');
      assert.ok(article.includes(`class="back-link" href="${route}"`));
      if (i > 0) assert.ok(article.includes(`href="${prefix}${slugs[i - 1]}/" rel="prev"`));
      if (i < slugs.length - 1) assert.ok(article.includes(`href="${prefix}${slugs[i + 1]}/" rel="next"`));
    });
  }
});

test('home keeps identity and four linked directions without the five removed descriptions', () => {
  const html = read('dist/index.html');
  for (const text of ['从 Transformers、BERT 到 GPT-1，整理语言模型的结构与训练方法。', '阅读 CLIP、MathVista、MMMU 与视觉任务相关论文。', '记录表格表示、理解和自动化处理方向的论文。', '整理 Python 输入输出，以及 HIT 837 两个安全模块的学习笔记。', '整理语言模型、多模态与表格理解论文，也记录算法练习和 HIT 837 学习笔记。']) assert.ok(!html.includes(text));
  for (const text of ['自然语言处理', '多模态与视觉', '大模型与表格', '算法与信息安全', '杨雨飞', '哈尔滨工业大学']) assert.ok(html.includes(text));
  assert.ok(html.includes('class="home-section selected-reading"'));
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
