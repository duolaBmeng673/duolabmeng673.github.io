import { matchesQuery, type SearchRecord } from '../lib/search';
const shell = document.querySelector<HTMLElement>('[data-search-shell]');
const input = document.querySelector<HTMLInputElement>('[data-search-input]');
const popover = document.querySelector<HTMLElement>('[data-search-popover]');
const results = document.querySelector<HTMLElement>('[data-search-results]');
const status = document.querySelector<HTMLElement>('[data-search-status]');
const allResults = document.querySelector<HTMLAnchorElement>('[data-search-all]');
let pendingIndex: Promise<SearchRecord[]> | undefined;
let index: SearchRecord[] | undefined;
let expanded = false;
const setExpanded = (value: boolean) => {
  expanded = value;
  if (popover) popover.hidden = !value;
  input?.setAttribute('aria-expanded', String(value));
};
const render = () => {
  if (!input || !results || !status || !index || !popover) return;
  results.replaceChildren();
  if (allResults) allResults.href = `/blog/?${new URLSearchParams({ q: input.value })}`;
  if (!input.value.trim()) { status.textContent = '输入关键词，搜索标题、分类、系列和标签。'; setExpanded(false); return; }
  const matches = index.filter((record) => matchesQuery(record, input.value));
  status.textContent = matches.length ? `找到 ${matches.length} 条笔记` : '没有找到匹配的笔记。试试另一个关键词。';
  setExpanded(true);
  for (const record of matches) {
    const li = document.createElement('li');
    const link = document.createElement('a'); link.className = 'search-result'; link.href = record.href;
    link.dataset.category = record.category;
    const title = document.createElement('strong'); title.textContent = record.shortTitle ?? record.title;
    const meta = document.createElement('small'); meta.textContent = `${record.category} · ${record.series} / ${record.date}`;
    const subtitle = record.subtitle ? document.createElement('em') : null;
    if (subtitle) { subtitle.textContent = record.subtitle; subtitle.className = 'search-result-subtitle'; }
    const description = document.createElement('p'); description.textContent = record.description;
    link.append(title, ...(subtitle ? [subtitle] : []), meta, description); li.append(link); results.append(li);
  }
};
const load = () => {
  pendingIndex ??= fetch('/search-index.json').then(async (response) => {
    if (!response.ok) throw new Error('Search index unavailable');
    return await response.json() as SearchRecord[];
  }).catch((error) => { pendingIndex = undefined; throw error; });
  return pendingIndex;
};
const update = async () => {
  if (!input || !status) return;
  if (!input.value.trim()) { setExpanded(false); return; }
  setExpanded(true);
  if (allResults) allResults.href = `/blog/?${new URLSearchParams({ q: input.value })}`;
  if (!index) status.textContent = '正在加载笔记索引…';
  try {
    index = await load();
    if (expanded && shell?.contains(document.activeElement)) render();
  } catch {
    if (expanded) status.textContent = '索引暂时无法加载。请重试，或查看全部结果。';
  }
};
input?.addEventListener('focus', () => { void update(); });
input?.addEventListener('input', () => { void update(); });
shell?.addEventListener('focusout', (event) => {
  if (!shell.contains(event.relatedTarget as Node | null)) setExpanded(false);
});
document.addEventListener('click', (event) => { if (shell && !shell.contains(event.target as Node)) setExpanded(false); });
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault(); input?.focus(); void update();
  }
  if (event.key === 'Escape' && expanded) {
    event.preventDefault(); input?.focus(); setExpanded(false);
  }
  if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && expanded && shell?.contains(event.target as Node)) {
    const items = [...shell.querySelectorAll<HTMLAnchorElement>('.search-result')];
    if (!items.length) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLAnchorElement);
    const next = current < 0 ? (event.key === 'ArrowDown' ? 0 : items.length - 1) : (current + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
    items[next].focus();
  }
});
