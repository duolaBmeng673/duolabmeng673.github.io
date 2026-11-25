import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as activity from '../src/lib/activity.ts';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const records = [
  { date: '2026-11-02', type: 'writing', count: 2, description: '两篇新文章' },
  { date: '2026-11-02', type: 'research', count: 1 },
  { date: '2026-11-02', type: 'learning', count: 3, description: '<em>学习记录</em>' },
];

test('activity counts sum records while active dates are counted only once', () => {
  const calendar = activity.createActivityCalendar(records, new Date(2026, 10, 2));
  assert.equal(calendar.activityDays, 1);
  assert.equal(calendar.totalActivities, 6);
  const details = activity.getActivityDayDetails(calendar.columns.flat().find((day) => day?.date === '2026-11-02'));
  assert.equal(details.dateLabel, '2026 年 11 月 2 日');
  assert.equal(details.total, 6);
  assert.deepEqual(details.groups.map((group) => [group.type, group.label, group.count]), [['writing', '写作', 2], ['research', '研究', 1], ['learning', '学习', 3]]);
  assert.deepEqual(details.groups[1].descriptions, [], 'missing descriptions do not hide a valid count');
  const empty = activity.getActivityDayDetails(calendar.columns.flat().find((day) => day?.date === '2026-11-01'));
  assert.equal(empty.total, 0);
  assert.deepEqual(empty.groups, []);
  assert.ok(empty.label.includes('当天没有活动'));
  for (const count of [0, -1, 1.5, NaN]) assert.throws(() => activity.createActivityCalendar([{ ...records[0], count }]), /Invalid activity record/);
});

test('blog feature updates remain distinct and aggregate with content without overwriting it', () => {
  const calendar = activity.createActivityCalendar([
    { date: '2026-11-10', type: 'site', count: 1, description: '完成博客功能' },
    { date: '2026-11-11', type: 'site', count: 1, description: '完成工具分类' },
    { date: '2026-11-11', type: 'writing', count: 2, description: '两篇新文章' },
  ], new Date(2026, 10, 11));
  assert.equal(calendar.activityDays, 2);
  assert.equal(calendar.totalActivities, 4);
  const days = calendar.columns.flat().filter(Boolean);
  const site = days.find((day) => day.date === '2026-11-10');
  const mixed = days.find((day) => day.date === '2026-11-11');
  assert.equal(activity.activityKind(site), 'site');
  assert.equal(activity.activityKind(mixed), 'mixed');
  assert.equal(activity.activityKind(days.find((day) => day.date === '2026-11-09')), 'content');
  assert.equal(activity.activityKind(null), 'content');
  assert.deepEqual(activity.getActivityDayDetails(mixed).groups.map(({ label, count }) => [label, count]), [['写作', 2], ['博客功能', 1]]);
  assert.ok(activity.getActivityDayDetails(site).label.includes('博客功能：1 次，完成博客功能'));
});

test('local calendar boundaries and labels survive year boundaries and daylight-saving changes', () => {
  const code = `
    import assert from 'node:assert/strict';
    import { createActivityCalendar, getActivityDayDetails } from ${JSON.stringify(new URL('../src/lib/activity.ts', import.meta.url).href)};
    const year = createActivityCalendar([
      {date:'2025-01-01',type:'writing',count:9},
      {date:'2025-01-02',type:'writing',count:1},
      {date:'2026-01-01',type:'learning',count:2},
      {date:'2026-01-02',type:'writing',count:9}
    ], new Date(2026,0,1,0,5));
    assert.equal(year.start,'2025-01-02'); assert.equal(year.end,'2026-01-01');
    assert.equal(year.activityDays,2); assert.equal(year.totalActivities,3);
    assert.equal(year.columns.flat().filter(Boolean).length,365);
    for(const [month,day,expected] of [[2,11,['2024-03-08','2024-03-09','2024-03-10','2024-03-11']],[10,4,['2024-11-01','2024-11-02','2024-11-03','2024-11-04']]]) {
      const result=createActivityCalendar([],new Date(2024,month,day),4);
      assert.deepEqual(result.columns.flat().filter(Boolean).map(day=>day.date),expected);
      assert.ok(getActivityDayDetails(result.columns.flat().filter(Boolean)[0]).dateLabel.startsWith('2024 年'));
    }
  `;
  for (const TZ of ['Asia/Singapore', 'America/Los_Angeles', 'UTC']) {
    execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', code], { env: { ...process.env, TZ }, stdio: 'pipe' });
  }
});

test('heat tokens use the site palette with monotonic, distinguishable adjacent levels in both themes', () => {
  const tokensCss = read('src/styles/tokens.css');
  const css = read('src/styles/global.css');
  const tokens = (source) => Object.fromEntries([...source.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, key, value]) => [key, value]));
  const rawLight = {
    ...tokens(tokensCss.match(/:root\s*{([^]*?)\n}/)[1]),
    ...tokens(css.match(/:root\s*{([^]*?)\n}/)[1]),
  };
  const rawDark = {
    ...rawLight,
    ...tokens(tokensCss.match(/:root\[data-theme="dark"\]\s*{([^]*?)\n}/)[1]),
    ...tokens(css.match(/:root\[data-theme="dark"\]\s*{([^]*?)\n}/)[1]),
  };
  const resolveToken = (palette, key) => {
    let cur = palette[key];
    for (let i = 0; i < 6 && cur; i++) {
      const m = cur.match(/^var\((--[\w-]+)(?:,\s*([^)]+))?\)$/);
      if (!m) break;
      cur = palette[m[1]] ?? m[2];
    }
    return cur;
  };
  const rgb = (hex) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const luminance = (channels) => channels.map((channel) => channel / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  for (const [theme, palette] of [['light', rawLight], ['dark', rawDark]]) {
    const bgRgb = rgb(resolveToken(palette, '--bg'));
    const levels = [0, 1, 2, 3, 4].map((level) => {
      const mix = palette[`--heat-${level}`].match(/^color-mix\(in srgb, var\((--text|--accent)\) (\d+)%, var\(--bg\)\)$/);
      assert.ok(mix, `${theme} level ${level} derives from shared tokens`);
      const weight = Number(mix[2]) / 100;
      return rgb(resolveToken(palette, mix[1])).map((channel, i) => channel * weight + bgRgb[i] * (1 - weight));
    }).map(luminance);
    levels.slice(1).forEach((value, index) => {
      assert.ok(theme === 'light' ? value < levels[index] : value > levels[index], `${theme} intensity is monotonic`);
      assert.ok((Math.max(value, levels[index]) + .05) / (Math.min(value, levels[index]) + .05) >= 1.25, `${theme} adjacent levels differ by at least 1.25:1`);
    });
    const site = palette['--heat-site'].match(/^color-mix\(in srgb, var\(--warm\) (\d+)%, var\(--bg\)\)$/);
    assert.ok(site, 'blog feature color derives from the shared warm accent');
    const weight = Number(site[1]) / 100;
    const feature = luminance(rgb(resolveToken(palette, '--warm')).map((channel, index) => channel * weight + bgRgb[index] * (1 - weight)));
    assert.ok((Math.max(feature, levels[0]) + .05) / (Math.min(feature, levels[0]) + .05) >= 1.5, `${theme} blog features are distinguishable from empty cells`);
  }
});

// A small DOM fixture exercises the actual client handlers without a browser or added dependency.
class Element {
  constructor(tagName = 'div', attrs = {}) {
    this.tagName = tagName; this.dataset = {}; this.children = []; this.attributes = {}; this.handlers = {};
    this.style = { setProperty() {} }; this.hidden = false; this.disabled = false;
    this._text = ''; this.className = ''; this.tabIndex = -1;
    for (const [name, value] of Object.entries(attrs)) this.setAttribute(name, value);
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'class') this.className = String(value);
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = String(value);
  }
  getAttribute(name) { return this.attributes[name]; }
  set textContent(text) { this._text = String(text); this.children = []; }
  get textContent() { return this._text + this.children.map((child) => child.textContent).join(''); }
  set innerHTML(_) { throw new Error('Activity descriptions must be text, not HTML'); }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  replaceChildren(...children) { this.children = []; this._text = ''; this.append(...children); }
  matches(selector) {
    if (selector.startsWith('.')) return this.className.split(' ').includes(selector.slice(1));
    const match = selector.match(/^(\w+)?\[([\w-]+)\]$/);
    return Boolean(match && (!match[1] || match[1] === this.tagName) && (match[2].startsWith('data-') ? Object.hasOwn(this.dataset, match[2].slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase())) : Object.hasOwn(this.attributes, match[2])));
  }
  querySelectorAll(selector) { return this.children.flatMap((child) => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) ?? null; }
  contains(node) { return node === this || this.children.some((child) => child.contains(node)); }
  addEventListener(name, callback) { this.handlers[name] = callback; }
  focus() { this.focused = true; }
}

test('date click, empty selection, repeated selection and keyboard movement update the existing detail panel', () => {
  const root = new Element('section', { 'data-activity-calendar': '', 'data-activity-data': JSON.stringify({ activities: [...records, { date: '2026-10-31', type: 'site', count: 1, description: '博客功能更新' }], writing: [] }) });
  for (const className of ['activity-grid', 'activity-calendar', 'activity-months']) root.append(new Element('div', { class: className }));
  root.append(new Element('p', { 'data-activity-summary': '' }));
  for (const part of ['date', 'total', 'groups', 'empty']) root.append(new Element(part === 'date' ? 'time' : 'div', { [`data-activity-detail-${part}`]: '' }));
  const document = { querySelectorAll: () => [root], createElement: (tag) => new Element(tag) };
  class FixedDate extends Date { constructor() { super(2026, 10, 2, 12); } }
  const script = ts.transpileModule(read('src/scripts/activity-calendar.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(script, { document, Date: FixedDate, exports: {}, require: () => activity });
  const date = root.querySelector('[data-activity-detail-date]');
  const total = root.querySelector('[data-activity-detail-total]');
  const empty = root.querySelector('[data-activity-detail-empty]');
  const groups = root.querySelector('[data-activity-detail-groups]');
  const buttons = root.querySelectorAll('button[data-date]');
  const filled = buttons.find((button) => button.dataset.date === '2026-11-02');
  const blank = buttons.find((button) => button.dataset.date === '2026-11-01');
  const site = buttons.find((button) => button.dataset.date === '2026-10-31');
  assert.equal(total.textContent, '6 次活动');
  assert.equal(groups.children.length, 3);
  assert.ok(groups.textContent.includes('研究 · 1 次'));
  assert.ok(groups.textContent.includes('<em>学习记录</em>'), 'descriptions remain literal text');
  assert.equal(filled.dataset.kind, 'content');
  assert.equal(site.dataset.kind, 'site');
  root.handlers.click({ target: site });
  assert.equal(date.textContent, '2026 年 10 月 31 日');
  assert.equal(total.textContent, '1 次活动');
  assert.ok(groups.textContent.includes('博客功能 · 1 次'));
  assert.equal(groups.children[0].children[0].dataset.activityType, 'site');
  root.handlers.click({ target: blank });
  assert.equal(date.textContent, '2026 年 11 月 1 日');
  assert.equal(total.textContent, '0 次活动');
  assert.equal(empty.hidden, false);
  assert.equal(groups.children.length, 0);
  assert.equal(filled.getAttribute('aria-selected'), 'false');
  assert.equal(blank.getAttribute('aria-selected'), 'true');
  root.handlers.click({ target: filled });
  assert.equal(empty.hidden, true);
  assert.equal(total.textContent, '6 次活动');
  const grid = root.querySelector('.activity-grid');
  grid.handlers.keydown({ target: filled, key: 'ArrowLeft', preventDefault() {} });
  assert.equal(date.textContent, '2026 年 10 月 26 日');
  assert.equal(total.textContent, '0 次活动');
  assert.ok(buttons.find((button) => button.dataset.date === '2026-10-26').focused);
  assert.equal(buttons.filter((button) => button.tabIndex === 0).length, 1);
});

test('the static homepage displays content-only categories backed by Git revisions and publication history', async () => {
  const html = read('dist/index.html');
  assert.ok(html.includes('<span>activity.heatmap</span>'));
  assert.equal((html.match(/id="activity-detail"/g) ?? []).length, 1);
  assert.ok(html.includes('data-activity-detail-items'));
  assert.ok(html.includes('data-activity-fallback'));
  assert.ok(!html.includes('heat-legend-site'), 'Homepage legend must not show 功能更新');
  const decode = (text) => text.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const payload = JSON.parse(decode(html.match(/data-activity-payload="([^"]+)"/)[1]));
  assert.equal(payload.activities.some((record) => record.type === 'site'), false, 'Homepage payload must omit site updates');
  const { getGitActivityResult } = await import('../src/lib/activity-git.ts');
  const gitContentEntries = getGitActivityResult().entries.filter((entry) => entry.type !== 'site');
  assert.equal(payload.activities.length, gitContentEntries.length);
  const posts = JSON.parse(read('dist/search-index.json'));
  assert.equal(payload.writing.length, posts.length);
  for (const post of posts) assert.ok(payload.writing.some((entry) => entry.date === post.date && entry.description === post.title && entry.count === 1));
  const independentWriting = posts.map((post) => ({ date: post.date, type: 'writing', count: 1, description: post.title }));
  const result = activity.createActivityCalendar([...gitContentEntries, ...independentWriting], new Date(`${payload.buildDate}T12:00:00`));
  const visible = activity.getVisibleCalendarStats(result, payload.buildDate, 34);
  assert.ok(html.includes(`${visible.windowLabel} ${visible.activityDays} 活跃日 · ${visible.totalActivities} 次活动`));
  assert.ok(html.includes(`${visible.windowLabel} · ${visible.activityDays} 活跃日 · ${visible.totalActivities} 次活动`));
  const latestItem = [...gitContentEntries, ...independentWriting].sort((a, b) => b.date.localeCompare(a.date))[0];
  if (latestItem?.description) assert.ok(html.includes(latestItem.description));
});

test('getActivitySummaryStats computes longest streak, month totals, cross-year edges, same-day merges and empty state', () => {
  const emptyCal = activity.createActivityCalendar([], new Date(2026, 10, 16));
  assert.deepEqual(activity.getActivitySummaryStats(emptyCal, '2026-11-16'), { longestStreak: 0, monthActivities: 0 });

  // Cross-month + cross-year boundary + multi-record same day + disjoint streaks
  const crossRecords = [
    { date: '2025-12-30', type: 'writing', count: 1 },
    { date: '2025-12-31', type: 'coding', count: 2 },
    { date: '2025-12-31', type: 'site', count: 1 },
    { date: '2026-01-01', type: 'learning', count: 1 },
    { date: '2026-01-02', type: 'research', count: 3 },
    { date: '2026-01-04', type: 'writing', count: 2 },
    { date: '2025-01-01', type: 'writing', count: 5 }, // out of 365-day window ending 2026-01-05
  ];
  const cal = activity.createActivityCalendar(crossRecords, new Date(2026, 0, 5), 365);
  const stats = activity.getActivitySummaryStats(cal, '2026-01-05');
  assert.equal(stats.longestStreak, 4, 'Dec 30..Jan 2 is a 4-day streak even with multiple records on Dec 31');
  assert.equal(stats.monthActivities, 6, '2026-01 counts Jan 1 (1) + Jan 2 (3) + Jan 4 (2), ignoring 2025-01 and 2025-12');
});

test('build-time anchorDate (buildDate) determines month/year stats identically across client timezones', () => {
  const code = `
    import assert from 'node:assert/strict';
    import { createActivityCalendar, getActivitySummaryStats } from ${JSON.stringify(new URL('../src/lib/activity.ts', import.meta.url).href)};
    const items = [
      { date: '2026-11-01', type: 'writing', count: 2 },
      { date: '2026-11-02', type: 'learning', count: 1 },
      { date: '2026-10-31', type: 'writing', count: 4 },
    ];
    const buildDate = '2026-11-16';
    const anchor = new Date(buildDate + 'T00:00:00');
    anchor.setHours(0, 0, 0, 0);
    const cal = createActivityCalendar(items, anchor, 365);
    assert.equal(cal.activityDays, 3);
    assert.equal(cal.totalActivities, 7);
    assert.deepEqual(getActivitySummaryStats(cal, buildDate), { longestStreak: 3, monthActivities: 3 });
  `;
  for (const TZ of ['Asia/Shanghai', 'America/Los_Angeles', 'Pacific/Auckland', 'UTC']) {
    execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', code], {
      env: { ...process.env, TZ },
      stdio: 'pipe',
    });
  }
});

test('heatmap stats use build-time buildDate and remain invariant under runtime Date.now override', () => {
  const islandSource = read('src/components/islands/ActivityHeatmap.island.tsx');
  assert.ok(!islandSource.includes('Date.now'), 'ActivityHeatmap island must not read runtime Date.now()');
  assert.ok(islandSource.includes('buildCalendar(writingItems, activityItems, actMap, buildDate)'));

  const buildDate = '2026-11-16';
  const items = [
    { date: '2026-11-05', type: 'writing', count: 2 },
    { date: '2026-11-14', type: 'site', count: 1 },
    { date: '2026-10-31', type: 'learning', count: 3 },
  ];
  const compute = () => {
    const anchor = new Date(`${buildDate}T00:00:00`);
    anchor.setHours(0, 0, 0, 0);
    const cal = activity.createActivityCalendar(items, anchor, 365);
    const stats = activity.getActivitySummaryStats(cal, buildDate);
    return {
      activityDays: cal.activityDays,
      totalActivities: cal.totalActivities,
      monthActivities: stats.monthActivities,
      longestStreak: stats.longestStreak,
    };
  };

  const baseline = compute();
  assert.deepEqual(baseline, { activityDays: 3, totalActivities: 6, monthActivities: 3, longestStreak: 1 });

  const RealDate = globalThis.Date;
  const fakeNow = RealDate.UTC(2035, 6, 15, 12, 0, 0);
  class MockDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(fakeNow);
      else super(...args);
    }
    static now() {
      return fakeNow;
    }
  }
  globalThis.Date = MockDate;
  try {
    assert.deepEqual(compute(), baseline, '"本月" and "近一年" stats must stay anchored to buildDate when Date.now() jumps years ahead');
  } finally {
    globalThis.Date = RealDate;
  }
});

test('window title and summary metrics derive from the same visible-weeks window', () => {
  const buildDate = '2026-11-16';
  const anchor = new Date(`${buildDate}T00:00:00`);
  anchor.setHours(0, 0, 0, 0);
  const records = [
    { date: '2026-01-10', type: 'writing', count: 5 }, // outside 34-week window
    { date: '2026-01-11', type: 'writing', count: 5 }, // outside 34-week window
    { date: '2026-11-10', type: 'writing', count: 2 }, // inside 34-week window & current month
    { date: '2026-11-11', type: 'site', count: 1 },    // inside 34-week window & current month
  ];
  const cal = activity.createActivityCalendar(records, anchor, 365);
  const win34 = activity.getVisibleCalendarStats(cal, buildDate, 34);
  assert.equal(win34.weeks, 34);
  assert.equal(win34.windowLabel, '近 34 周');
  assert.equal(win34.activityDays, 2);
  assert.equal(win34.totalActivities, 3);
  assert.equal(win34.longestStreak, 2);
  assert.equal(win34.monthActivities, 3);

  const winFull = activity.getVisibleCalendarStats(cal, buildDate, 53);
  assert.equal(winFull.windowLabel, '近一年');
  assert.equal(winFull.activityDays, 4);
  assert.equal(winFull.totalActivities, 13);

  const html = read('dist/index.html');
  const decode = (text) => text.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const payload = JSON.parse(decode(html.match(/data-activity-payload="([^"]+)"/)[1]));
  const builtCal = activity.createActivityCalendar(
    [...payload.activities, ...payload.writing],
    new Date(`${payload.buildDate}T00:00:00`),
    365,
  );
  const expected = activity.getVisibleCalendarStats(builtCal, payload.buildDate, 34);
  const plainHtml = html.replace(/<!--[\s\S]*?-->/g, '');
  assert.ok(plainHtml.includes(`${expected.windowLabel} ${expected.activityDays} 活跃日 · ${expected.totalActivities} 次活动`));
  assert.ok(plainHtml.includes(`最长连续 <strong>${expected.longestStreak} 天</strong>`));
  assert.match(
    plainHtml,
    new RegExp(
      `data-activity-stat="month"[^>]*data-activity-month="${expected.monthActivities}"[^>]*>[\\s\\S]*?<strong>${expected.monthActivities} 次</strong>`,
    ),
  );
});

test('git timestamps always normalize to Asia/Shanghai date regardless of runner timezone (UTC 16:30 -> next day)', async () => {
  const { toShanghaiDateKey } = await import('../src/lib/activity-git.ts');
  assert.equal(toShanghaiDateKey('2026-11-17T16:30:00Z'), '2026-11-18');
  assert.equal(toShanghaiDateKey('2026-11-17T15:59:59Z'), '2026-11-17');

  const code = `
    import assert from 'node:assert/strict';
    import { filterAndClassifyGitCommits } from ${JSON.stringify(new URL('../src/lib/activity-git.ts', import.meta.url).href)};
    const res = filterAndClassifyGitCommits([
      {
        hash: 'abc1234',
        shortHash: 'abc1234',
        parentCount: 1,
        committedAt: '2026-11-17T16:30:00Z',
        author: 'YYF',
        email: 'yyf@example.com',
        subject: 'feat: late utc update',
        files: [{ status: 'M', path: 'src/pages/about.astro' }],
      },
    ]);
    assert.equal(res.entries.length, 1);
    assert.equal(res.entries[0].date, '2026-11-18');
  `;
  for (const TZ of ['UTC', 'America/Los_Angeles', 'Asia/Shanghai']) {
    execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', code], {
      env: { ...process.env, TZ },
      stdio: 'pipe',
    });
  }
});

test('git filtering drops configured noise, deduplicates imported notes, and caps batch commits at 1 per category', async () => {
  const { filterAndClassifyGitCommits, getGitActivityResult } = await import('../src/lib/activity-git.ts');
  const synthetic = filterAndClassifyGitCommits([
    { hash: '1', shortHash: '1', parentCount: 2, committedAt: '2026-11-10T10:00:00Z', author: 'a', email: 'a@x', subject: 'Merge branch', files: [{ status: 'M', path: 'src/pages/index.astro' }] },
    { hash: '2', shortHash: '2', parentCount: 1, committedAt: '2026-11-10T10:00:00Z', author: 'dependabot[bot]', email: 'bot@github.com', subject: 'bump astro', files: [{ status: 'M', path: 'package.json' }] },
    { hash: '3', shortHash: '3', parentCount: 1, committedAt: '2026-11-10T10:00:00Z', author: 'a', email: 'a@x', subject: 'Fix css glitch', files: [{ status: 'M', path: 'src/styles/global.css' }] },
    { hash: '4', shortHash: '4', parentCount: 1, committedAt: '2026-11-10T10:00:00Z', author: 'a', email: 'a@x', subject: 'Revert "Fix css glitch"', files: [{ status: 'M', path: 'src/styles/global.css' }] },
    { hash: '5', shortHash: '5', parentCount: 1, committedAt: '2026-11-10T10:00:00Z', author: 'a', email: 'a@x', subject: 'chore: cleanup', files: [{ status: 'D', path: 'public/foo.png' }] },
    { hash: '6', shortHash: '6', parentCount: 1, committedAt: '2026-11-10T10:00:00Z', author: 'a', email: 'a@x', subject: 'adjust spacing', files: [{ status: 'M', path: 'src/pages/about.astro' }], isWhitespaceOnly: true },
    { hash: '7', shortHash: '7', parentCount: 1, committedAt: '2026-11-10T10:00:00Z', author: 'a', email: 'a@x', subject: 'fix typo', files: [{ status: 'M', path: 'src/content/blog_read/bert.md' }], mdChangedChars: 12 },
    {
      hash: '8',
      shortHash: '8',
      parentCount: 1,
      committedAt: '2026-11-18T03:00:00Z',
      author: 'a',
      email: 'a@x',
      subject: 'perf(blog): batch migrate 68 images',
      files: [
        { status: 'M', path: 'src/layouts/BlogLayout.astro' },
        { status: 'M', path: 'src/content/blog_read/bert.md' },
        { status: 'M', path: 'src/content/blog_read/clip.md' },
        { status: 'A', path: 'src/content/blog_read/bert/assets/image.png' },
      ],
      mdChangedChars: 120,
    },
    {
      hash: '9',
      shortHash: '9',
      parentCount: 1,
      committedAt: '2026-09-08T03:00:00Z',
      author: 'a',
      email: 'a@x',
      subject: 'Publish 12 new paper notes',
      files: [
        { status: 'A', path: 'src/content/blog_read/bert.md' },
        { status: 'A', path: 'src/content/blog_read/clip.md' },
      ],
    },
  ]);

  assert.equal(synthetic.filteredCount, 7);
  assert.deepEqual(synthetic.filterHits, {
    mergeCommits: 1,
    botAuthors: 1,
    revertNoise: 2,
    messagePrefix: 1,
    whitespaceOnly: 1,
    tinyMarkdownOnly: 1,
  });
  assert.equal(synthetic.entries.length, 2, 'batch commit yields at most 1 revision + 1 site; added notes do not duplicate');
  assert.deepEqual(synthetic.entries.map((e) => [e.category, e.count]), [['revision', 1], ['site', 1]]);

  const realGit = getGitActivityResult();
  assert.equal(realGit.filteredCount, Object.values(realGit.filterHits).reduce((a, b) => a + b, 0));
  assert.ok(realGit.filteredCount > 0);
  assert.equal(realGit.entries.filter((e) => e.shortHash === 'c0006fa').length, 2);
  assert.equal(realGit.entries.filter((e) => e.shortHash === 'fdae2a2').length, 0);

  const redacted = filterAndClassifyGitCommits([
    {
      hash: '10',
      shortHash: '10',
      parentCount: 1,
      committedAt: '2026-11-18T04:00:00Z',
      author: 'a',
      email: 'a@x',
      subject: `docs: update ${['Hua', 'wei'].join('')} 华为 notes`,
      files: [{ status: 'M', path: 'src/content/blog_coding_practice/acm_io.md' }],
      mdChangedChars: 80,
    },
  ]);
  assert.equal(redacted.entries.length, 1);
  assert.equal(redacted.entries[0].count, 1);
  assert.equal(redacted.entries[0].description, '内容更新');
});

test('buildDate uses Asia/Shanghai so UTC 16:30 lands on next day inside the final calendar cell across any runner TZ', () => {
  const code = `
    import assert from 'node:assert/strict';
    import { createActivityCalendar } from ${JSON.stringify(new URL('../src/lib/activity.ts', import.meta.url).href)};
    import { toShanghaiDateKey } from ${JSON.stringify(new URL('../src/lib/activity-git.ts', import.meta.url).href)};

    const buildInstant = new Date('2026-11-17T16:30:00Z');
    const buildDate = toShanghaiDateKey(buildInstant);
    assert.equal(buildDate, '2026-11-18');

    const commitDate = toShanghaiDateKey('2026-11-17T16:30:00Z');
    assert.equal(commitDate, buildDate);

    const anchor = new Date(buildDate + 'T00:00:00');
    anchor.setHours(0, 0, 0, 0);
    const cal = createActivityCalendar([{ date: commitDate, type: 'revision', count: 1, description: 'late utc fix' }], anchor, 365);
    assert.equal(cal.end, '2026-11-18');
    const validCells = cal.columns.flat().filter(Boolean);
    const lastCell = validCells[validCells.length - 1];
    assert.equal(lastCell.date, '2026-11-18');
    assert.equal(lastCell.types.revision, 1);
  `;
  for (const TZ of ['UTC', 'America/Los_Angeles', 'Asia/Shanghai']) {
    execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', code], {
      env: { ...process.env, TZ },
      stdio: 'pipe',
    });
  }
});

test('shallow repository check aborts loudly while full clone succeeds', async () => {
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { assertFullGitHistory, getGitActivityResult } = await import('../src/lib/activity-git.ts');

  const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
  const tmp = mkdtempSync(join(tmpdir(), 'git-depth-check-'));
  const shallowDir = join(tmp, 'shallow');
  const fullDir = join(tmp, 'full');
  try {
    execFileSync('git', ['clone', '--depth=1', `file://${root}`, shallowDir], { stdio: 'pipe' });
    assert.throws(() => assertFullGitHistory(shallowDir), /Shallow git repository detected/);

    execFileSync('git', ['clone', `file://${root}`, fullDir], { stdio: 'pipe' });
    assert.doesNotThrow(() => assertFullGitHistory(fullDir));
    assert.equal(
      getGitActivityResult({ cwd: fullDir, bypassCache: true }).totalCommits,
      getGitActivityResult().totalCommits,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('/about/ renders zero-React full-history scrollable heatmap with all 5 categories, accessible cells, and data-* bindings', async () => {
  const aboutHtml = read('dist/about/index.html');
  assert.ok(!/<astro-island\b/i.test(aboutHtml), '/about/ must remain React-free');
  assert.ok(aboutHtml.includes('data-about-heatmap'));
  assert.ok(aboutHtml.includes('data-about-heatmap-payload='));
  assert.ok(aboutHtml.includes('data-active-range="all"'));
  assert.ok(aboutHtml.includes('data-about-scroll'));

  // Removed UI elements must stay absent
  assert.ok(!aboutHtml.includes('data-heatmap-range='), 'Year/range switch buttons must be removed');
  assert.ok(!aboutHtml.includes('about-heat-subtitle'), 'Heatmap subtitle must be removed');
  assert.ok(!aboutHtml.includes('data-activity-filtered-count'), 'Filter summary note must be removed');

  const decode = (text) => text.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const payload = JSON.parse(decode(aboutHtml.match(/data-about-heatmap-payload="([^"]+)"/)[1]));
  for (const cat of ['paper', 'tech', 'study', 'revision', 'site']) {
    assert.ok(aboutHtml.includes(`data-filter-cat="${cat}"`), `Missing legend filter button for ${cat}`);
  }

  const cellLabels = [...aboutHtml.matchAll(/<button[^>]*role="gridcell"[^>]*data-date="([^"]+)"[^>]*>/g)];
  assert.ok(cellLabels.length >= 800, `Expected full-history >= 800 cells, got ${cellLabels.length}`);
  assert.ok(aboutHtml.includes('data-date="2024-07-13"'), 'Full-history grid includes earliest 2024 record');
  assert.ok(aboutHtml.includes(`data-date="${payload.buildDate}"`), 'Full-history grid includes buildDate');
  for (const [tag] of cellLabels) {
    assert.match(tag, /aria-label="[^"]+"/, 'Every active gridcell must have an aria-label');
  }

  const { buildAboutHeatmapModel } = await import('../src/lib/about-heatmap-model.ts');
  const mAll = buildAboutHeatmapModel(payload.entries, payload.buildDate, 'all', 'all');
  const mAllStudy = buildAboutHeatmapModel(payload.entries, payload.buildDate, 'all', 'study');
  assert.ok(mAll.columns.length >= 120, `Expected >= 120 full-history week columns, got ${mAll.columns.length}`);
  assert.ok(mAll.totalActivities > mAllStudy.totalActivities && mAllStudy.totalActivities > 0);
  assert.ok(mAll.rawCategoryCounts.site > mAll.categoryCounts.site, 'site raw count must exceed daily-capped count');
  assert.ok(aboutHtml.includes(`data-capped-count="${mAll.categoryCounts.site}"`));
  assert.ok(aboutHtml.includes(`data-raw-count="${mAll.rawCategoryCounts.site}"`));

  // Verify same-day site capping on synthetic 35-commit day: level/total capped at 1 while entries keep all 35
  const sameDaySite = Array.from({ length: 35 }, (_, idx) => ({
    date: '2026-11-16',
    category: 'site',
    categoryLabel: '功能更新',
    description: `site commit #${idx + 1}`,
    href: '/',
    shortHash: `s${idx}`,
  }));
  const cappedModel = buildAboutHeatmapModel(sameDaySite, '2026-11-18', '53w', 'all');
  const targetCell = cappedModel.columns.flat().find((c) => c && c.date === '2026-11-16');
  assert.equal(targetCell.total, 1);
  assert.equal(targetCell.rawTotal, 35);
  assert.equal(targetCell.level, 1);
  assert.equal(targetCell.entries.length, 35);
  assert.equal(cappedModel.categoryCounts.site, 1);
  assert.equal(cappedModel.rawCategoryCounts.site, 35);

  const m2024 = buildAboutHeatmapModel(payload.entries, payload.buildDate, '2024', 'all');
  const m2024Paper = buildAboutHeatmapModel(payload.entries, payload.buildDate, '2024', 'paper');
  assert.equal(m2024.start, '2024-01-01');
  assert.ok(m2024.totalActivities > 0 && m2024Paper.totalActivities > 0);
});

test('/about/ renders pure square cells with fixed category priority and grayscale-distinguishable tokens', async () => {
  const { buildAboutHeatmapModel } = await import('../src/lib/about-heatmap-model.ts');
  const mixedEntries = [
    ...Array.from({ length: 5 }, (_, i) => ({
      date: '2026-11-10',
      category: 'revision',
      categoryLabel: '修订',
      description: `rev ${i}`,
      href: '/blog/',
    })),
    {
      date: '2026-11-10',
      category: 'paper',
      categoryLabel: '论文笔记',
      description: 'paper item',
      href: '/blog/bert/',
    },
    ...Array.from({ length: 3 }, (_, i) => ({
      date: '2026-11-11',
      category: 'tech',
      categoryLabel: '技术笔记',
      description: `tech ${i}`,
      href: '/blog/',
    })),
    {
      date: '2026-11-11',
      category: 'study',
      categoryLabel: '学习笔记',
      description: 'study item',
      href: '/study-notes/837/',
    },
  ];
  const model = buildAboutHeatmapModel(mixedEntries, '2026-11-18', '53w', 'all');
  const cell10 = model.columns.flat().find((c) => c?.date === '2026-11-10');
  const cell11 = model.columns.flat().find((c) => c?.date === '2026-11-11');
  assert.equal(cell10.primaryCategory, 'paper', 'paper wins over 5 revisions on same day');
  assert.equal(cell11.primaryCategory, 'study', 'study wins over 3 tech entries on same day');
  assert.match(cell10.ariaLabel, /2026 年 11 月 10 日/);
  assert.match(cell10.ariaLabel, /主要类型：论文笔记/);
  assert.match(cell10.ariaLabel, /论文笔记 1 次/);
  assert.match(cell10.ariaLabel, /修订 5 次/);

  const aboutHtml = read('dist/about/index.html');
  assert.ok(!aboutHtml.includes('data-shape='), 'legend swatches must be pure solid squares without shapes');
  const aboutCss = read('src/styles/about-heatmap.css');
  assert.doesNotMatch(aboutCss, /\.about-heat-cell[^}]*::before|\.about-heat-cell[^}]*::after|\.about-legend-swatch[^}]*::before/);
  assert.match(aboutCss, /\.about-heat-cell\s*\{[^}]*width:\s*var\(--about-cell-size\);[^}]*height:\s*var\(--about-cell-size\);[^}]*border-radius:\s*3px;/);
  assert.match(aboutCss, /\.about-heat-calendar\s*\{[^}]*box-sizing:\s*content-box;[^}]*padding:\s*5px\s+7px\s+6px\s+5px;/);
  assert.ok(aboutHtml.includes('data-about-body') && aboutHtml.includes('data-about-grid-col') && aboutHtml.includes('data-about-month-track'));
  assert.ok(
    aboutHtml.indexOf('data-about-scroll') < aboutHtml.indexOf('data-about-legend') &&
      aboutHtml.indexOf('data-about-legend') < aboutHtml.indexOf('data-about-detail'),
    'Legend filter pills sit inside grid column directly below scrollable heatmap grid',
  );
  const globalCss = read('src/styles/global.css');
  assert.match(globalCss, /:root\[data-theme="dark"\]\s+\.article\[data-category="Study Notes"\]\s*\{[^}]*--cat-study:\s*#46ab91;/);

  const tokensCss = read('src/styles/tokens.css');
  const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const relLum = (rgb) => rgb
    .map((c) => c / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const labL = (y) => (y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y);
  const parseThemeBlock = (block) => Object.fromEntries(
    [...block.matchAll(/(--heat-cat-\w+):\s*(#[0-9a-fA-F]{6});/g)].map(([, k, v]) => [k, v]),
  );
  const lightBlock = tokensCss.match(/:root\s*\{([^]*?)\n\}/)[1];
  const darkBlock = tokensCss.match(/:root\[data-theme="dark"\]\s*\{([^]*?)\n\}/)[1];
  for (const [themeName, block] of [['light', lightBlock], ['dark', darkBlock]]) {
    const palette = parseThemeBlock(block);
    const lValues = Object.values(palette).map((hex) => labL(relLum(hexToRgb(hex)))).sort((a, b) => a - b);
    assert.equal(lValues.length, 5, `${themeName} has all 5 --heat-cat-* colors`);
    for (let i = 1; i < lValues.length; i++) {
      assert.ok(lValues[i] - lValues[i - 1] >= 11, `${themeName} grayscale L* gap >= 11 (${lValues[i - 1].toFixed(1)} -> ${lValues[i].toFixed(1)})`);
    }
  }
});

test('homepage heatmap uses container-width integer square sizing and follows preset accent colors', () => {
  const islandSource = read('src/components/islands/ActivityHeatmap.island.tsx');
  assert.ok(!islandSource.includes('innerWidth'), 'heatmap sizing must be container-driven without window.innerWidth');
  assert.match(islandSource, /Math\.floor\(/, 'square side length uses integer pixels');
  assert.match(islandSource, /data-preset/);
  assert.match(islandSource, /duolabmeng673:preset-change/);

  const homeCss = read('src/styles/home.css');
  assert.match(homeCss, /\.stage \.win\.w4\s*\{[^}]*--heat-1:[^}]*--preset-accent/);
  assert.match(homeCss, /\.stage \.win\.w4\s*\{[^}]*--heat-4:\s*var\(--preset-accent/);
});
