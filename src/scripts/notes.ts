import { rankSearch, loadSearchIndex, type SearchRecord } from '../lib/search';
type RecordWithId = SearchRecord & { id: string };
let records: RecordWithId[] = JSON.parse(document.querySelector('#notes-index')?.textContent ?? '[]');
let fullIndex = false;
let run = 0;
const categoryLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-category-filter]')];
const viewButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-view-toggle]')];
const search = document.querySelector<HTMLInputElement>('[data-search-input]');
const subcategory = document.querySelector<HTMLSelectElement>('[data-subcategory-filter]');
const series = document.querySelector<HTMLSelectElement>('[data-series-filter]');
const empty = document.querySelector<HTMLElement>('[data-archive-empty]');
const status = document.querySelector<HTMLElement>('[data-result-status]');
let category = 'all', view = 'notes', tag = '', query = '';
const readUrl = () => {
  const params = new URLSearchParams(location.search);
  category = categoryLinks.some((link) => link.dataset.categoryFilter === params.get('category')) ? params.get('category')! : 'all';
  view = params.get('view') === 'timeline' ? 'timeline' : 'notes';
  tag = params.get('tag') ?? ''; query = params.get('q') ?? '';
  if (search) search.value = query;
  if (subcategory) subcategory.value = params.get('subcategory') ?? '';
  if (series) series.value = params.get('series') ?? '';
};
const notesView = document.querySelector<HTMLElement>('[data-notes-view]');
const timelineView = document.querySelector<HTMLElement>('[data-timeline-view]');
const noteRows = [...document.querySelectorAll<HTMLElement>('[data-note-row]')];
const timelineRows = [...document.querySelectorAll<HTMLElement>('[data-timeline-row]')];
const apply = async (writeUrl = true) => {
  const current = ++run;
  if (writeUrl) {
    const params = new URLSearchParams();
    if (category !== 'all') params.set('category', category);
    if (subcategory?.value) params.set('subcategory', subcategory.value);
    if (series?.value) params.set('series', series.value);
    if (tag) params.set('tag', tag);
    if (view !== 'notes') params.set('view', view);
    if (query) params.set('q', query);
    const next = `${location.pathname}${params.size ? `?${params}` : ''}`;
    if (next !== location.pathname + location.search) history.replaceState(null, '', next);
  }
  if (query && !fullIndex) {
    if (status) status.textContent = '正在搜索正文…';
    try {
      const index = await loadSearchIndex();
      records = records.map((record) => ({ ...record, ...index.find((entry) => entry.href === record.href) }));
      fullIndex = true;
    } catch {
      if (current === run && status) status.textContent = '正文索引加载失败，请刷新重试。';
      return;
    }
    if (current !== run) return;
  }
  const regularOnly = category === 'all' && !query && !tag && !subcategory?.value && !series?.value;
  const filtered = records.filter((record) =>
    (category === 'all' || record.category === category) && (!regularOnly || record.category !== 'Study Notes') &&
    (!subcategory?.value || record.subcategory === subcategory.value) && (!series?.value || record.series === series.value) &&
    (!tag || record.tags.includes(tag))
  );
  const visible = rankSearch(filtered, query);
  const ids = new Set(visible.map((record) => record.id));
  categoryLinks.forEach((link) => {
    const active = link.dataset.categoryFilter === category;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current');
  });
  viewButtons.forEach((button) => {
    const active = button.dataset.viewToggle === view;
    button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
  });
  if (notesView) notesView.hidden = view !== 'notes';
  if (timelineView) timelineView.hidden = view !== 'timeline';
  [...noteRows, ...timelineRows].forEach((row) => { row.hidden = !ids.has(row.dataset.id ?? ''); });
  // Only search lists use relevance; the timeline always keeps chronological DOM order.
  const ordered = query ? visible : records;
  ordered.forEach((record) => { const row = noteRows.find((row) => row.dataset.id === record.id); if (row) notesView?.append(row); });
  document.querySelectorAll<HTMLElement>('[data-timeline-month]').forEach((month) => { month.hidden = !month.querySelector('[data-timeline-row]:not([hidden])'); });
  document.querySelectorAll<HTMLElement>('[data-timeline-year]').forEach((year) => { year.hidden = !year.querySelector('[data-timeline-month]:not([hidden])'); });
  if (empty) empty.hidden = ids.size > 0;
  if (status) status.textContent = `${ids.size} 篇笔记${query && view === 'notes' ? ' · 按相关度排序' : ' · 按发布日期排序'}`;
  const tagStatus = document.querySelector<HTMLElement>('[data-active-tag]');
  if (tagStatus) { tagStatus.hidden = !tag; tagStatus.textContent = `标签：${tag}`; }
  const queryStatus = document.querySelector<HTMLElement>('[data-active-query]');
  if (queryStatus) queryStatus.hidden = !query;
  const queryLabel = document.querySelector<HTMLElement>('[data-query-label]');
  if (queryLabel) queryLabel.textContent = `搜索：${query}`;
};
categoryLinks.forEach((link) => link.addEventListener('click', (event) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault(); category = link.dataset.categoryFilter ?? 'all';
  if (subcategory) subcategory.value = ''; if (series) series.value = ''; void apply();
}));
viewButtons.forEach((button) => button.addEventListener('click', () => { view = button.dataset.viewToggle ?? 'notes'; void apply(); }));
subcategory?.addEventListener('change', () => { if (series) series.value = ''; void apply(); });
series?.addEventListener('change', () => { void apply(); });
const clearQuery = () => { query = ''; if (search) { search.value = ''; search.dispatchEvent(new Event('input')); } };
document.querySelector('[data-clear-filters]')?.addEventListener('click', () => {
  category = 'all'; tag = ''; clearQuery();
  if (subcategory) subcategory.value = ''; if (series) series.value = ''; void apply(); search?.focus();
});
document.querySelector('[data-clear-query]')?.addEventListener('click', () => { clearQuery(); void apply(); search?.focus(); });
window.addEventListener('popstate', () => { readUrl(); void apply(false); });
readUrl(); void apply(false);
export {};
