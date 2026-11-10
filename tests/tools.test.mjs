import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { tools } from '../src/data/tools.ts';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const engineSource = read('public/vendor/hit-classroom/room-app.js');
const context = { module: { exports: {} } };
runInNewContext(engineSource, context);
const { createHitRoomApp } = context.module.exports;

test('classroom integration preserves the reviewed upstream engine exactly', () => {
  assert.equal(createHash('sha256').update(engineSource).digest('hex'), 'cff85b4cd99b85153ec16608964416f6722ad0a7a48d56535a8d3d8241b31ef7');
});

test('tools registry, original navigation, homepage and static routes agree', () => {
  const expected = ['首页', '技术笔记', '学习笔记', '工具', '关于'];
  for (const path of ['dist/index.html', 'dist/blog/index.html', 'dist/study-notes/index.html', 'dist/about/index.html', 'dist/tools/index.html', 'dist/tools/classrooms/index.html']) {
    const html = read(path);
    const nav = html.match(/<nav\b[^>]*aria-label="主导航"[^>]*>([^]*?)<\/nav>/)[1];
    assert.deepEqual([...nav.matchAll(/<a\b[^>]*>([^]*?)<\/a>/g)].map(([, label]) => label.trim()), expected, path);
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1, path);
  }
  assert.equal(tools.length, 1, 'only the implemented tool is advertised');
  for (const tool of tools) {
    assert.ok(read('dist/tools/index.html').includes(`href="${tool.href}"`));
    assert.ok(read('dist/sitemap.xml').includes(tool.href));
  }
  assert.ok(read('dist/index.html').includes('class="home-tool-entry" href="/tools/"'));
  const classroom = read('dist/tools/classrooms/index.html');
  assert.ok(classroom.includes('aria-current="page">工具'));
  assert.ok(classroom.includes('/vendor/hit-classroom/room-app.js'));
  assert.ok(classroom.includes('<noscript>'));
  assert.ok(classroom.includes('本站不提供在线登录或实时数据'));
  assert.ok(!classroom.includes('type="password"'));
  assert.ok(!classroom.includes('<iframe'));
  assert.ok(!JSON.parse(read('dist/search-index.json')).some((post) => post.href.startsWith('/tools/')), 'tools do not enter article history or search');
});

test('copied engine preserves all 147 time combinations, search, favorites and unknown-state safety', () => {
  const app = createHitRoomApp();
  const snapshot = {
    schemaVersion: 1, source: 'jwts.hit.edu.cn', complete: true,
    query: { term: '2026-20271', week: 11, campus: '1', building: 'synthetic' },
    capturedAt: new Date().toISOString(),
    rooms: Array.from({ length: 158 }, (_, i) => ({ name: `合成测试${i}`, bits: Array.from({ length: 42 }, (_, slot) => (i + slot) % 11 === 0 ? '?' : (i + slot) % 3 === 0 ? '1' : '0').join('') })),
  };
  assert.equal(app.validateSnapshot(snapshot), snapshot);
  for (let day = 0; day < 7; day++) for (let start = 0; start < 6; start++) for (let length = 1; length <= 6 - start; length++) {
    const actual = Array.from(app.selectRooms(snapshot, { day, start, length }), (room) => room.name).sort();
    const expected = snapshot.rooms.filter((room) => room.bits.slice(day * 6 + start, day * 6 + start + length) === '0'.repeat(length)).map((room) => room.name).sort();
    assert.deepEqual(actual, expected);
  }
  const favorite = '合成测试12';
  assert.deepEqual(Array.from(app.selectRooms(snapshot, { day: 0, start: 0, length: 1, onlyFree: false, onlyFavorites: true, favorites: [favorite], search: '12' }), (room) => room.name), [favorite]);
  assert.equal(app.available({ bits: '?'.repeat(42) }, 0, 0, 1), false);
  assert.equal(app.available({ bits: '1'.repeat(42) }, 0, 0, 1), false);
  assert.throws(() => app.validateSnapshot({ ...snapshot, complete: false }), /完整/);
  assert.throws(() => app.validateSnapshot({ ...snapshot, rooms: [snapshot.rooms[0], snapshot.rooms[0]] }), /重复/);
  assert.throws(() => app.validateSnapshot({ ...snapshot, capturedAt: '2099-01-01T00:00:00Z' }), /时间/);
  const exported = app.offlineHtml(snapshot);
  assert.ok(exported.includes(favorite));
  assert.ok(!exported.includes('/api/session'));
});

test('public blog cannot request school data even if a caller invokes the engine API', async () => {
  let requests = 0;
  const app = createHitRoomApp({ location: { hostname: 'duolabmeng673.github.io' }, fetch: () => { requests++; throw Error('unexpected network call'); } });
  const query = { term: '2026-20271', week: 11, campus: '1', building: 'synthetic' };
  for (const request of [() => app.collect(query), () => app.queryOptions(query), () => app.weekOptions(query.term), () => app.buildingOptions(query.campus)]) {
    await assert.rejects(request(), /自动同步需在已登录的教务页面/);
  }
  assert.equal(requests, 0);
  assert.match(read('src/scripts/tools/classrooms.ts'), /mount\(\{ enhanced: false \}\)/);
});
