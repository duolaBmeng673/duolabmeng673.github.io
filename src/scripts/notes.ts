import { matchesQuery, type SearchRecord } from '../lib/search';
const records: (SearchRecord & { id: string })[] = JSON.parse(document.querySelector('#notes-index')?.textContent ?? '[]');
const categoryLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-category-filter]')];
const viewButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-view-toggle]')];
const search = document.querySelector<HTMLInputElement>('[data-notes-search]');
const subcategory = document.querySelector<HTMLSelectElement>('[data-subcategory-filter]');
const series = document.querySelector<HTMLSelectElement>('[data-series-filter]');
const empty = document.querySelector<HTMLElement>('[data-archive-empty]');
const status = document.querySelector<HTMLElement>('[data-result-status]');
const tagStatus = document.querySelector<HTMLElement>('[data-active-tag]');
let category = 'all';
let view = 'notes';
let tag = '';
const readUrl = () => {
  const params = new URLSearchParams(location.search);
  category = categoryLinks.some((link) => link.dataset.categoryFilter === params.get('category')) ? params.get('category')! : 'all';
  view = params.get('view') === 'timeline' ? 'timeline' : 'notes';
  tag = params.get('tag') ?? '';
  if (search) search.value = params.get('q') ?? '';
  if (subcategory) subcategory.value = params.get('subcategory') ?? '';
  if (series) series.value = params.get('series') ?? '';
};
const apply = (writeUrl = true) => {
  const query = search?.value ?? '';
  const visibleIds = new Set(records.filter((record) =>
    (category === 'all' || record.category === category) &&
    (!subcategory?.value || record.subcategory === subcategory.value) &&
    (!series?.value || record.series === series.value) &&
    (!tag || record.tags.includes(tag)) && matchesQuery(record, query)
  ).map((record) => record.id));
  categoryLinks.forEach((link) => {
    const active = link.dataset.categoryFilter === category;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current');
  });
  viewButtons.forEach((button) => {
    const active = button.dataset.viewToggle === view;
    button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
  });
  const notesView = document.querySelector<HTMLElement>('[data-notes-view]');
  const timelineView = document.querySelector<HTMLElement>('[data-timeline-view]');
  if (notesView) notesView.hidden = view !== 'notes';
  if (timelineView) timelineView.hidden = view !== 'timeline';
  document.querySelectorAll<HTMLElement>('[data-note-row], [data-timeline-row]').forEach((row) => { row.hidden = !visibleIds.has(row.dataset.id ?? ''); });
  document.querySelectorAll<HTMLElement>('[data-timeline-month]').forEach((month) => { month.hidden = !month.querySelector('[data-timeline-row]:not([hidden])'); });
  document.querySelectorAll<HTMLElement>('[data-timeline-year]').forEach((year) => { year.hidden = !year.querySelector('[data-timeline-month]:not([hidden])'); });
  if (empty) empty.hidden = visibleIds.size > 0;
  if (status) status.textContent = `${visibleIds.size} ${visibleIds.size === 1 ? 'note' : 'notes'}`;
  if (tagStatus) { tagStatus.hidden = !tag; tagStatus.textContent = tag ? `Tag: ${tag}` : ''; }
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
};
categoryLinks.forEach((link) => link.addEventListener('click', (event) => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault(); category = link.dataset.categoryFilter ?? 'all';
  if (subcategory) subcategory.value = ''; if (series) series.value = ''; apply();
}));
viewButtons.forEach((button) => button.addEventListener('click', () => { view = button.dataset.viewToggle ?? 'notes'; apply(); }));
search?.addEventListener('input', () => apply());
subcategory?.addEventListener('change', () => { if (series) series.value = ''; apply(); });
series?.addEventListener('change', () => apply());
document.querySelector('[data-clear-filters]')?.addEventListener('click', () => {
  category = 'all'; tag = ''; if (search) search.value = ''; if (subcategory) subcategory.value = ''; if (series) series.value = ''; apply(); search?.focus();
});
window.addEventListener('popstate', () => { readUrl(); apply(false); });
readUrl(); apply(false);
if (new URLSearchParams(location.search).get('search') === '1') search?.focus();
