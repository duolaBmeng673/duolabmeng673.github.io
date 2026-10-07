import { matchesQuery, type SearchRecord } from '../lib/search';
const dialog = document.querySelector<HTMLDialogElement>('[data-search-dialog]');
const input = document.querySelector<HTMLInputElement>('[data-search-input]');
const results = document.querySelector<HTMLElement>('[data-search-results]');
const status = document.querySelector<HTMLElement>('[data-search-status]');
let pendingIndex: Promise<SearchRecord[]> | undefined;
let index: SearchRecord[] | undefined;
let opener: HTMLElement | null = null;
const render = () => {
  if (!input || !results || !status || !index) return;
  results.replaceChildren();
  if (!input.value.trim()) { status.textContent = '输入关键词，搜索标题、分类、系列和标签。'; return; }
  const matches = index.filter((record) => matchesQuery(record, input.value));
  status.textContent = matches.length ? `找到 ${matches.length} 条笔记` : '没有找到匹配的笔记。试试另一个关键词。';
  for (const record of matches) {
    const li = document.createElement('li');
    const link = document.createElement('a'); link.className = 'search-result'; link.href = record.href;
    const title = document.createElement('strong'); title.textContent = record.shortTitle ?? record.title;
    const meta = document.createElement('small'); meta.textContent = `${record.category} · ${record.series} / ${record.date}`;
    const description = document.createElement('p'); description.textContent = record.description;
    link.append(title, meta, description); li.append(link); results.append(li);
  }
};
const load = () => {
  pendingIndex ??= fetch('/search-index.json').then(async (response) => {
    if (!response.ok) throw new Error('Search index unavailable');
    return await response.json() as SearchRecord[];
  }).catch((error) => { pendingIndex = undefined; throw error; });
  return pendingIndex;
};
const open = async () => {
  if (!dialog || !input || !status || dialog.open) return;
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  dialog.showModal(); input.focus();
  if (!index) status.textContent = '正在加载笔记索引…';
  try { index = await load(); render(); } catch {
    status.textContent = '索引暂时无法加载。关闭后重试，或前往 Notes 浏览文章。';
  }
};
document.querySelectorAll<HTMLAnchorElement>('[data-search-open]').forEach((link) => link.addEventListener('click', (event) => {
  if (!dialog?.showModal) return;
  event.preventDefault(); void open();
}));
document.querySelector('[data-search-close]')?.addEventListener('click', () => dialog?.close());
dialog?.addEventListener('close', () => opener?.focus());
dialog?.addEventListener('click', (event) => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
});
input?.addEventListener('input', render);
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); void open(); }
  if (event.key === 'Escape' && dialog?.open) { event.preventDefault(); dialog.close(); }
});
