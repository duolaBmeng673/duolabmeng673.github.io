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
    'information-security': ['security-basics', 'classical-ciphers-design-principles', 'symmetric-key-cryptography-des', 'public-key-cryptography-dh-rsa', 'hash-functions-principles', 'symmetric-authentication-kerberos', 'public-key-authentication-pki', 'access-control-models', 'windows-authentication-access-control', 'traditional-computer-viruses', 'firewall-netfilter', 'intrusion-detection-snort', 'ipsec', 'ssl', 'set', 'risk-management'],
    'network-security': ['network-protocol-vulnerabilities', 'dos-ddos-attacks', 'format-string-buffer-overflow', 'web-attack-techniques', 'network-packet-capture', 'packet-capture-bpf', 'libpcap-winpcap', 'host-discovery', 'port-scanning', 'kmp-algorithm', 'bm-algorithm', 'ac-algorithm', 'wm-algorithm', 'decision-tree-c45', 'naive-bayes-classification', 'k-means-clustering', 'agglomerative-clustering', 'divisive-clustering', 'dbscan-clustering'],
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
  const options = [...html.matchAll(/<option\b[^>]*value="([^"]*)"/g)].map((match) => match[1]);
  assert.ok(!options.includes('HIT 837'));
  assert.ok(!options.includes('考研复习'));
  const records = JSON.parse(html.match(/id="notes-index"[^>]*>([^]*?)<\/script>/)[1]);
  assert.equal(records.length, index.length, 'global queries and legacy tag links retain all public notes');
  const rows = [...html.matchAll(/<article\b([^>]*data-note-row[^>]*)>/g)].map((match) => match[1]);
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
  const csCount = countMarkdown(new URL('../src/content/blog_huawei_examination/', import.meta.url), { excludeHeld: true }).length;
  const infoSecCount = countMarkdown(new URL('../src/content/837考研/信息安全导论/', import.meta.url), { recursive: true }).length;
  const netSecCount = countMarkdown(new URL('../src/content/837考研/网络安全基础考点笔记总结/', import.meta.url), { recursive: true }).length;
  const studyCount = infoSecCount + netSecCount;
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
  assert.deepEqual([...breakdownCounts].map((m) => Number(m[1])), [researchCount, csCount, infoSecCount, netSecCount]);
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
      ratio: [896, 578],
    },
    {
      srcRel: 'src/content/837考研/信息安全导论/信息安全导论考点问题总结/5 防火墙、入侵检测与安全传输协议/5.c.1  IPSec/IKESA野蛮模式.svg',
      route: '/study-notes/837/ipsec/',
      encodedPrefix: 'IKESA%E9%87%8E%E8%9B%AE%E6%A8%A1%E5%BC%8F.',
      expectedAlt: 'IKE SA 野蛮模式',
      ratio: [845, 432],
    },
    {
      srcRel: 'src/content/837考研/信息安全导论/信息安全导论考点问题总结/5 防火墙、入侵检测与安全传输协议/5.c.2  SSL/SSL记录协议数据处理.svg',
      route: '/study-notes/837/ssl/',
      encodedPrefix: 'SSL%E8%AE%B0%E5%BD%95%E5%8D%8F%E8%AE%AE%E6%95%B0%E6%8D%AE%E5%A4%84%E7%90%86.',
      expectedAlt: 'SSL 记录协议数据处理流程',
      ratio: [998, 654],
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
