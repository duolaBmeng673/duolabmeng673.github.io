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
  const css = read('src/styles/global.css');
  const tokens = (source) => Object.fromEntries([...source.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, key, value]) => [key, value]));
  const light = tokens(css.match(/:root\s*{([^]*?)\n}/)[1]);
  const dark = { ...light, ...tokens(css.match(/:root\[data-theme="dark"\]\s*{([^]*?)\n}/)[1]) };
  const rgb = (hex) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const luminance = (channels) => channels.map((channel) => channel / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  for (const [theme, palette] of [['light', light], ['dark', dark]]) {
    const levels = [0, 1, 2, 3, 4].map((level) => {
      const mix = palette[`--heat-${level}`].match(/^color-mix\(in srgb, var\((--text|--accent)\) (\d+)%, var\(--bg\)\)$/);
      assert.ok(mix, `${theme} level ${level} derives from shared tokens`);
      const weight = Number(mix[2]) / 100;
      return rgb(palette[mix[1]]).map((channel, i) => channel * weight + rgb(palette['--bg'])[i] * (1 - weight));
    }).map(luminance);
    levels.slice(1).forEach((value, index) => {
      assert.ok(theme === 'light' ? value < levels[index] : value > levels[index], `${theme} intensity is monotonic`);
      assert.ok((Math.max(value, levels[index]) + .05) / (Math.min(value, levels[index]) + .05) >= 1.25, `${theme} adjacent levels differ by at least 1.25:1`);
    });
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
  const root = new Element('section', { 'data-activity-calendar': '', 'data-activity-data': JSON.stringify({ activities: records, writing: [] }) });
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
  assert.equal(total.textContent, '6 次活动');
  assert.equal(groups.children.length, 3);
  assert.ok(groups.textContent.includes('研究 · 1 次'));
  assert.ok(groups.textContent.includes('<em>学习记录</em>'), 'descriptions remain literal text');
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

test('the static homepage includes Chinese labels and daily details with unchanged publication-based history', () => {
  const html = read('dist/index.html');
  assert.match(html, /<h2\b[^>]*id="activity-title"[^>]*>更新记录<\/h2>/);
  assert.ok(html.includes('过去一年 · 写作、研究与学习'));
  assert.equal((html.match(/id="activity-detail"/g) ?? []).length, 1);
  assert.ok(html.includes('data-activity-detail-groups'));
  assert.ok(html.includes('aria-controls="activity-detail"'));
  const decode = (text) => text.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const payload = JSON.parse(decode(html.match(/data-activity-data="([^"]+)"/)[1]));
  const posts = JSON.parse(read('dist/search-index.json'));
  assert.equal(payload.writing.length, posts.length);
  for (const post of posts) assert.ok(payload.writing.some((entry) => entry.date === post.date && entry.description === post.title && entry.count === 1));
  const end = html.match(/data-end="([^"]+)"/)[1];
  const result = activity.createActivityCalendar([...payload.activities, ...payload.writing], new Date(`${end}T12:00:00`));
  assert.ok(html.includes(`${result.activityDays} 个活跃日 · ${result.totalActivities} 次活动`));
});
