import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as searchHelper from '../src/lib/search.ts';
import { FORBIDDEN_PUBLIC_TERMS, findForbiddenMatches } from '../src/config/forbidden-terms.ts';
import { scanBuiltBoldIssues } from '../scripts/check-bold.mjs';
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const index = JSON.parse(read('dist/search-index.json'));
test('six algorithm and I/O notes are public with their original URLs and without exam-origin tags', () => {
  const slugs = ['acm_io', 'ci-cd-pipeline-jobs', 'photovoltaic-optimizer-greedy', '推理设备覆盖', 'two-team-greedy-partition', 'maze-shortest-rescue-bfs'];
  for (const slug of slugs) {
    const route = `/blog/${slug}/`;
    const post = index.find((post) => post.href === route);
    assert.ok(post, route);
    assert.equal(post.series, 'ACM / OJ');
    assert.equal(post.category, 'Computer Science');
    assert.equal(findForbiddenMatches(post.tags.join(' ')).length, 0, `${route} tags clean`);
    const html = read('dist' + route + 'index.html');
    assert.ok(html.includes('class="article-body"'));
    assert.ok(!html.includes('noindex, nofollow'));
    const url = 'https://duolabmeng673.github.io' + encodeURI(route);
    assert.ok(read('dist/rss.xml').includes(url));
    assert.ok(read('dist/sitemap.xml').includes(url));
    assert.ok(read('dist/blog/index.html').includes(route));
  }
  assert.deepEqual(index.find((post) => post.href === '/blog/acm_io/').tags, ['ACM/OJ', 'Python', 'Input/Output']);
});
test('any future publication holds stay out of public discovery and retain safe old routes', () => {
  const directory = new URL('../src/content/blog_coding_practice/', import.meta.url);
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
    'information-security': ['security-basics', 'classical-ciphers-design-principles', 'symmetric-key-cryptography-des', 'public-key-cryptography-dh-rsa', 'hash-functions-principles', 'symmetric-authentication-kerberos', 'public-key-authentication-pki', 'access-control-models', 'windows-authentication-access-control', 'traditional-computer-viruses', 'firewall-netfilter', 'intrusion-detection-snort', 'ipsec', 'ssl', 'set', 'risk-management'],
    'network-security': ['network-protocol-vulnerabilities', 'dos-ddos-attacks', 'format-string-buffer-overflow', 'web-attack-techniques', 'network-packet-capture', 'packet-capture-bpf', 'libpcap-winpcap', 'host-discovery', 'port-scanning', 'kmp-algorithm', 'bm-algorithm', 'ac-algorithm', 'wm-algorithm', 'decision-tree-c45', 'naive-bayes-classification', 'k-means-clustering', 'agglomerative-clustering', 'divisive-clustering', 'dbscan-clustering'],
    'computer-networks': ['cn-message-switching', 'cn-tcp-ip-architecture', 'cn-ip-address-subnet', 'cn-web-http', 'cn-dns', 'cn-smtp', 'cn-udp', 'cn-tcp', 'cn-congestion-control', 'cn-socket-udp', 'cn-socket-tcp', 'cn-socket-raw', 'cn-link-state-ospf', 'cn-distance-vector-rip', 'cn-bgp', 'cn-arp', 'cn-wifi', 'cn-cdma'],
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
    assert.equal((html.match(/data-knowledge-tags=/g) ?? []).length, slugs.length);
    assert.ok(read('dist/sitemap.xml').includes(route));
    const positions = slugs.map((slug) => html.indexOf(`href="${prefix}${slug}/"`));
    assert.ok(positions.every((position) => position >= 0));
    assert.deepEqual(positions, [...positions].sort((a, b) => a - b), 'syllabus order');
    const dirHtml = html.split('id="study-quick-jump-dialog"')[0];
    const others = Object.entries(modules).filter(([key]) => key !== module).flatMap(([, values]) => values);
    for (const slug of others) assert.ok(!dirHtml.includes(`href="${prefix}${slug}/"`), 'no cross-module articles inside directory');
    slugs.forEach((slug, i) => {
      const article = read('dist' + prefix + slug + '/index.html');
      assert.ok(article.includes(`class="back-link" href="${route}"`));
      if (i > 0) assert.ok(article.includes(`href="${prefix}${slugs[i - 1]}/" rel="prev"`));
      if (i < slugs.length - 1) assert.ok(article.includes(`href="${prefix}${slugs[i + 1]}/" rel="next"`));
    });
  }
});

test('cryptography notes are public in chapter order with math and isolated diagrams', () => {
  const slugs = ['classical-ciphers-design-principles', 'symmetric-key-cryptography-des', 'public-key-cryptography-dh-rsa', 'hash-functions-principles'];
  const chapter = read('dist/study-notes/837/chapter/02/index.html');
  const diagrams = [2, 7, 2, 0];
  const positions = slugs.map((slug) => chapter.indexOf(`/study-notes/837/${slug}/`));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  slugs.forEach((slug, i) => {
    const route = `/study-notes/837/${slug}/`;
    const post = index.find((post) => post.href === route);
    assert.ok(post, route);
    assert.equal(post.date, '2026-11-06');
    assert.equal(post.category, 'Study Notes');
    for (const file of ['dist/rss.xml', 'dist/sitemap.xml']) assert.ok(read(file).includes(route), file);
    const html = read(`dist${route}index.html`);
    assert.ok(html.includes('class="katex"'));
    assert.ok(!html.includes('katex-error'));
    assert.ok(html.includes('data-study-mode="recall"'));
    assert.equal((html.match(/src="data:image\/svg\+xml;base64,/g) ?? []).length, diagrams[i]);
    assert.ok(!html.includes('<style>'), 'diagram CSS is isolated from the article');
    if (slug === 'symmetric-key-cryptography-des') {
      for (const mode of ['ecb', 'cbc', 'cfb', 'ofb', 'ctr']) assert.match(html, new RegExp(`src="/_astro/mode_${mode}\\.[^"]+\\.svg"`));
    }
  });
});

test('technical archive offers only papers and algorithms while global search retains all notes', () => {
  const html = read('dist/blog/index.html');
  assert.deepEqual([...html.matchAll(/data-category-filter="([^"]+)"/g)].map((match) => match[1]), ['all', 'Research', 'Computer Science']);
  assert.ok(html.includes('算法题解'));
  assert.doesNotMatch(html, /<select\b|data-subcategory-filter|data-series-filter|data-view-toggle/);
  const records = JSON.parse(html.match(/id="notes-index"[^>]*>([^]*?)<\/script>/)[1]);
  assert.equal(records.length, index.length, 'global queries and legacy tag links retain all public notes');
  const rows = [...html.matchAll(/<article\b([^>]*data-timeline-row[^>]*)>/g)].map((match) => match[1]);
  const technical = index.filter((post) => post.category !== 'Study Notes');
  assert.equal(rows.filter((attrs) => !/\bhidden\b/.test(attrs)).length, technical.length);
  for (const path of ['dist/study-notes/index.html', 'dist/study-notes/837/index.html']) {
    assert.ok(!read(path).includes('/blog/?category=Study%20Notes'));
  }
});

test('home keeps identity and four linked directions without the five removed descriptions', () => {
  const html = read('dist/index.html');
  for (const text of ['从 Transformers、BERT 到 GPT-1，整理语言模型的结构与训练方法。', '阅读 CLIP、MathVista、MMMU 与视觉任务相关论文。', '记录表格表示、理解和自动化处理方向的论文。', '整理 Python 输入输出，以及 HIT 837 两个安全模块的学习笔记。', '整理语言模型、多模态与表格理解论文，也记录算法练习和 HIT 837 学习笔记。']) assert.ok(!html.includes(text));
  for (const text of ['自然语言处理', '多模态与视觉', '大模型与表格', '算法与信息安全', '杨雨飞', '哈尔滨工业大学']) assert.ok(html.includes(text));
  for (const href of ['/blog/?series=NLP', '/blog/?series=Multimodal', '/blog/?series=LLM%20%26%20Tables', '/study-notes/837/']) assert.ok(html.includes(`href="${href}"`), href);
  for (const marker of ['about.ts', 'Terminal', 'Presets', 'activity.heatmap', '三条主线', '837 知识点快查', 'data-activity-fallback']) assert.ok(html.includes(marker), marker);
});

test('new matching notes are public in syllabus order with local interactive demos', () => {
  const slugs = ['bm-algorithm', 'ac-algorithm', 'wm-algorithm', 'decision-tree-c45'];
  const module = read('dist/study-notes/837/network-security/index.html');
  const positions = slugs.slice(0, 3).map((slug) => module.indexOf(`/study-notes/837/${slug}/`));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  for (const slug of slugs) {
    const route = `/study-notes/837/${slug}/`;
    const post = index.find((item) => item.href === route);
    assert.ok(post, route);
    assert.equal(post.date, slug === 'bm-algorithm' ? '2026-10-30' : '2026-11-01');
    const html = read(`dist${route}index.html`);
    if (slug !== 'decision-tree-c45') {
      assert.ok(html.includes('class="article-interactive"'), `${slug} embeds its local demo`);
      assert.ok(html.includes('sandbox="allow-scripts"'), `${slug} sandbox is restricted`);
      assert.ok(html.includes('srcdoc='), `${slug} demo remains on the article page`);
      assert.ok(!html.includes('src="./'), `${slug} has no dead relative demo link`);
    }
    assert.ok(read('dist/sitemap.xml').includes(route));
    const chapter = slug === 'decision-tree-c45' ? 'network-security-06' : 'network-security-05';
    assert.ok(read(`dist/study-notes/837/chapter/${chapter}/index.html`).includes(route));
  }
});

test('classification and clustering notes are discoverable with math, tables and recall controls', () => {
  const slugs = ['naive-bayes-classification', 'k-means-clustering', 'agglomerative-clustering', 'divisive-clustering', 'dbscan-clustering'];
  for (const slug of slugs) {
    const route = `/study-notes/837/${slug}/`;
    const post = index.find((item) => item.href === route);
    assert.ok(post, route);
    assert.equal(post.date, '2026-11-02');
    assert.ok(post.searchText.includes('网络安全基础'));
    for (const file of ['dist/rss.xml', 'dist/sitemap.xml', 'dist/study-notes/837/chapter/network-security-06/index.html']) assert.ok(read(file).includes(route), file);
    const html = read(`dist${route}index.html`);
    assert.ok(html.includes('class="katex"'), `${slug} math rendered`);
    assert.ok(!html.includes('katex-error'), `${slug} has no math errors`);
    assert.ok(html.includes('<table'));
    assert.ok(html.includes('data-study-mode="recall"'));
  }
  const bayes = read('dist/study-notes/837/naive-bayes-classification/index.html');
  assert.match(bayes, /src="\/_astro\/naive-bayes-flow\.[^"]+\.svg"/);
  assert.ok(!index.some((post) => post.title.includes('笔记设计规范')), 'authoring document is not published');
  assert.ok(!read('dist/sitemap.xml').includes('笔记设计规范'));
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

test('homepage, blog archive and about stats match public collection counts', () => {
  const countMarkdown = (dir, { recursive = false, excludeHeld = false } = {}) => {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
      if (entry.isDirectory()) {
        if (recursive) out.push(...countMarkdown(full, { recursive, excludeHeld }));
      } else if (entry.name.endsWith('.md') && entry.name !== '笔记设计规范.md') {
        const frontmatter = readFileSync(full, 'utf8').split('\n---\n')[0];
        if (excludeHeld && /^publicationHoldReason:/m.test(frontmatter)) continue;
        if (/^draft:\s*true/m.test(frontmatter)) continue;
        out.push(frontmatter);
      }
    }
    return out;
  };
  const researchCount = countMarkdown(new URL('../src/content/blog_read/', import.meta.url)).length;
  const csCount = countMarkdown(new URL('../src/content/blog_coding_practice/', import.meta.url), { excludeHeld: true }).length;
  const infoSecCount = countMarkdown(new URL('../src/content/837考研/信息安全导论/', import.meta.url), { recursive: true }).length;
  const netSecCount = countMarkdown(new URL('../src/content/837考研/网络安全基础考点笔记总结/', import.meta.url), { recursive: true }).length;
  const cnCount = countMarkdown(new URL('../src/content/837考研/计算机网络/', import.meta.url), { recursive: true }).length;
  const studyCount = infoSecCount + netSecCount + cnCount;
  const regularCount = researchCount + csCount;
  const totalCount = regularCount + studyCount;

  assert.equal(index.length, totalCount, 'search index matches public collection total');

  const homeHtml = read('dist/index.html');
  assert.match(homeHtml, new RegExp(`notes:\\s*<a[^>]*>${totalCount}</a>`));
  for (const [slug, count] of [['all', totalCount], ['research', researchCount], ['cs', csCount], ['837', studyCount]]) {
    assert.match(homeHtml, new RegExp(`<button[^>]*data-preset-slug="${slug}"[\\s\\S]*?·\\s*${count}\\s*篇[\\s\\S]*?<\\/button>`), slug);
  }

  const blogHtml = read('dist/blog/index.html');
  const blogStats = [...blogHtml.matchAll(/class="masthead-stat-num">(\d+)<\/strong>/g)].map((m) => Number(m[1]));
  assert.deepEqual(blogStats, [regularCount, researchCount, csCount]);

  const aboutHtml = read('dist/about/index.html');
  const aboutStats = [...aboutHtml.matchAll(/class="masthead-stat-num">(\d+)<\/strong>/g)].map((m) => Number(m[1]));
  assert.deepEqual(aboutStats, [totalCount, regularCount, studyCount]);
  const breakdownCounts = [...aboutHtml.matchAll(/class="about-breakdown"[\s\S]*?<\/ul>/g)][0][0]
    .matchAll(/<strong>(\d+)\s*篇<\/strong>/g);
  assert.deepEqual([...breakdownCounts].map((m) => Number(m[1])), [researchCount, csCount, infoSecCount, netSecCount, cnCount]);
});

test('404 page is generated with noindex and excluded from sitemap and search index', () => {
  assert.ok(existsSync(new URL('../dist/404.html', import.meta.url)));
  const html = read('dist/404.html');
  assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 1);
  assert.ok(html.includes('name="robots" content="noindex, nofollow"'));
  assert.ok(!html.includes('rel="canonical"'));
  assert.ok(!read('dist/sitemap.xml').includes('/404'));
  assert.ok(!index.some((post) => post.href.includes('404')));
});

test('pilot converted SVG assets are valid isolated diagrams within 10 KB', () => {
  const pilots = [
    {
      srcRel: 'src/content/837考研/信息安全导论/信息安全导论考点问题总结/5 防火墙、入侵检测与安全传输协议/5.b 入侵检测理论与 snorts 结构原理/CIDF模型.svg',
      route: '/study-notes/837/intrusion-detection-snort/',
      encodedPrefix: 'CIDF%E6%A8%A1%E5%9E%8B.',
      expectedAlt: 'CIDF 模型示意图',
      ratio: [720, 381],
    },
    {
      srcRel: 'src/content/837考研/信息安全导论/信息安全导论考点问题总结/5 防火墙、入侵检测与安全传输协议/5.c.1  IPSec/IKESA野蛮模式.svg',
      route: '/study-notes/837/ipsec/',
      encodedPrefix: 'IKESA%E9%87%8E%E8%9B%AE%E6%A8%A1%E5%BC%8F.',
      expectedAlt: 'IKE SA 野蛮模式',
      ratio: [720, 292],
    },
    {
      srcRel: 'src/content/837考研/信息安全导论/信息安全导论考点问题总结/5 防火墙、入侵检测与安全传输协议/5.c.2  SSL/SSL记录协议数据处理.svg',
      route: '/study-notes/837/ssl/',
      encodedPrefix: 'SSL%E8%AE%B0%E5%BD%95%E5%8D%8F%E8%AE%AE%E6%95%B0%E6%8D%AE%E5%A4%84%E7%90%86.',
      expectedAlt: 'SSL 记录协议数据处理流程',
      ratio: [720, 476],
    },
  ];

  for (const item of pilots) {
    const svgPath = new URL(`../${item.srcRel}`, import.meta.url);
    assert.ok(existsSync(svgPath), `Missing SVG source: ${item.srcRel}`);
    const svg = readFileSync(svgPath, 'utf8');
    assert.ok(Buffer.byteLength(svg, 'utf8') <= 10 * 1024, `${item.srcRel} exceeds 10 KB`);
    assert.match(svg, /^<svg\b[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*\bviewBox="([^"]+)"/i);
    assert.ok(svg.trimEnd().endsWith('</svg>'), `${item.srcRel} closes cleanly with </svg>`);
    assert.match(svg, /<title\b[^>]*>[^<]+<\/title>/, `${item.srcRel} contains <title>`);
    assert.match(svg, /<desc\b[^>]*>[^<]+<\/desc>/, `${item.srcRel} contains <desc>`);
    assert.doesNotMatch(svg, /<script\b|<foreignObject\b|\son[a-z]+\s*=|(?:xlink:)?href\s*=\s*["']https?:/i);

    const html = read(`dist${item.route}index.html`);
    const escapedPrefix = item.encodedPrefix.replace(/\./g, '\\.');
    const imgMatch = html.match(new RegExp(`<img\\b[^>]*src="(\\/_astro\\/${escapedPrefix}[^"]+\\.svg)"[^>]*>`));
    assert.ok(imgMatch, `${item.route} must reference isolated <img> SVG (${item.encodedPrefix})`);
    assert.ok(imgMatch[0].includes(item.expectedAlt), `${item.route} updated semantic alt text`);
    assert.ok(imgMatch[0].includes(`width="${item.ratio[0]}" height="${item.ratio[1]}"`), `${item.route} preserves aspect ratio`);

    const emittedPath = new URL(`../dist${decodeURIComponent(imgMatch[1])}`, import.meta.url);
    assert.ok(existsSync(emittedPath), `Built SVG missing: ${imgMatch[1]}`);
    const emitted = readFileSync(emittedPath, 'utf8');
    assert.ok(Buffer.byteLength(emitted, 'utf8') <= 10 * 1024, `Built ${imgMatch[1]} exceeds 10 KB`);
  }
});

test('all markdown-referenced SVG assets in 837 study notes exist and pass XML safety checks', () => {
  const studyRoot = new URL('../src/content/837考研/', import.meta.url);
  const walkMd = (dir) => {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
      if (entry.isDirectory()) out.push(...walkMd(full));
      else if (entry.name.endsWith('.md')) out.push(full);
    }
    return out;
  };
  let checked = 0;
  for (const mdFile of walkMd(studyRoot)) {
    const body = readFileSync(mdFile, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    for (const [, rawRef] of body.matchAll(/!\[[^\]]*\]\((<?[^)\s>]+\.svg>?)\)/gi)) {
      const cleanRef = rawRef.replace(/^<|>$/g, '');
      const target = new URL(cleanRef, mdFile);
      assert.ok(existsSync(target), `Missing SVG referenced by ${mdFile.pathname}: ${cleanRef}`);
      const content = readFileSync(target, 'utf8');
      assert.match(content, /<svg\b[^>]*\bviewBox=/i, `${cleanRef} must contain viewBox`);
      assert.doesNotMatch(content, /<script\b|<foreignObject\b|\son[a-z]+\s*=|(?:xlink:)?href\s*=\s*["']https?:/i, cleanRef);
      checked++;
    }
  }
  assert.ok(checked >= 30, `Expected at least 30 active SVG references in 837 notes, found ${checked}`);
});

test('study notes render leading-bracket alignment, omit 原题/重点 badges in body/TOC/search, and keep recall toolbar hooks', () => {
  const yuantiRoutes = [
    '/study-notes/837/firewall-netfilter/',
    '/study-notes/837/intrusion-detection-snort/',
    '/study-notes/837/ipsec/',
    '/study-notes/837/risk-management/',
    '/study-notes/837/set/',
    '/study-notes/837/ssl/',
  ];
  for (const route of yuantiRoutes) {
    const html = read(`dist${route}index.html`);
    assert.ok(!html.includes('heading-badge'), `${route} must not render heading-badge`);
    assert.ok(!html.includes('data-badge='), `${route} must not render data-badge`);
    assert.ok(!/<h[2-6][^>]*>[\s\S]*?（(?:原题|重点)）/.test(html), `${route} body headings must strip （原题）/（重点）`);
    const tocPane = html.match(/data-toc-pane="toc"[^>]*>([\s\S]*?)<\/div>\s*<div class="toc-pane" data-toc-pane="modules"/)?.[1] ?? '';
    assert.ok(!tocPane.includes('（原题）') && !tocPane.includes('（重点）'), `${route} TOC must not show （原题）/（重点）`);
    const searchEntry = index.find((item) => item.href === route);
    assert.ok(searchEntry && !searchEntry.searchText.includes('（原题）') && !searchEntry.body.includes('（原题）'), `${route} search index strips （原题）`);
  }

  const snortHtml = read('dist/study-notes/837/intrusion-detection-snort/index.html');
  assert.ok(snortHtml.includes('<h2 id="原题入侵检测模型的过程">入侵检测模型的过程？</h2>'));
  assert.equal((snortHtml.match(/<h4\b[^>]*><span class="lead-punct">（<\/span>/g) ?? []).length, 10);
  const basicsHtml = read('dist/study-notes/837/security-basics/index.html');
  assert.equal((basicsHtml.match(/<h4\b[^>]*><span class="lead-punct">（<\/span>/g) ?? []).length, 7);

  assert.ok(snortHtml.includes('data-recall-tools'));
  assert.ok(snortHtml.includes('data-study-mode="read"'));
  assert.ok(snortHtml.includes('data-study-mode="recall"'));
  assert.ok(snortHtml.includes('data-recall-actions'));
  assert.ok(snortHtml.includes('data-recall-all="show"'));
  assert.ok(snortHtml.includes('data-recall-all="hide"'));
  assert.ok(!snortHtml.includes('data-recall-hint'));

  const blogHtml = read('dist/blog/bert/index.html');
  assert.ok(!blogHtml.includes('data-study-body'));
  assert.ok(!blogHtml.includes('data-recall-tools'));

  const css = read('src/styles/global.css');
  assert.match(css, /\.lead-punct\s*\{[^}]*margin-left:\s*-0\.5em/);
  assert.match(css, /@supports\s*\(text-spacing-trim:\s*trim-start\)/);
  assert.match(css, /\.recall-tools\s+\.view-button\s*\{[^}]*min-height:\s*max\(36px,\s*2\.25rem\)/);
});

test('SVG diagrams carry data-svg-diagram dynamically and dark filter targets elements without touching rasters, KaTeX, or iframe demos', () => {
  function walkHtml(dir) {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...walkHtml(p));
      else if (entry.name.endsWith('.html')) out.push(p);
    }
    return out;
  }

  let discoveredSvgs = 0;
  let taggedSvgs = 0;
  let rasterTagged = 0;
  let katexTagged = 0;
  let iframeTagged = 0;

  for (const file of walkHtml('dist')) {
    const html = readFileSync(file, 'utf8');
    const bodyMatch = html.match(/<div class="article-body[^"]*"[\s\S]*$/);
    if (!bodyMatch) continue;
    const body = bodyMatch[0].split('</article>')[0];

    for (const [tag] of body.matchAll(/<iframe\b[^>]*>/gi)) {
      if (tag.includes('data-svg-diagram')) iframeTagged++;
    }

    const bodyWithoutIframes = body.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');

    for (const [tag] of bodyWithoutIframes.matchAll(/<img\b[^>]*>/gi)) {
      const src = (tag.match(/src=["']([^"']+)["']/i) || [])[1] || '';
      const isSvg = /\.svg(?:$|[?#])/i.test(src) || src.startsWith('data:image/svg+xml');
      const hasAttr = /\bdata-svg-diagram="true"/.test(tag);
      if (isSvg) {
        discoveredSvgs++;
        if (hasAttr) taggedSvgs++;
      } else if (hasAttr) {
        rasterTagged++;
      }
    }

    for (const [tag] of bodyWithoutIframes.matchAll(/<svg\b[^>]*>/gi)) {
      const hasAttr = /\bdata-svg-diagram="true"/.test(tag);
      const isKatex = tag.includes('viewBox="0 0 400000') || (/\baria-hidden="true"/.test(tag) && !/\brole="img"/.test(tag));
      if (isKatex) {
        if (hasAttr) katexTagged++;
      } else {
        discoveredSvgs++;
        if (hasAttr) taggedSvgs++;
      }
    }
  }

  assert.ok(discoveredSvgs > 0, 'Expected at least one built SVG diagram');
  assert.equal(taggedSvgs, discoveredSvgs, 'Every discovered static SVG diagram must be tagged with data-svg-diagram="true"');
  assert.equal(rasterTagged, 0, 'PNG/JPG/WebP raster images must never receive data-svg-diagram');
  assert.equal(katexTagged, 0, 'KaTeX math SVGs must never receive data-svg-diagram');
  assert.equal(iframeTagged, 0, 'Sandboxed iframe srcdoc demos (ac/kmp) must never receive data-svg-diagram');

  const css = read('src/styles/global.css');
  assert.match(css, /:root\[data-theme="dark"\]\s+\.article-body\s+\[data-svg-diagram="true"\]\s*\{[^}]*filter:\s*invert\(/);
  assert.doesNotMatch(css, /\.article-svg-link[^}]*filter:/);
  assert.match(css, /\.article-svg-card:not\(\.article-svg-link > \.article-svg-card\)\s*\{[^}]*margin:\s*1\.6em 0;/);
  const kmpHtml = read('dist/study-notes/837/kmp-algorithm/index.html');
  const kmpTables = kmpHtml.match(/<table\b[\s\S]*?<\/table>/gi) ?? [];
  assert.ok(kmpTables.length > 0 && kmpTables.every((table) => !table.includes('kmp_vs_bf')), 'KMP diagram must render outside the comparison table');
});

test('built site HTML, search index, RSS, and sitemap contain no forbidden terms from config', () => {
  function walkTargets(dir) {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...walkTargets(p));
      else if (/\.(html|xml|json)$/i.test(entry.name)) out.push(p);
    }
    return out;
  }

  assert.ok(FORBIDDEN_PUBLIC_TERMS.length > 0);
  const files = walkTargets('dist');
  assert.ok(files.some((f) => f === 'dist/search-index.json'));
  assert.ok(files.some((f) => f === 'dist/rss.xml'));
  assert.ok(files.some((f) => f === 'dist/sitemap.xml'));

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const hits = findForbiddenMatches(content);
    assert.deepEqual(hits, [], `Forbidden term found in built artifact ${file}: ${JSON.stringify(hits)}`);
  }
});

test('study module pages include module switcher and swapped lower dock pill, and blog archive uses yearly 2-layer timeline UI', () => {
  const modules = ['information-security', 'network-security', 'computer-networks'];
  const knowledgeCss = read('src/styles/knowledge-tags.css');
  const globalCss = read('src/styles/global.css');
  assert.match(knowledgeCss, /\.knowledge-aside\.archive-tools\s*\{[^}]*border-radius:\s*14px;[^}]*background:\s*var\(--navg\);[^}]*backdrop-filter:\s*blur\(1rem\)\s*saturate\(155%\);/);
  assert.match(knowledgeCss, /\.knowledge-aside\.archive-tools::before\s*\{[^}]*content:\s*none;/);
  assert.match(knowledgeCss, /\.study-module-pill\s*\{[^}]*border-radius:\s*var\(--r-ctl\);[^}]*background:\s*var\(--surface\);/);
  assert.match(globalCss, /\.archive-tools\s*\{[^}]*border-radius:\s*14px;[^}]*background:\s*var\(--navg\);[^}]*backdrop-filter:\s*blur\(1rem\)\s*saturate\(155%\);/);
  assert.match(globalCss, /\.archive-tools\[data-dock-hidden="true"\]\s*\{[^}]*transform:\s*translateY\(calc\(-100%\s*-\s*1rem\)\);[^}]*opacity:\s*0;/);
  assert.doesNotMatch(globalCss, /\.archive-tools::before\s*\{|\.hierarchy-filters\s*\{|\.notes-view\s*\{|\.timeline-month\s*\{/);
  assert.match(globalCss, /\.blog-card\s+\.knowledge-entry-content\s+\.knowledge-tags\s*\{[^}]*margin-top:\s*0;/);
  assert.match(globalCss, /\.toc-module-btn\.is-current\s*\{[^}]*border-color:\s*transparent;\s*background:\s*var\(--ac-soft\);/);

  for (const slug of modules) {
    const html = read(`dist/study-notes/837/${slug}/index.html`);
    assert.match(html, /class="study-module-switcher"/);
    assert.doesNotMatch(html, /id="study-quick-jump-dialog"|data-study-jump-open/);
    assert.doesNotMatch(html, /class="home-about-links"/);
  }

  const blogHtml = read('dist/blog/index.html');
  assert.doesNotMatch(blogHtml, /data-archive-description|class="masthead-stat-sub"|class="note-description"|class="note-taxonomy"|class="notes-view"|class="timeline-month"|class="blog-timeline-layout"|class="blog-time-rail"|data-blog-time-rail|data-active-time|data-view-toggle|data-subcategory-filter|data-series-filter|timeline-year-head|data-year-count|timeline-chapter-box|data-time-entry|data-rail-month-count|阅读笔记/);
  assert.match(blogHtml, /class="result-status visually-hidden"\s+data-result-status/);
  assert.match(blogHtml, /<section\s+class="timeline-view"\s+data-timeline-view/);
  assert.match(globalCss, /\.timeline-year\s*\{[^}]*grid-template-columns:\s*180px\s+minmax\(0,\s*1fr\);/);
  assert.match(globalCss, /\.year-rail\s*\{/);
  assert.match(globalCss, /\.year-rail::before\s*\{/);
  assert.match(globalCss, /\.timeline-year-box\s*\{[^}]*position:\s*sticky;/);
  assert.match(globalCss, /@media\s*\(max-width:\s*899px\)\s*\{[\s\S]*?\.year-rail,\s*\.timeline-month-cell\s*\{\s*display:\s*none;\s*\}/);
  assert.doesNotMatch(globalCss, /\.blog-timeline-layout\s*\{|\.blog-time-rail\s*\{|\.timeline-year-head\s*\{|\.timeline-chapter-box\s*\{/);
  const visibleBlogCards = blogHtml.match(/<article\b[^>]*class="timeline-row blog-card knowledge-entry"[^>]*data-id="blog_[^"]*">[\s\S]*?<\/article>/g) ?? [];
  assert.equal(visibleBlogCards.length, 18);
  for (const card of visibleBlogCards) {
    assert.doesNotMatch(card, /editorial-card-cta|note-description|note-taxonomy/);
    assert.match(card, /data-year="\d{4}"[^>]*data-month="\d{4}-\d{2}"/);
  }
  const monthLabels = [...blogHtml.matchAll(/<div class="timeline-month-band" data-timeline-month-band="\d{4}-\d{2}"(?![^>]*\bhidden\b)[^>]*>[\s\S]*?<span class="timeline-month-name">([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(monthLabels, ['2026 年 10 月', '2025 年 3 月', '2025 年 2 月', '2025 年 1 月', '2024 年 10 月', '2024 年 9 月', '2024 年 7 月']);
  const visibleYears = [...blogHtml.matchAll(/<section class="timeline-year" data-timeline-year="(\d{4})"(?![^>]*\bhidden\b)[^>]*>[\s\S]*?<span class="timeline-year-label">\1<\/span>/g)];
  assert.deepEqual(visibleYears.map((m) => m[1]), ['2026', '2025', '2024']);
});

test('blog sticky year rail filters empty months and years cleanly', async () => {
  const makeEl = (extra = {}) => {
    const attrs = new Map(Object.entries(extra.attrs ?? {}));
    const handlers = new Map();
    const classes = new Set(extra.classes ?? []);
    return {
      ...extra,
      dataset: { ...(extra.dataset ?? {}) },
      hidden: Boolean(extra.hidden),
      value: extra.value ?? '',
      textContent: extra.textContent ?? '',
      classList: {
        toggle: (name, force) => (force === undefined ? (classes.has(name) ? classes.delete(name) : classes.add(name)) : (force ? classes.add(name) : classes.delete(name))),
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        contains: (name) => classes.has(name),
      },
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: (k) => attrs.get(k) ?? null,
      removeAttribute: (k) => attrs.delete(k),
      addEventListener: (ev, cb) => { if (!handlers.has(ev)) handlers.set(ev, []); handlers.get(ev).push(cb); },
      dispatch: (ev, payload = {}) => { for (const cb of handlers.get(ev) ?? []) cb({ preventDefault() {}, ...payload }); },
      focus() {},
    };
  };

  const sampleRecords = [
    { id: 'cs1', title: 'CS 2026', shortTitle: null, subtitle: null, description: 'd', category: 'Computer Science', subcategory: 'Algorithms', series: 'ACM / OJ', tags: [], knowledgeTags: [], date: '2026-10-09', href: '/blog/cs1/', body: '', searchText: 'cs 2026' },
    { id: 'res1', title: 'Res 2025', shortTitle: null, subtitle: null, description: 'd', category: 'Research', subcategory: 'Paper Notes', series: 'LLM & Tables', tags: [], knowledgeTags: [], date: '2025-02-28', href: '/blog/res1/', body: '', searchText: 'res 2025' },
  ];
  const categoryLinks = ['all', 'Computer Science', 'Research'].map((c) => makeEl({ dataset: { categoryFilter: c } }));
  const timelineRows = sampleRecords.map((r) => makeEl({ dataset: { id: r.id } }));
  const monthBands = sampleRecords.map((r, idx) => makeEl({
    dataset: { timelineMonthBand: r.date.slice(0, 7) },
    querySelectorAll: (sel) => (sel === '[data-timeline-row]:not([hidden])' ? (timelineRows[idx].hidden ? [] : [timelineRows[idx]]) : []),
  }));
  const timelineYears = sampleRecords.map((_r, idx) => makeEl({
    querySelectorAll: (sel) => (sel === '[data-timeline-row]:not([hidden])' ? (timelineRows[idx].hidden ? [] : [timelineRows[idx]]) : []),
  }));
  const clearFilters = makeEl(), empty = makeEl({ hidden: true });
  const location = { pathname: '/blog/', search: '' };
  const history = { replaceState(_s, _t, next) { const u = new URL(next, 'https://example.com'); location.pathname = u.pathname; location.search = u.search; } };
  const window = { matchMedia: () => ({ matches: false }), setTimeout, addEventListener: () => {} };
  const document = {
    querySelectorAll: (sel) => ({
      '[data-category-filter]': categoryLinks,
      '[data-blog-category]': [],
      '[data-blog-tag]': [],
      '[data-timeline-month-band]': monthBands,
      '[data-timeline-row]': timelineRows,
      '[data-timeline-year]': timelineYears,
    }[sel] ?? []),
    querySelector: (sel) => ({
      '#notes-index': { textContent: JSON.stringify(sampleRecords) },
      '[data-archive-empty]': empty,
      '[data-clear-filters]': clearFilters,
    }[sel] ?? null),
  };
  const script = ts.transpileModule(read('src/scripts/notes.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(script, {
    document,
    location,
    history,
    window,
    URLSearchParams,
    exports: {},
    require: (id) => (id.includes('sticky-dock') ? { bindStickyAutoHide: () => ({ reveal: () => {} }) } : searchHelper),
  });
  await new Promise((r) => setTimeout(r, 10));

  assert.deepEqual(monthBands.map((b) => b.hidden), [false, false]);
  assert.deepEqual(timelineYears.map((y) => y.hidden), [false, false]);

  categoryLinks[2].dispatch('click');
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(monthBands.map((b) => b.hidden), [true, false]);
  assert.deepEqual(timelineYears.map((y) => y.hidden), [true, false]);

  clearFilters.dispatch('click');
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(monthBands.map((b) => b.hidden), [false, false]);
  assert.deepEqual(timelineYears.map((y) => y.hidden), [false, false]);
});

test('study articles omit redundant header quick jump row, show shortcut on TOC button, and keep cross-module pagination', () => {
  const c45 = read('dist/study-notes/837/decision-tree-c45/index.html');
  assert.doesNotMatch(c45, /class="article-quick-jump"/);
  assert.doesNotMatch(c45, /data-toc-jump-filter|data-toc-module-tab|class="toc-module-current"/);
  assert.match(c45, /data-toc-jump-toggle[^>]*data-jump-shortcut-title[\s\S]*data-toc-jump-label>笔记直达<\/span>[\s\S]*data-jump-shortcut data-shortcut-kind="jump"/);
  assert.match(c45, /data-toc-heading-module/);
  assert.match(c45, /<details class="mobile-jump-module" open>/);
  assert.match(c45, /data-toc-view="toc"/);
  assert.match(c45, /data-toc-pane="toc"[\s\S]*data-toc-pane="modules"[\s\S]*data-toc-pane="tree"/);
  assert.match(c45, /class="toc-step-nav"/);
  assert.match(c45, /class="toc-fixed-title-text"[^>]*>决策树分类（C4\.5）<\/p>/);
  const jumpGroups = c45.match(/<details\b[^>]*class="toc-jump-group"[^>]*>/g) ?? [];
  assert.ok(jumpGroups.length > 0);
  assert.ok(jumpGroups.every((tag) => /\bopen\b/.test(tag)), 'all chapters in TOC tree must stay open by default');

  const classical = read('dist/study-notes/837/classical-ciphers-design-principles/index.html');
  const classicalTocPane = classical.match(/data-toc-pane="toc"[^>]*>([\s\S]*?)<\/div>\s*<div class="toc-pane" data-toc-pane="modules"/)?.[1] ?? '';
  assert.ok(!classicalTocPane.includes('第二章 密码学基础'), 'single wrapper heading must not appear in TOC list');
  assert.match(classicalTocPane, /<li class="toc-level-2"><a data-toc-link[^>]*>1 古典替换密码/);
  assert.match(classicalTocPane, /<li class="toc-level-3"><a data-toc-link[^>]*>1\.1 移位密码/);

  const firstNote = read('dist/study-notes/837/security-basics/index.html');
  assert.match(firstNote, /class="toc-step-btn is-disabled"[^>]*aria-disabled="true"[^>]*><span aria-hidden="true">←<\/span><span>上一章<\/span>/);
  assert.match(firstNote, /class="toc-step-btn"[^>]*><span>下一章<\/span><span aria-hidden="true">→<\/span>/);

  const tokensCss = read('src/styles/tokens.css');
  assert.match(tokensCss, /--toc-panel-height:\s*min\(560px,\s*calc\(100vh - var\(--header-h, 56px\) - 24px\)\)/);
  assert.match(tokensCss, /--toc-tree-height:\s*min\(760px,\s*calc\(100vh - var\(--header-h, 56px\) - 36px\)\)/);
  const globalCss = read('src/styles/global.css');
  assert.match(globalCss, /overscroll-behavior:\s*contain/);
  assert.match(globalCss, /\.article-toc\[data-toc-view="modules"\]\s*\{[^}]*height:\s*auto;/);
  assert.match(globalCss, /\.article-toc\[data-toc-view="tree"\]\s*\{[^}]*height:\s*var\(--toc-tree-height\)/);

  const studyArticleDirs = readdirSync('dist/study-notes/837', { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !['information-security', 'network-security', 'computer-networks', 'chapter'].includes(entry.name))
    .map((entry) => `dist/study-notes/837/${entry.name}/index.html`);

  assert.ok(studyArticleDirs.length > 0);
  let hasCrossPrev = false;
  let hasCrossNext = false;
  for (const file of studyArticleDirs) {
    const html = read(file);
    assert.doesNotMatch(html, /class="article-quick-jump"/);
    assert.match(html, /data-toc-jump-toggle/);
    assert.doesNotMatch(html, /data-toc-jump-filter|data-toc-module-tab/);
    if (/上一模块（/.test(html)) hasCrossPrev = true;
    if (/下一模块（/.test(html)) hasCrossNext = true;
  }
  assert.ok(hasCrossPrev, 'Expected at least one study note at module boundary with previous cross-module link');
  assert.ok(hasCrossNext, 'Expected at least one study note at module boundary with next cross-module link');
});

test('article pages mount fixed non-repeating random tile background while non-article pages keep upper grid only', () => {
  for (const articlePage of ['dist/study-notes/837/decision-tree-c45/index.html', 'dist/blog/bert/index.html']) {
    const html = read(articlePage);
    assert.match(html, /class="article-fixed-tile-backdrop"/, `${articlePage} must mount fixed random tile backdrop`);
    assert.match(html, /data-article-fixed-tile/, `${articlePage} must include data-article-fixed-tile canvas`);
    assert.match(html, /class="dotgrid-hero-backdrop"/, `${articlePage} must keep upper ambient grid for top transition`);
  }
  for (const nonArticlePage of [
    'dist/index.html',
    'dist/about/index.html',
    'dist/blog/index.html',
    'dist/study-notes/index.html',
    'dist/tools/index.html',
    'dist/study-notes/837/information-security/index.html',
  ]) {
    const html = read(nonArticlePage);
    assert.ok(!html.includes('article-fixed-tile-backdrop'), `${nonArticlePage} must not include article-fixed-tile-backdrop`);
    assert.ok(!html.includes('data-article-fixed-tile'), `${nonArticlePage} must not include data-article-fixed-tile`);
  }

  const tileScript = read('src/scripts/article-tile-bg.ts');
  assert.ok(!tileScript.includes('requestAnimationFrame'), 'article-tile-bg must not run a requestAnimationFrame animation loop');
  assert.ok(!tileScript.includes('setInterval'), 'article-tile-bg must not run a setInterval loop');

  const ambientGrid = read('src/scripts/ambient-grid.ts');
  assert.match(ambientGrid, /const squareSize = Math\.round\(\(44 \* 2\) \/ 3\);/, 'ambient grid side length across all pages must be 2/3 of 44px');
});

test('article TOC preserves smooth scrolling, study cards/chapter nav omit left green bars, and nav aligns numbers', () => {
  const recallScript = read('src/scripts/recall.ts');
  assert.match(recallScript, /revealTarget\(link\.hash,\s*false\)/, 'recall.ts must not override TOC click smooth scrolling with instant jump');

  const globalCss = read('src/styles/global.css');
  const seriesRowRule = globalCss.match(/\.study-series-row\s*\{[^}]*\}/)?.[0] ?? '';
  assert.ok(!seriesRowRule.includes('border-left:'), 'study overview module cards must not render left green accent bar');

  const knowledgeCss = read('src/styles/knowledge-tags.css');
  const slideRule = knowledgeCss.match(/\.study-chapter-nav nav\.has-slide-indicator \.nav-slide-indicator\s*\{[^}]*\}/)?.[0] ?? '';
  assert.ok(!slideRule.includes('border-left:'), 'chapter nav active indicator must not render left green accent bar');
  assert.match(knowledgeCss, /\.study-chapter-nav a\s*\{[^}]*align-items:\s*baseline;/, 'chapter nav items baseline-align numbers and text');
});

test('built HTML text nodes contain zero residual literal ** or __ outside code/math', () => {
  const hits = scanBuiltBoldIssues(fileURLToPath(new URL('../dist', import.meta.url)));
  assert.deepEqual(hits, []);
});

test('site preserves cross-page View Transitions without title morph and honors reduced motion', () => {
  const globalCss = read('src/styles/global.css');
  assert.match(globalCss, /prefers-reduced-motion:\s*no-preference[\s\S]*@view-transition\s*\{\s*navigation:\s*auto;\s*\}/);
  assert.doesNotMatch(globalCss, /view-transition-name/, 'heading view-transition-name must stay disabled to prevent title pop');
  assert.match(globalCss, /@keyframes study-module-enter/);
  assert.match(globalCss, /prefers-reduced-motion:\s*reduce[\s\S]*animation:\s*none !important/);

  const overviewScript = read('src/scripts/study-overview.ts');
  assert.match(overviewScript, /prefers-reduced-motion:\s*reduce/);
});
