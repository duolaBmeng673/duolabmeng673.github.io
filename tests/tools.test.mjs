import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { defineTools, groupTools, tools } from '../src/data/tools.ts';
import {
  CATEGORY_FALLBACK_ICONS,
  CUSTOM_TOOL_ICONS_DIR,
  DEFAULT_TOOL_ICON,
  hasLucideIcon,
  hasToolIcon,
  loadLucideSvg,
  resolveToolIconName,
} from '../src/lib/tool-icons.ts';

const file = (path) => new URL('../' + path, import.meta.url);
const read = (path) => readFileSync(file(path), 'utf8');

test('tool links can be maintained with only a name and URL', () => {
  assert.deepEqual(defineTools([{ name: ' 我的工具 ', url: ' https://example.com/tool ' }]), [
    { name: '我的工具', url: 'https://example.com/tool' },
  ]);
  assert.deepEqual(defineTools([{ name: '工具', url: 'https://example.com', description: ' ', category: '', icon: '  ' }]), [
    { name: '工具', url: 'https://example.com' },
  ]);
  assert.deepEqual(defineTools([{ name: '带图标工具', url: 'https://example.com/icon', icon: ' sparkles ' }]), [
    { name: '带图标工具', url: 'https://example.com/icon', icon: 'sparkles' },
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
  const ordered = groupTools(tools).flatMap((group) => group.tools);
  assert.equal(cards.length, tools.length);
  for (const [index, card] of cards.entries()) {
    assert.ok(card[0].includes(`href="${ordered[index].url}"`));
    assert.match(card[0], /target="_blank"/);
    assert.match(card[0], /rel="noopener noreferrer"/);
    assert.ok(card[1].includes(ordered[index].name));
    assert.ok(card[1].includes('新窗口打开'));
    assert.ok(!card[1].includes('undefined'));
    assert.ok(!card[1].includes('<script'));
  }
});

test('tools group on one page by category with a fallback for name-and-URL-only additions', () => {
  const entries = defineTools([
    { name: '壁纸 A', url: 'https://example.com/a', category: '壁纸' },
    { name: '文档', url: 'https://example.com/b', category: '文档' },
    { name: '壁纸 B', url: 'https://example.com/c', category: '壁纸' },
    { name: '无分类', url: 'https://example.com/d' },
  ]);
  const groups = groupTools(entries);
  assert.deepEqual(groups.map((group) => group.category), ['壁纸', '文档', '其他']);
  assert.deepEqual(groups[0].tools.map((tool) => tool.name), ['壁纸 A', '壁纸 B']);
  assert.deepEqual(groups[2].tools.map((tool) => tool.name), ['无分类']);
  assert.equal(entries[1].name, '文档', 'grouping does not reorder the source list');
  assert.deepEqual(groupTools([]), []);
  const html = read('dist/tools/index.html');
  const headings = [...html.matchAll(/<h2\b[^>]*>([^]*?)<\/h2>/g)].map(([, text]) => text);
  assert.deepEqual(headings, groupTools(tools).map((group) => group.category));
  for (const { category } of groupTools(tools)) assert.ok(html.includes(`aria-label="${category}列表"`));
  assert.ok(!html.includes('href="/tools/壁纸'));
});

test('tool navigation and homepage entry remain available on existing pages', () => {
  const expected = ['首页', '技术笔记', '学习笔记', '工具', '关于'];
  for (const path of ['dist/index.html', 'dist/blog/index.html', 'dist/study-notes/index.html', 'dist/about/index.html', 'dist/tools/index.html']) {
    const html = read(path);
    const nav = html.match(/<nav\b[^>]*aria-label="主导航"[^>]*>([^]*?)<\/nav>/)[1];
    assert.deepEqual([...nav.matchAll(/<a\b[^>]*>([^]*?)<\/a>/g)].map(([, label]) => label.trim()), expected, path);
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1, path);
  }
  const homeHtml = read('dist/index.html');
  assert.ok(!homeHtml.includes('home-tool-entry'), 'homepage slim tool strip must be removed');
  assert.ok(homeHtml.includes('href="/tools/"'), 'tools link remains available via homepage navigation/footer/mobile grid');
  assert.ok(read('dist/tools/index.html').includes('aria-current="page">工具'));
  assert.ok(!homeHtml.includes('哈工大空教室查询'));
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
  assert.doesNotMatch(read('dist/tools/index.html'), /常用的在线工具与资源，点击后在新窗口打开。/);
  assert.match(read('dist/tools/index.html'), /收录工具/);
  assert.match(read('dist/tools/index.html'), /工具分组/);
});

test('all configured and fallback tool icons exist in lucide-static and inline cleanly without runtime JS', () => {
  const rawTools = JSON.parse(read('src/data/tools.json'));
  assert.equal(rawTools.length, tools.length);

  for (const tool of rawTools) {
    assert.equal(typeof tool.icon, 'string', `${tool.name} must configure an icon field`);
    assert.ok(tool.icon.trim().length > 0, `${tool.name} icon field must not be empty`);
    const iconName = tool.icon.trim();
    assert.ok(
      hasToolIcon(iconName),
      `${tool.name} icon "${tool.icon}" must exist in custom tool-icons or node_modules/lucide-static/icons`,
    );
    const hasCustom = existsSync(`${CUSTOM_TOOL_ICONS_DIR}/${iconName}.svg`);
    const hasPkg = existsSync(file(`node_modules/lucide-static/icons/${iconName}.svg`));
    assert.ok(hasCustom || hasPkg, `Missing SVG file for ${tool.name}: ${iconName}.svg`);
  }

  for (const [category, fallbackIcon] of Object.entries(CATEGORY_FALLBACK_ICONS)) {
    assert.ok(
      hasLucideIcon(fallbackIcon),
      `Fallback icon "${fallbackIcon}" for category "${category}" must exist in lucide-static`,
    );
  }
  assert.ok(
    hasLucideIcon(DEFAULT_TOOL_ICON),
    `Default fallback icon "${DEFAULT_TOOL_ICON}" must exist in lucide-static`,
  );

  assert.throws(() => loadLucideSvg('nonexistent-icon-xyz'), /lucide-static/);
  assert.equal(resolveToolIconName({ icon: 'sparkles', category: '壁纸' }), 'sparkles');
  assert.equal(resolveToolIconName({ category: '壁纸' }), CATEGORY_FALLBACK_ICONS['壁纸']);
  assert.equal(resolveToolIconName({ category: '未知分组' }), DEFAULT_TOOL_ICON);
  assert.equal(resolveToolIconName({}), DEFAULT_TOOL_ICON);

  const html = read('dist/tools/index.html');
  assert.ok(!html.includes('preview-icon'), 'tools page must not contain preview-icon class');
  assert.ok(!html.includes('<astro-island'), 'tools page must not mount any React islands');

  const cards = [...html.matchAll(/<a\b[^>]*class="tool-card"[^>]*>([^]*?)<\/a>/g)];
  const ordered = groupTools(tools).flatMap((group) => group.tools);
  assert.equal(cards.length, ordered.length);

  for (const [index, card] of cards.entries()) {
    const tool = ordered[index];
    const markMatch = card[1].match(/<span class="tool-mark" aria-hidden="true">([^]*?)<\/span>/);
    assert.ok(markMatch, `${tool.name} must render .tool-mark`);
    const svgMatch = markMatch[1].match(/<svg\b[^>]*>/);
    assert.ok(svgMatch, `${tool.name} .tool-mark must contain an inline <svg>`);
    assert.match(svgMatch[0], /\bstroke="currentColor"/);
    assert.match(svgMatch[0], /\bstroke-width="2"/);
    assert.match(svgMatch[0], /\baria-hidden="true"/);
    assert.doesNotMatch(svgMatch[0], /preview-icon/);
    assert.ok(svgMatch[0].includes(`lucide-${resolveToolIconName(tool)}`), `${tool.name} rendered wrong icon`);
    assert.ok(card[1].includes('<span class="tool-card-arrow" aria-hidden="true">↗</span>'));
  }
});
