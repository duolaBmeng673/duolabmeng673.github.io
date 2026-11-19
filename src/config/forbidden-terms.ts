/**
 * Forbidden public output patterns checked against built dist/ HTML, search index, RSS, and sitemap.
 * Keep this list targeted and extensible; do not broaden patterns to unrelated brand mentions without review.
 */
export interface ForbiddenTermRule {
  id: string;
  pattern: RegExp;
  reason: string;
}

export const FORBIDDEN_PUBLIC_TERMS: readonly ForbiddenTermRule[] = [
  {
    id: 'huawei-brand',
    pattern: /huawei/i,
    reason: 'User-directed cleanup of exam-origin collection names, URLs, and tags.',
  },
];

export function findForbiddenMatches(text: string, rules: readonly ForbiddenTermRule[] = FORBIDDEN_PUBLIC_TERMS) {
  const hits: Array<{ id: string; match: string }> = [];
  for (const rule of rules) {
    const flags = rule.pattern.flags.includes('g') ? rule.pattern.flags : `${rule.pattern.flags}g`;
    const re = new RegExp(rule.pattern.source, flags);
    for (const m of text.matchAll(re)) {
      hits.push({ id: rule.id, match: m[0] });
      break;
    }
  }
  return hits;
}
