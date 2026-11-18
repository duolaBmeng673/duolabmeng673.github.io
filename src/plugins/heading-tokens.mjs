export const BADGE_PREFIX = '（原题）';
export const OPEN_BRACKET_RE = /^([（【「《『〈〔〖])/;

/**
 * Split plain heading text into display tokens (leading badge / full-width open bracket / priority star / text)
 * while keeping raw source characters intact for IDs, anchors, search, and copy-paste.
 */
export function tokenizeHeadingText(value) {
  const tokens = [];
  let rest = String(value ?? '');

  if (rest.startsWith(BADGE_PREFIX)) {
    tokens.push({ type: 'badge', badge: '原题', open: '（', label: '原题', close: '）' });
    rest = rest.slice(BADGE_PREFIX.length);
  } else {
    const match = rest.match(OPEN_BRACKET_RE);
    if (match) {
      tokens.push({ type: 'lead-punct', value: match[1] });
      rest = rest.slice(match[1].length);
    }
  }

  if (rest.includes('⭐')) {
    rest.split('⭐').forEach((part, index) => {
      if (index > 0) tokens.push({ type: 'priority', value: '⭐' });
      if (part) tokens.push({ type: 'text', value: part });
    });
  } else if (rest) {
    tokens.push({ type: 'text', value: rest });
  }

  return tokens;
}
