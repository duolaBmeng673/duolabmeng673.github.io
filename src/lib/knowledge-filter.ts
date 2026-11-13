// Preserve exact labels, including unknown URL labels (which match no entry).
export function readKnowledgeFilter(search: string) {
  return new Set(new URLSearchParams(search).getAll('tag').flatMap((value) => value.split(',')).filter(Boolean));
}
export function matchesKnowledgeTags(tags: readonly string[], selected: ReadonlySet<string>) {
  return [...selected].every((name) => tags.includes(name));
}
export function writeKnowledgeFilter(href: string, selected: ReadonlySet<string>) {
  const url = new URL(href);
  url.searchParams.delete('tag');
  if (selected.size) url.searchParams.set('tag', [...selected].join(','));
  return `${url.pathname}${url.search}${url.hash}`;
}
