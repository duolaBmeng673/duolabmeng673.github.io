import { rankSearch, loadSearchIndex, type SearchRecord } from '../lib/search';
import { bindStickyAutoHide } from '../lib/sticky-dock';
type RecordWithId = SearchRecord & { id: string };
let records: RecordWithId[] = JSON.parse(document.querySelector('#notes-index')?.textContent ?? '[]');
let fullIndex = false;
let run = 0;
const categoryLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-category-filter]')];
const legendButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-blog-category]')];
const search = document.querySelector<HTMLInputElement>('[data-search-input]');
const empty = document.querySelector<HTMLElement>('[data-archive-empty]');
const status = document.querySelector<HTMLElement>('[data-result-status]');
const title = document.querySelector<HTMLElement>('[data-archive-title]');
const tagButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-blog-tag]')];
const monthBands = [...document.querySelectorAll<HTMLElement>('[data-timeline-month-band]')];
const timelineRows = [...document.querySelectorAll<HTMLElement>('[data-timeline-row]')];
const timelineYears = [...document.querySelectorAll<HTMLElement>('[data-timeline-year]')];
let category = 'all', tag = '', query = '', activeCategory = '';

const readUrl = () => {
  const params = new URLSearchParams(location.search);
  // Preserve shared links created before Study Notes gained its own entry point.
  category = params.get('category') === 'Study Notes' || categoryLinks.some((link) => link.dataset.categoryFilter === params.get('category')) ? params.get('category')! : 'all';
  tag = params.get('tag') ?? '';
  query = params.get('q') ?? '';
  if (search) search.value = query;
};

const setTransientStatus = (message: string, visible: boolean) => {
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('visually-hidden', !visible);
};

const apply = async (writeUrl = true) => {
  const current = ++run;
  if (writeUrl) {
    const params = new URLSearchParams();
    if (category !== 'all') params.set('category', category);
    if (tag) params.set('tag', tag);
    if (query) params.set('q', query);
    const next = `${location.pathname}${params.size ? `?${params}` : ''}`;
    if (next !== location.pathname + location.search) history.replaceState(null, '', next);
  }
  if (query && !fullIndex) {
    setTransientStatus('正在搜索正文…', true);
    try {
      const index = await loadSearchIndex();
      records = records.map((record) => ({ ...record, ...index.find((entry) => entry.href === record.href) }));
      fullIndex = true;
    } catch {
      if (current === run) setTransientStatus('正文索引加载失败，请刷新重试。', true);
      return;
    }
    if (current !== run) return;
  }
  const regularOnly = category === 'all' && !query && !tag;
  const sharedSearch = Boolean(query || (tag && category === 'all'));
  if (title) title.textContent = sharedSearch ? (query ? '搜索结果' : '标签检索') : category === 'Study Notes' ? '学习笔记检索' : '技术笔记';
  const filtered = records.filter((record) =>
    (category === 'all' || record.category === category) &&
    (!regularOnly || record.category !== 'Study Notes') &&
    (!tag || record.tags.includes(tag) || (record.knowledgeTags ?? []).some((item) => item.name === tag))
  );
  const visible = rankSearch(filtered, query);
  const ids = new Set(visible.map((record) => record.id));

  categoryLinks.forEach((link) => {
    const active = link.dataset.categoryFilter === category;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current');
  });
  legendButtons.forEach((button) => {
    const active = button.dataset.blogCategory === activeCategory;
    button.setAttribute('aria-pressed', String(active));
    button.classList.toggle('is-active', active);
  });
  tagButtons.forEach((button) => {
    const active = Boolean(tag && button.dataset.blogTag === tag);
    button.setAttribute('aria-pressed', String(active));
    button.classList.toggle('is-active', active);
    button.classList.toggle('is-muted', Boolean(activeCategory && button.dataset.c !== activeCategory));
  });

  timelineRows.forEach((row) => { row.hidden = !ids.has(row.dataset.id ?? ''); });
  monthBands.forEach((band) => {
    const visibleCount = band.querySelectorAll('[data-timeline-row]:not([hidden])').length;
    band.hidden = visibleCount === 0;
  });
  timelineYears.forEach((year) => {
    const visibleCount = year.querySelectorAll('[data-timeline-row]:not([hidden])').length;
    year.hidden = visibleCount === 0;
  });

  if (empty) empty.hidden = ids.size > 0;
  setTransientStatus(`${ids.size} 篇笔记 · 按发布日期排序`, false);
  const tagStatus = document.querySelector<HTMLElement>('[data-active-tag]');
  const tagLabel = document.querySelector<HTMLElement>('[data-tag-label]');
  if (tagStatus) tagStatus.hidden = !tag;
  if (tagLabel) tagLabel.textContent = `标签：${tag}`;
  else if (tagStatus) tagStatus.textContent = `标签：${tag}`;
  const queryStatus = document.querySelector<HTMLElement>('[data-active-query]');
  if (queryStatus) queryStatus.hidden = !query;
  const queryLabel = document.querySelector<HTMLElement>('[data-query-label]');
  if (queryLabel) queryLabel.textContent = `搜索：${query}`;
};

const dock = bindStickyAutoHide({
  bar: document.querySelector<HTMLElement>('.archive-tools'),
  sentinel: document.querySelector<HTMLElement>('[data-archive-sentinel]'),
});

categoryLinks.forEach((link) => link.addEventListener('click', (event) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  category = link.dataset.categoryFilter ?? 'all';
  dock.reveal();
  void apply();
}));
legendButtons.forEach((button) => button.addEventListener('click', () => {
  const clicked = button.dataset.blogCategory ?? '';
  activeCategory = activeCategory === clicked ? '' : clicked;
  dock.reveal();
  void apply(false);
}));
tagButtons.forEach((button) => button.addEventListener('click', () => {
  const clicked = button.dataset.blogTag ?? '';
  tag = tag === clicked ? '' : clicked;
  dock.reveal();
  void apply();
}));
const clearQuery = () => { query = ''; if (search) { search.value = ''; search.dispatchEvent(new Event('input')); } };
document.querySelector('[data-clear-tag]')?.addEventListener('click', () => { tag = ''; dock.reveal(); void apply(); });
document.querySelector('[data-clear-filters]')?.addEventListener('click', () => {
  category = 'all'; tag = ''; activeCategory = ''; clearQuery(); dock.reveal(); void apply(); search?.focus();
});
document.querySelector('[data-clear-query]')?.addEventListener('click', () => { clearQuery(); dock.reveal(); void apply(); search?.focus(); });
window.addEventListener('popstate', () => { readUrl(); dock.reveal(); void apply(false); });
readUrl(); void apply(false);
export {};
