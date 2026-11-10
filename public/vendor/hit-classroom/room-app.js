/* School data stays in the school origin or in a user-exported local snapshot. */
function createHitRoomApp(env = globalThis) {
  const SOURCE = 'jwts.hit.edu.cn';
  const backend = env.hitRoomBackend === true;
  const scopePrefix = backend ? `hit-room-local:${env.hitRoomCacheNamespace}:` : '';
  const DEFAULT_QUERY = { term: '2026-20271', week: 11, campus: '1', building: '016' };
  const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const PERIODS = ['1–2', '3–4', '5–6', '7–8', '9–10', '11–12'];
  const TTL = 10 * 60 * 1000;
  const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);
  const validName = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 100 && !/[\x00-\x1f<>]/.test(value);
  const cleanName = value => String(value).replace(/\s+/g, '');
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const keyFor = q => `${scopePrefix}hit-empty-room-v1:${q.term}:${q.week}:${q.campus}:${q.building}`;
  const validQuery = q => q && /^\d{4}-\d{4}[1-4]$/.test(q.term) && Number.isInteger(q.week) && q.week >= 1 && q.week <= 60 && validId(q.campus) && validId(q.building);
  function validateSnapshot(s) {
    if (!s || s.schemaVersion !== 1 || s.source !== SOURCE || s.complete !== true) throw Error('这不是完整的教务占用快照。');
    const q = s.query;
    if (!validQuery(q)) throw Error('快照的学期、周次、校区或楼号不正确。');
    const time = Date.parse(s.capturedAt);
    if (!Number.isFinite(time) || time > Date.now() + 5 * 60000) throw Error('快照更新时间不正确。');
    if (!Array.isArray(s.rooms) || !s.rooms.length || s.rooms.length > 2000) throw Error('快照没有有效教室数据。');
    const seen = new Set();
    for (const r of s.rooms) {
      if (!r || !validName(r.name) || !/^[01?]{42}$/.test(r.bits) || seen.has(r.name)) throw Error('教室数据格式有误，或存在重复场地。');
      seen.add(r.name);
    }
    return s;
  }
  function freeRun(room, day, start) {
    let n = 0;
    for (let p = start; p < 6 && room.bits[day * 6 + p] === '0'; p++) n++;
    return n;
  }
  function available(room, day, start, length = 1) {
    return Number.isInteger(day) && day >= 0 && day < 7 && Number.isInteger(start) && start >= 0 && start < 6 && Number.isInteger(length) && length > 0 && start + length <= 6 && freeRun(room, day, start) >= length;
  }
  function selectRooms(snapshot, { day, start, length, search = '', onlyFree = true, onlyFavorites = false, favorites = [] }) {
    const favoriteSet = new Set(favorites);
    return snapshot.rooms.filter(r => r.name.includes(search.trim()) && (!onlyFavorites || favoriteSet.has(r.name)) && (!onlyFree || available(r, day, start, length))).sort((a, b) => {
      const aFree = available(a, day, start, length), bFree = available(b, day, start, length);
      return Number(bFree) - Number(aFree) || freeRun(b, day, start) - freeRun(a, day, start) || a.name.localeCompare(b.name, 'zh-CN', { numeric: true });
    });
  }
  function fields(q) {
    return { pageXnxq: q.term, pageZc1: String(q.week), pageZc2: String(q.week), pageXiaoqu: q.campus, pageLhdm: q.building, pageCddm: '' };
  }
  function parseSchoolDocument(doc, query, catalog) {
    for (const [id, expected] of Object.entries(fields(query))) {
      if (doc.getElementById(id)?.value !== expected) throw Error('学校返回的筛选条件与本次查询不同；已保留旧缓存。');
    }
    const catalogNames = catalog && new Set(catalog.map(r => cleanName(r.MC)));
    const candidates = [...doc.querySelectorAll('tr')].filter(r => catalogNames ? catalogNames.has(cleanName(r.cells[0]?.textContent || '')) : r.cells.length === 43 && validName(cleanName(r.cells[0]?.textContent || '')));
    if (!candidates.length) throw Error('没有收到教室占用表，请检查校园网及教务登录状态。');
    const header = candidates[0].closest('table')?.rows[0]?.textContent || '';
    if ((header.match(/星期[一二三四五六日]/g) || []).join(',') !== '星期一,星期二,星期三,星期四,星期五,星期六,星期日') throw Error('学校的星期表头已改变，无法安全解释占用数据。');
    const rooms = candidates.map(row => {
      if (row.cells.length !== 43) throw Error('学校的节次表结构已改变，无法安全解释占用数据。');
      const bits = [...row.cells].slice(1).map(cell => {
        if (cell.querySelector('.kjs_icon01')) return '1';
        const meaningful = [...cell.querySelectorAll('*')].some(e => e.className || e.tagName !== 'DIV');
        return meaningful || cell.textContent.trim() ? '?' : '0';
      }).join('');
      return { name: cleanName(row.cells[0].textContent), bits };
    });
    if (catalog) {
      const expected = new Set(catalog.map(r => cleanName(r.MC)));
      if (expected.size !== catalog.length || rooms.length !== expected.size || rooms.some(r => !expected.has(r.name))) throw Error(`收到的场地不完整（${rooms.length}/${expected.size}），不会将部分页面当成完整结果。`);
    } else if (doc.querySelector('a[href*="javascript:jump"]')) {
      throw Error('原页面仍有分页，请同步完整数据后查看。');
    }
    const label = id => doc.getElementById(id)?.selectedOptions?.[0]?.textContent?.trim();
    return validateSnapshot({ schemaVersion: 1, source: SOURCE, query: { ...query }, termLabel: label('pageXnxq') || query.term, campusLabel: label('pageXiaoqu') || query.campus, buildingLabel: label('pageLhdm') || query.building, capturedAt: new Date().toISOString(), complete: true, rooms });
  }
  async function request(path, body, signal) {
    const options = { credentials: 'same-origin', mode: 'same-origin', redirect: 'error', cache: 'no-store', signal };
    if (body) { options.method = 'POST'; options.body = new URLSearchParams(body); }
    const response = await env.fetch(backend ? '/api/school' + path : path, options);
    if (backend && response.status === 401) { env.hitRoomSessionExpired?.(); throw Error('学校登录已过期，请重新登录。'); }
    if (!response.ok) throw Error(`教务系统暂时未返回正常结果（${response.status}）。`);
    return response;
  }
  async function schoolTask(task) {
    if (!backend && env.location.hostname !== SOURCE) throw Error('自动同步需在已登录的教务页面中运行。');
    const controller = new env.AbortController();
    const timeout = env.setTimeout(() => controller.abort(), 30000);
    try {
      return await task(controller.signal);
    } catch (e) {
      if (e.name === 'AbortError') throw Error('校园网响应超过 30 秒，已停止本次同步。旧缓存仍可查看。');
      if (e instanceof TypeError || e instanceof SyntaxError) throw Error('暂时无法读取教务数据，请检查校园网；登录过期时点“学校登录”，完成后重新点助手书签。');
      throw e;
    } finally { env.clearTimeout(timeout); }
  }
  function normalizeCatalog(raw, kind) {
    if (!Array.isArray(raw) || !raw.length || raw.length > 2000 || raw.some(r => !validName(r.MC) || !validId(String(r.DM || '')))) throw Error(`无法获取${kind}清单，请检查校园网及学校登录状态。`);
    const items = raw.map(r => ({ value: String(r.DM), label: r.MC.trim() }));
    if (new Set(items.map(r => r.value)).size !== items.length) throw Error(`${kind}清单包含重复编号，已停止更新。`);
    return items;
  }
  async function buildingOptions(campus) {
    return schoolTask(async signal => normalizeCatalog(await (await request('/kjscx/queryJxlListBySjid', { id: campus }, signal)).json(), '楼宇'));
  }
  async function weekOptions(term) {
    return schoolTask(async signal => {
      const raw = await (await request('/kjscx/querykclistbyxnxq', { xnxq: term }, signal)).json();
      if (!Array.isArray(raw) || !raw.length || raw.some(r => !Number.isInteger(Number(r.ZC)) || Number(r.ZC) < 1 || Number(r.ZC) > 60)) throw Error('无法获取此学期的教学周，请重新读取查询条件。');
      return [...new Set(raw.map(r => Number(r.ZC)))].sort((a,b) => a-b).map(n => ({ value: String(n), label: `第 ${n} 周` }));
    });
  }
  async function queryOptions(query) {
    return schoolTask(async signal => {
      const response = await request('/kjscx/queryKjs', fields(query), signal);
      const doc = new env.DOMParser().parseFromString(await response.text(), 'text/html');
      function options(id) {
        const select = doc.getElementById(id);
        if (!select?.options) throw Error('尚未取得查询条件。请点“学校登录”，完成登录后重新点助手书签。');
        return [...select.options].map(o => ({ value: o.value.trim(), label: o.textContent.trim() })).filter(o => o.value && !/^[-—\s]*(全部|请选择)/.test(o.label));
      }
      const terms = options('pageXnxq').filter(o => /^\d{4}-\d{4}[1-4]$/.test(o.value)), campuses = options('pageXiaoqu').filter(o => validId(o.value));
      if (!terms.length || !campuses.length) throw Error('学校未返回可用的学期或校区选项，已停止更新。');
      return { terms, campuses };
    });
  }
  async function collect(query) {
    return schoolTask(async signal => {
      const raw = await (await request('/kjscx/queryJxcdListBySjid', { id: query.building }, signal)).json();
      normalizeCatalog(raw, '场地');
      const result = await request('/kjscx/queryKjs', { ...fields(query), pageSize: String(Math.max(200, raw.length)), pageNum: '1' }, signal);
      return parseSchoolDocument(new env.DOMParser().parseFromString(await result.text(), 'text/html'), query, raw);
    });
  }
  function readCache(q) {
    try { const s = validateSnapshot(JSON.parse(env.localStorage.getItem(keyFor(q)))); return keyFor(s.query) === keyFor(q) ? s : null; } catch { return null; }
  }
  function saveCache(s) {
    try { env.localStorage.setItem(keyFor(s.query), JSON.stringify(s)); return true; } catch { return false; }
  }
  function offlineHtml(snapshot) {
    validateSnapshot(snapshot);
    const payload = JSON.stringify(snapshot).replace(/</g, '\\u003c');
    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#173d56"><title>空教室 · 离线快照</title></head><body style="margin:0"><main id="app"></main><script>' + createHitRoomApp.toString() + '\ncreateHitRoomApp().mount({initial:' + payload + '});<' + '/script></body></html>';
  }
  function download(name, content, type) {
    const blob = new env.Blob([content], { type });
    const url = env.URL.createObjectURL(blob);
    const a = env.document.createElement('a'); a.href = url; a.download = name; a.click();
    env.setTimeout(() => env.URL.revokeObjectURL(url), 30000);
  }
  function mount({ initial, enhanced = false } = {}) {
    if (env.__HIT_EMPTYROOM_HELPER__) { env.__HIT_EMPTYROOM_HELPER__.focus(); return env.__HIT_EMPTYROOM_HELPER__; }
    const onlineMode = enhanced && (backend || env.location.hostname === SOURCE);
    const doc = env.document;
    let query = initial ? { ...validateSnapshot(initial).query } : { ...DEFAULT_QUERY };
    if (!initial) { try { const q = JSON.parse(env.localStorage.getItem(scopePrefix + 'hit-room-query-v2')); if (validQuery(q)) query = q; } catch {} }
    let snapshot = initial || readCache(query);
    let mode = initial ? 'snapshot' : 'cache';
    let busy = false, loading = false, error = '', notice = '', lastAttempt = 0, generation = 0, closed = false;
    const choices = { terms: [], weeks: [], campuses: [], buildings: [] };
    const favoriteKey = () => `${scopePrefix}hit-room-favorites-v2:${query.campus}:${query.building}`;
    function readFavorites() {
      try { const items = JSON.parse(env.localStorage.getItem(favoriteKey())) || []; return Array.isArray(items) ? items.filter(validName) : []; } catch { return []; }
    }
    const filter = { day: (new Date().getDay() + 6) % 7, start: 0, length: 1, search: '', onlyFree: true, onlyFavorites: false, favorites: readFavorites() };
    const host = doc.createElement('div'); host.id = 'hit-empty-room-helper';
    if (enhanced) host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483000;display:block;background:#f4f8fb;';
    (enhanced && !backend ? doc.documentElement : doc.getElementById('app') || doc.body).append(host);
    const root = host.attachShadow({ mode: 'open' });
    const oldOverflow = doc.documentElement.style.overflow;
    const previousFocus = doc.activeElement;
    let viewport = doc.querySelector('meta[name="viewport"]'), oldViewport = viewport?.getAttribute('content');
    const createdViewport = !viewport;
    if (enhanced) {
      doc.documentElement.style.overflow = 'hidden';
      if (!viewport) { viewport = doc.createElement('meta'); viewport.name = 'viewport'; doc.head.append(viewport); }
      viewport.content = 'width=device-width,initial-scale=1,viewport-fit=cover';
    }
    const css = `
      :host{display:block;color:#132b3a;font:15px/1.5 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;background:#f4f8fb}*{box-sizing:border-box}button,input,select{font:inherit;color:inherit}button,select{cursor:pointer}button{border:0}button:disabled{opacity:.5;cursor:default}button:focus-visible,select:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid #197f83;outline-offset:3px}button,input,select{min-height:44px}a{color:#17666b}header{border-bottom:1px solid #dbe5ec;background:#fff}.bar{max-width:1120px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 28px}.brand{display:flex;align-items:center;gap:12px}.logo{width:35px;height:35px;background:#173d56;color:white;border-radius:10px;display:grid;place-items:center;font-size:18px;font-weight:700}.brand strong{font-size:17px;letter-spacing:1px}.brand small{display:block;font-size:11px;color:#657e8d;letter-spacing:.4px}.top-actions{display:flex;gap:8px;align-items:center}.quiet{background:none;color:#527182;padding:4px 10px;border-radius:8px}.solid{background:#173d56;color:white;padding:8px 18px;border-radius:9px;font-weight:600}.shell{height:${enhanced ? '100dvh' : 'auto'};min-height:${enhanced ? '0' : '100vh'};overflow:auto;padding-bottom:env(safe-area-inset-bottom)}.layout{max-width:1120px;margin:auto;padding:36px 28px;display:grid;grid-template-columns:254px minmax(0,1fr);gap:36px;align-items:start}.intro{margin-bottom:26px}.eyebrow{font-size:12px;color:#637d8d;letter-spacing:1px;margin:0 0 10px}h1{font-size:32px;line-height:1.3;letter-spacing:-1px;margin:0 0 10px;font-weight:700}h1 span{display:block;color:#147d78}.subtitle{font-size:13px;color:#637d8d;margin:0}.panel{background:#fff;border:1px solid #dbe5ec;border-radius:14px;padding:20px}.control{display:block;margin-bottom:20px}.control>span,.caption{display:block;font-size:12px;color:#657e8d;margin-bottom:7px}.control select,.control input{width:100%;padding:9px 11px;background:#f7fafc;border:1px solid #dbe5ec;border-radius:8px}.fixed{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e7eef2;padding-bottom:14px;margin-bottom:14px;font-size:13px}.fixed strong{font-size:14px}#days{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:24px}.day{background:transparent;border:1px solid #dbe5ec;border-radius:9px;padding:9px 2px;color:#657e8d;font-size:13px}.day[aria-pressed=true]{background:#173d56;color:white;border-color:#173d56;font-weight:700}.result-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}h2{font-size:21px;margin:0;letter-spacing:-.5px}.muted{color:#657e8d;font-size:12px}.count{color:#147d78;font:700 22px/1 ui-monospace,"SFMono-Regular",monospace;margin-right:5px}.legend{display:flex;gap:14px;color:#657e8d;font-size:11px;margin-top:8px}.legend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px;background:#d7eae6}.legend .busy{background:#edd8d1}.status{font-size:12px;color:#526f7d;margin:8px 0 0}.status.bad{color:#a3452e}.alert{font-size:13px;padding:12px 14px;border-radius:9px;margin-bottom:18px;border:1px solid #cbdde5;background:#eaf2f6;color:#315c71}.alert.error{background:#fff1e9;color:#994426;border-color:#ebcbbd}.toggles{display:flex;gap:12px;flex-wrap:wrap;font-size:13px;margin:14px 0 24px}.toggles label{display:flex;gap:7px;align-items:center}.toggles input{min-height:24px;width:17px;height:17px;accent-color:#147d78}.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.room{background:white;border:1px solid #dbe5ec;border-radius:12px;padding:17px}.room-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.room h3{margin:0;font-size:19px;font-weight:650;letter-spacing:.2px}.star{width:36px;min-height:36px;padding:0;border-radius:8px;color:#9aadb8;background:none;font-size:21px}.star[aria-pressed=true]{color:#17666b;background:#e8f2ef}.room-note{font-size:12px;color:#147d78;margin-bottom:16px;min-height:18px}.room-note.occupied{color:#a45d48}.slots{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px}.slot{background:#e7f1ee;color:#28665c;border-radius:5px;text-align:center;padding:7px 0 5px;font-size:11px;line-height:1.4}.slot.occupied{background:#f2e5df;color:#945b48}.slot.unknown{background:#e8edf1;color:#677984}.slot.selected{outline:1.5px solid #173d56;outline-offset:1px}.slot span{display:block;font-size:10px;opacity:.8}.note{font-size:11px;color:#657e8d;margin-top:22px;line-height:1.8}details{border-top:1px solid #dbe5ec;margin-top:18px;padding-top:13px;font-size:12px;color:#657e8d}summary{cursor:pointer;min-height:32px}.tools{display:flex;flex-direction:column;gap:6px;padding-top:10px}.tools button{text-align:left;background:#f7fafc;padding:9px;border-radius:7px}.empty{grid-column:1/-1;padding:40px 20px;text-align:center;border:1px dashed #bdcfd9;border-radius:12px;color:#637d8d;font-size:14px}.empty strong{display:block;font-size:17px;color:#24485d;margin-bottom:8px}.more{display:block;margin:22px auto 0;background:#e8f0f5;border-radius:9px;padding:10px 20px;color:#315c71}footer{max-width:1120px;margin:auto;padding:0 28px 25px;color:#8296a2;font-size:11px}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
      @media(max-width:760px){.bar{padding:14px 18px}.brand strong{font-size:15px}.brand small{font-size:10px}.quiet{padding:4px 7px}.solid{padding:7px 12px;font-size:13px}.layout{padding:25px 18px;display:block}.intro{margin-bottom:19px}h1{font-size:29px;letter-spacing:-.7px}h1 span{display:inline;margin-left:8px}.panel{padding:16px;margin-bottom:24px}.fixed{display:inline-flex;gap:8px;border:0;margin:0 16px 12px 0;padding:0}.control{margin-bottom:12px}.filter-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.filter-grid .control{min-width:0}.panel #search{margin-bottom:0}.panel .wide{margin-bottom:0}.panel details{margin-top:12px;padding-top:10px}.tools{flex-direction:row;flex-wrap:wrap}.tools button{flex:1;font-size:11px}.control>span{font-size:11px}.cards{gap:10px}.room{padding:14px 12px}.room h3{font-size:18px}.room-note{font-size:11px;margin-bottom:13px}.slot{font-size:10px;padding:7px 0}.slot span{font-size:9px}.result-heading{align-items:flex-start}#days{margin-bottom:17px}.toggles{margin-bottom:19px}footer{padding:0 18px 24px}.note{margin-top:16px}.legend{gap:10px}}
      @media(max-width:430px){.cards{grid-template-columns:1fr}.room{padding:16px}.room h3{font-size:21px}.slots{gap:6px}.slot{font-size:12px}.slot span{font-size:10px}.brand small{letter-spacing:0}.logo{width:31px;height:31px}.bar{gap:8px}h1{font-size:27px}.top-actions{gap:0}}
      .query-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:0}.query-grid .control{min-width:0;margin-bottom:12px}.query-grid select{max-width:100%;text-overflow:ellipsis}.auto-note{font-size:11px;color:#657e8d;margin:0 0 18px}.login{text-decoration:none;white-space:nowrap}.top-actions{flex-wrap:wrap;justify-content:flex-end}.brand{flex-shrink:0}
      @media(max-width:760px){.query-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 12px}.top-actions .quiet{font-size:11px}.brand small{font-size:9px}}
      [hidden]{display:none!important}
      @media(prefers-reduced-motion:no-preference){button{transition:background .15s ease,color .15s ease}}
    `;
    root.innerHTML = `<style>${css}</style><div class="shell"><header><div class="bar"><div class="brand"><div class="logo" aria-hidden="true">空</div><div><strong>空教室</strong><small>哈尔滨工业大学 · 空教室查询</small></div></div><div class="top-actions">${onlineMode ? '<a class="quiet login" href="/loginCAS">学校登录</a>' : ''}<button class="quiet" id="exportTop">存为离线页</button>${enhanced ? '<button class="quiet" id="close">返回原页</button>' : ''}</div></div></header><main class="layout"><aside><div class="intro"><p class="eyebrow" id="locationLabel"></p><h1>找间教室<span>安静坐下。</span></h1><p class="subtitle">先选时段，再看能连续用多久。</p></div><section class="panel" aria-label="查询条件">${onlineMode ? '<div class="query-grid"><label class="control"><span>学年学期</span><select id="term"></select></label><label class="control"><span>教学周</span><select id="week"></select></label><label class="control"><span>校区</span><select id="campus"></select></label><label class="control"><span>楼号</span><select id="building"></select></label></div><p class="auto-note">更改条件后自动获取学校数据</p>' : '<div class="fixed"><span>学年学期</span><strong id="termLabel"></strong></div><div class="fixed"><span>教学周</span><strong>第 <span id="weekLabel"></span> 周</strong></div>'}<div class="filter-grid"><label class="control"><span>从第几节开始</span><select id="start">${PERIODS.map((p, i) => `<option value="${i}">第 ${p} 节</option>`).join('')}</select></label><label class="control"><span>至少连续空闲</span><select id="length">${[1,2,3,4,5,6].map(n => `<option value="${n}">${n} 大节（${n * 2}节课）</option>`).join('')}</select></label></div><label class="control wide"><span>查找教室</span><input id="search" type="search" placeholder="输入教室号，如 603" autocomplete="off" inputmode="search"></label><details><summary>数据与离线使用</summary><div class="tools"><button id="export">保存离线 HTML</button><button id="exportJson">导出数据 JSON</button><button id="import">导入快照</button></div>${onlineMode ? `<button class="quiet" id="reload">重新读取学校查询条件</button><p>${backend ? '由这台 Mac 的本地服务访问学校接口。请保持程序运行，并连接校园网；会话过期时在本页重新登录。' : '直接由当前 Safari 访问学校接口，不需要电脑或额外服务器。登录过期时点“学校登录”，完成后重新点助手书签。'}</p>` : '<p>此页使用已保存的真实快照。自动同步请在已登录的教务网站中启动助手。</p>'}<p>数据仅保存在本机。不读取账号、密码或登录票据。</p></details><input id="file" type="file" accept="application/json,.json" hidden></section></aside><section aria-label="教室结果"><div id="days" aria-label="星期"></div><div id="alerts" aria-live="polite"></div><div class="result-heading"><div><h2 id="resultTitle"></h2><div class="status" id="status"></div><div class="legend"><span><i></i>未排课</span><span><i class="busy"></i>有占用</span><span>每格为 2 节课</span></div></div><button id="sync" class="solid" ${onlineMode ? '' : 'hidden'}>同步教务</button></div><div class="toggles"><label><input id="onlyFree" type="checkbox" checked>只看符合时段的教室</label><label><input id="onlyFavorites" type="checkbox">只看收藏</label></div><div class="cards" id="cards"></div><button id="more" class="more" hidden>显示全部结果</button><p class="note">“未排课”依据教务系统占用表，不代表现场无人或一定开放。临时借用、考试及封楼等，以学校通知和现场为准。<br>节次沿用学校原表；未核实作息时间，因此不换算成几点或小时。</p></section></main><footer>数据来源：哈尔滨工业大学本科教学管理与服务平台 / 公共信息 / 空教室查询</footer></div>`;
    const $ = id => root.getElementById(id);
    let showAll = false;
    const labelFor = (kind, value, fallback) => choices[kind].find(o => o.value === String(value))?.label || fallback || String(value);
    function selectOptions(id, items, value) {
      const el = $(id), signature = JSON.stringify(items);
      if (el.dataset.options !== signature) { el.innerHTML = items.length ? items.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('') : '<option value="">正在读取…</option>'; el.dataset.options = signature; }
      el.value = value;
      el.disabled = busy || loading || !items.length;
    }
    function rememberQuery() { try { env.localStorage.setItem(scopePrefix + 'hit-room-query-v2', JSON.stringify(query)); } catch {} }
    function useQueryCache() { snapshot = readCache(query); mode = 'cache'; filter.favorites = readFavorites(); showAll = false; }
    function timeText(s) { return new Date(s.capturedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }); }
    function update() {
      if (snapshot && keyFor(snapshot.query) !== keyFor(query)) snapshot = null;
      if (onlineMode) {
        selectOptions('term', choices.terms, query.term); selectOptions('week', choices.weeks, String(query.week));
        selectOptions('campus', choices.campuses, query.campus); selectOptions('building', choices.buildings, query.building);
        $('reload').disabled = busy || loading;
      } else { $('termLabel').textContent = snapshot?.termLabel || query.term; $('weekLabel').textContent = query.week; }
      $('locationLabel').textContent = `${labelFor('campuses', query.campus, snapshot?.campusLabel || (query.campus === '1' ? '一校区' : `校区 ${query.campus}`))} / ${labelFor('buildings', query.building, snapshot?.buildingLabel || (query.building === '016' ? '正心楼' : `楼号 ${query.building}`))}`;
      $('days').innerHTML = DAYS.map((d, i) => `<button class="day" data-day="${i}" aria-pressed="${filter.day === i}">${d}</button>`).join('');
      const max = 6 - filter.start;
      filter.length = Math.min(filter.length, max);
      $('length').value = filter.length;
      [...$('length').options].forEach(o => { o.disabled = Number(o.value) > max; });
      $('sync').disabled = busy || loading || (onlineMode && !choices.buildings.length); $('sync').textContent = loading ? '正在读取条件…' : busy ? '正在同步…' : '同步教务';
      $('import').disabled = busy || loading;
      $('alerts').innerHTML = (error ? `<div class="alert error">${esc(error)}</div>` : '') + (notice ? `<div class="alert">${esc(notice)}</div>` : '');
      const stale = snapshot && Date.now() - Date.parse(snapshot.capturedAt) > TTL;
      const prefix = mode === 'live' && !stale ? '已同步' : mode === 'import' ? '导入快照' : onlineMode ? '本地缓存' : '离线快照';
      $('status').textContent = snapshot ? `${prefix} · ${timeText(snapshot)} 更新 · 共 ${snapshot.rooms.length} 个场地${stale ? ' · 请注意数据时效' : ''}` : '未载入本周数据';
      $('status').classList.toggle('bad', Boolean(stale));
      const rows = snapshot ? selectRooms(snapshot, filter) : [];
      $('resultTitle').innerHTML = `<span class="count">${rows.length}</span>间符合条件`;
      $('cards').innerHTML = !snapshot ? '<div class="empty"><strong>本周还没有完整快照</strong>连接校园网、登录教务后点“同步教务”，或导入之前保存的快照。</div>' : !rows.length ? '<div class="empty"><strong>这个时段没有匹配结果</strong>试试减少连续节次、换一天，或关闭收藏筛选。</div>' : (showAll ? rows : rows.slice(0, 24)).map(room => {
        const run = freeRun(room, filter.day, filter.start);
        const ok = available(room, filter.day, filter.start, filter.length);
        const hasUnknown = room.bits.slice(filter.day * 6 + filter.start, filter.day * 6 + filter.start + filter.length).includes('?');
        const note = ok ? `从第 ${PERIODS[filter.start]} 节起，可连续空闲 ${run} 大节` : hasUnknown ? '所选时段状态未知，请查看原页面' : '所选时段有占用';
        return `<article class="room"><div class="room-head"><h3>${esc(room.name)}</h3><button class="star" data-favorite="${esc(room.name)}" aria-label="${filter.favorites.includes(room.name) ? '取消收藏' : '收藏'}${esc(room.name)}" aria-pressed="${filter.favorites.includes(room.name)}">${filter.favorites.includes(room.name) ? '★' : '☆'}</button></div><div class="room-note ${ok ? '' : 'occupied'}">${esc(note)}</div><div class="slots" aria-label="${DAYS[filter.day]}占用情况">${PERIODS.map((p, i) => { const bit = room.bits[filter.day * 6 + i]; const word = bit === '0' ? '空' : bit === '1' ? '占' : '待核'; return `<div class="slot ${bit === '1' ? 'occupied' : bit === '?' ? 'unknown' : ''} ${i >= filter.start && i < filter.start + filter.length ? 'selected' : ''}" aria-label="第${p}节：${word}">${p}<span>${word}</span></div>`; }).join('')}</div></article>`;
      }).join('');
      $('more').hidden = showAll || rows.length <= 24;
    }
    async function loadConfiguration({ termChanged = false, campusChanged = false, refresh = false } = {}) {
      if (closed || busy || loading || !onlineMode) return;
      const ownGeneration = ++generation;
      loading = true; error = ''; notice = ''; lastAttempt = Date.now(); update();
      let success = false;
      try {
        if (refresh || !choices.terms.length) {
          const metadata = await queryOptions(query);
          if (closed || generation !== ownGeneration) return;
          choices.terms = metadata.terms; choices.campuses = metadata.campuses;
          if (!choices.terms.some(o => o.value === query.term)) { query = { ...query, term: choices.terms[0].value }; termChanged = true; }
          if (!choices.campuses.some(o => o.value === query.campus)) { query = { ...query, campus: choices.campuses[0].value }; campusChanged = true; }
        }
        const [weeks, buildings] = await Promise.all([
          termChanged || refresh || !choices.weeks.length ? weekOptions(query.term) : choices.weeks,
          campusChanged || refresh || !choices.buildings.length ? buildingOptions(query.campus) : choices.buildings,
        ]);
        if (closed || generation !== ownGeneration) return;
        choices.weeks = weeks; choices.buildings = buildings;
        if (!weeks.some(o => Number(o.value) === query.week)) query = { ...query, week: Number(weeks[0].value) };
        if (!buildings.some(o => o.value === query.building)) query = { ...query, building: buildings[0].value };
        useQueryCache(); rememberQuery(); success = true;
      } catch (e) { if (!closed && generation === ownGeneration) error = `${e.message} 可在“数据与离线使用”中重新读取查询条件。`; }
      finally { loading = false; if (!closed) update(); }
      if (success && !closed) sync();
    }
    function changeQuery(change) {
      if (closed || busy || loading) { update(); return; }
      query = { ...query, ...change }; generation++; error = ''; notice = ''; useQueryCache(); update();
      if (change.term || change.campus) loadConfiguration({ termChanged: Boolean(change.term), campusChanged: Boolean(change.campus) });
      else { rememberQuery(); sync(); }
    }
    async function sync() {
      if (busy || loading || !onlineMode || !choices.buildings.length || closed) return;
      const requestGeneration = generation;
      const requestQuery = { ...query };
      busy = true; error = ''; notice = ''; lastAttempt = Date.now(); update();
      try {
        const next = await collect(requestQuery);
        if (closed || generation !== requestGeneration || keyFor(query) !== keyFor(requestQuery)) return;
        snapshot = next; mode = 'live';
        if (!saveCache(snapshot)) notice = '已获取完整数据，但浏览器未允许保存缓存；可点“存为离线页”保留这次结果。';
      } catch (e) { if (!closed && generation === requestGeneration) error = `${e.message}${snapshot ? ' 当前仍显示上次完整快照，请留意更新时间。' : ''}`; }
      finally { busy = false; if (!closed) update(); }
    }
    function exportHtml() {
      if (!snapshot) { error = '请先同步或导入完整快照。'; update(); return; }
      download(`空教室-${snapshot.buildingLabel || snapshot.query.building}-${snapshot.query.term}-第${snapshot.query.week}周.html`, offlineHtml(snapshot), 'text/html;charset=utf-8');
    }
    root.addEventListener('click', e => {
      const button = e.target.closest('button'); if (!button) return;
      if (button.dataset.day !== undefined) { filter.day = Number(button.dataset.day); showAll = false; update(); }
      if (button.dataset.favorite) { const name = button.dataset.favorite; filter.favorites = filter.favorites.includes(name) ? filter.favorites.filter(n => n !== name) : [...filter.favorites, name]; try { env.localStorage.setItem(favoriteKey(), JSON.stringify(filter.favorites)); } catch {} update(); }
      if (button.id === 'more') { showAll = true; update(); }
      if (button.id === 'sync') sync();
      if (button.id === 'reload') loadConfiguration({ refresh: true });
      if (button.id === 'export' || button.id === 'exportTop') exportHtml();
      if (button.id === 'exportJson' && snapshot) download(`空教室-${snapshot.buildingLabel || snapshot.query.building}-第${snapshot.query.week}周.json`, JSON.stringify(snapshot, null, 2), 'application/json');
      if (button.id === 'import') $('file').click();
      if (button.id === 'close') { api.close(); if (backend) env.hitRoomLogout?.(); }
    });
    $('start').addEventListener('change', e => { filter.start = Number(e.target.value); showAll = false; update(); });
    $('length').addEventListener('change', e => { filter.length = Number(e.target.value); showAll = false; update(); });
    $('search').addEventListener('input', e => { filter.search = e.target.value; showAll = false; update(); });
    ['onlyFree', 'onlyFavorites'].forEach(id => $(id).addEventListener('change', e => { filter[id] = e.target.checked; showAll = false; update(); }));
    if (onlineMode) ['term', 'week', 'campus', 'building'].forEach(id => $(id).addEventListener('change', e => changeQuery({ [id]: id === 'week' ? Number(e.target.value) : e.target.value })));
    $('file').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      if (busy || loading) { $('file').value = ''; return; }
      const importGeneration = generation;
      try { if (file.size > 2000000) throw Error('文件过大，请选择助手导出的 JSON 快照。'); const next = validateSnapshot(JSON.parse(await file.text())); if (closed) return; if (onlineMode && (keyFor(next.query) !== keyFor(query))) throw Error('在线助手只导入当前查询条件的快照；请先选择对应学期、周次、校区和楼号。'); generation = Math.max(generation, importGeneration) + 1; snapshot = next; query = { ...next.query }; filter.favorites = readFavorites(); mode = 'import'; saveCache(next); error = ''; notice = '已导入本地快照；时间沿用文件中的采集时间。'; update(); }
      catch (e) { error = e.message; update(); }
      finally { $('file').value = ''; }
    });
    const refreshIfNeeded = () => { if (onlineMode && doc.visibilityState === 'visible' && !closed && !busy && !loading && Date.now() - lastAttempt > TTL && (!snapshot || Date.now() - Date.parse(snapshot.capturedAt) > TTL)) { if (choices.buildings.length) sync(); else loadConfiguration({ refresh: true }); } };
    const timer = onlineMode ? env.setInterval(refreshIfNeeded, 60000) : null;
    doc.addEventListener('visibilitychange', refreshIfNeeded);
    const api = { focus() { host.scrollIntoView(); $('start').focus(); }, close() { closed = true; generation++; if (timer) env.clearInterval(timer); doc.removeEventListener('visibilitychange', refreshIfNeeded); host.remove(); if (enhanced) { doc.documentElement.style.overflow = oldOverflow; if (createdViewport) viewport.remove(); else if (oldViewport == null) viewport.removeAttribute('content'); else viewport.setAttribute('content', oldViewport); } env.__HIT_EMPTYROOM_HELPER__ = null; previousFocus?.focus?.(); }, snapshot() { return snapshot; }, refresh: sync };
    env.__HIT_EMPTYROOM_HELPER__ = api;
    if (backend) { root.querySelector('.login')?.remove(); $('close').textContent = '退出登录'; }
    update(); if (onlineMode) loadConfiguration({ refresh: true });
    return api;
  }
  return { validateSnapshot, freeRun, available, selectRooms, fields, parseSchoolDocument, collect, queryOptions, weekOptions, buildingOptions, normalizeCatalog, keyFor, offlineHtml, mount };
}
if (typeof module !== 'undefined' && module.exports) module.exports = { createHitRoomApp };
