export type SearchRecord = {
  title: string; shortTitle: string | null; subtitle: string | null; description: string;
  category: string; subcategory: string; series: string; tags: string[]; date: string; href: string; searchText: string; body: string;
};
const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase();
const termsOf = (query: string) => [...new Set(normalize(query).trim().split(/\s+/).filter(Boolean))];
export function matchesQuery(record: SearchRecord, query: string) {
  const text = normalize(`${record.searchText} ${record.body ?? ''}`);
  return termsOf(query).every((term) => text.includes(term));
}
export function searchScore(record: SearchRecord, query: string) {
  const terms = termsOf(query);
  if (!terms.length) return 0;
  if (!matchesQuery(record, query)) return -1;
  const title = normalize([record.title, record.shortTitle, record.subtitle].filter(Boolean).join(' '));
  const tags = normalize(record.tags.join(' '));
  const taxonomy = normalize([record.category, record.subcategory, record.series].join(' '));
  const description = normalize(record.description);
  let score = normalize(record.title) === normalize(query).trim() ? 500 : 0;
  if (title.includes(normalize(query).trim())) score += 150;
  for (const term of terms) score += title.includes(term) ? 100 : tags.includes(term) ? 60 : taxonomy.includes(term) ? 40 : description.includes(term) ? 20 : 2;
  return score;
}
export function searchSnippet(record: SearchRecord, query: string) {
  const body = record.body ?? '';
  const offsets = termsOf(query).map((term) => normalize(body).indexOf(term)).filter((i) => i >= 0);
  if (!offsets.length) return record.description;
  const start = Math.max(0, Math.min(...offsets) - 35);
  return `${start ? '…' : ''}${body.slice(start, start + 150)}${start + 150 < body.length ? '…' : ''}`;
}
export function rankSearch<T extends SearchRecord>(records: T[], query: string) {
  return records.map((record) => ({ record, score: searchScore(record, query) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score || b.record.date.localeCompare(a.record.date) || a.record.href.localeCompare(b.record.href))
    .map(({ record }) => record);
}
let pending: Promise<SearchRecord[]> | undefined;
export function loadSearchIndex() {
  pending ??= fetch('/search-index.json').then(async (response) => {
    if (!response.ok) throw new Error('Search index unavailable');
    return await response.json() as SearchRecord[];
  }).catch((error) => { pending = undefined; throw error; });
  return pending;
}
