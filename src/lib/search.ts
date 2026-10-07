export type SearchRecord = {
  title: string; shortTitle: string | null; subtitle: string | null; description: string;
  category: string; subcategory: string; series: string; tags: string[]; date: string; href: string; searchText: string;
};
export function matchesQuery(record: SearchRecord, query: string) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return terms.every((term) => record.searchText.includes(term));
}
