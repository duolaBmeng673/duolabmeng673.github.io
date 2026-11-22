export const BADGE_PREFIX = '（原题）';
export const OPEN_BRACKET_RE = /^([（【「《『〈〔〖])/;

const TEX_COMMANDS = {
  mid: ' | ',
  lvert: '|',
  rvert: '|',
  le: '≤',
  leq: '≤',
  ge: '≥',
  geq: '≥',
  neq: '≠',
  ne: '≠',
  approx: '≈',
  times: '×',
  cdot: '·',
  to: '→',
  rightarrow: '→',
  leftarrow: '←',
  in: '∈',
  notin: '∉',
  subset: '⊂',
  subseteq: '⊆',
  cup: '∪',
  cap: '∩',
  infty: '∞',
  sum: 'Σ',
  prod: 'Π',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ϵ',
  varepsilon: 'ε',
  theta: 'θ',
  lambda: 'λ',
  mu: 'μ',
  pi: 'π',
  sigma: 'σ',
  phi: 'φ',
  omega: 'ω',
};

/**
 * Convert inline LaTeX expression into concise plain text for TOC display.
 */
export function formatInlineTex(rawTex) {
  let s = String(rawTex ?? '').trim();
  if (!s) return '';
  s = s.replace(/\\(?:mathrm|mathit|mathbf|mathsf|text|operatorname)\{([^{}]*)\}/g, '$1');
  s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2');
  s = s.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');
  s = s.replace(/\\([a-zA-Z]+)\b/g, (_, cmd) => TEX_COMMANDS[cmd] ?? cmd);
  s = s.replace(/([_^])\{([^{}]+)\}/g, (_, op, inner) => (inner.length === 1 ? `${op}${inner}` : `${op}(${inner})`));
  s = s.replace(/[{}]/g, '');
  return s.replace(/\s+/g, ' ').replace(/\s*\|\s*/g, ' | ').trim();
}

const normalizeHeadingTitle = (value) =>
  String(value ?? '').normalize('NFKC').replace(/[\s/：:·、，,。.!！?？-]/g, '').toLowerCase();

const normalizeSmartMatch = (value) =>
  String(value ?? '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

const applySmartQuotesOutsideMath = (value) => {
  let openDouble = true;
  let openSingle = true;
  return String(value ?? '')
    .replace(/"/g, () => { const ch = openDouble ? '“' : '”'; openDouble = !openDouble; return ch; })
    .replace(/'/g, () => { const ch = openSingle ? '‘' : '’'; openSingle = !openSingle; return ch; });
};

const stripInlineMarkdown = (value) =>
  String(value ?? '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/<[^>]+>/g, '');

/**
 * Restore plain-text math expressions lost when satteri collects text nodes after KaTeX HTML replacement.
 */
export function enrichHeadingsWithMath(headings, markdownBody, frontmatterTitle, frontmatterShortTitle) {
  if (!Array.isArray(headings) || !headings.length || !markdownBody || !markdownBody.includes('$')) {
    return headings;
  }
  const parsed = [];
  let inFence = false;
  let fenceChar = '';
  let first = true;
  let shift = false;

  for (const line of String(markdownBody).split(/\r?\n/)) {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const ch = fenceMatch[1][0];
      if (!inFence) { inFence = true; fenceChar = ch; }
      else if (ch === fenceChar) { inFence = false; fenceChar = ''; }
      continue;
    }
    if (inFence) continue;

    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const rawDepth = m[1].length;
    const rawBody = stripInlineMarkdown(m[2]);

    const plainForDup = rawBody.replace(/\$([^$]+)\$/g, '$1').trim();
    const isDuplicate = first && rawDepth === 1
      && [frontmatterTitle, frontmatterShortTitle].filter(Boolean).some((t) => normalizeHeadingTitle(t) === normalizeHeadingTitle(plainForDup));
    first = false;
    if (isDuplicate) continue;

    if (rawDepth === 1) shift = true;
    const depth = shift ? Math.min(6, rawDepth + 1) : rawDepth;

    const withoutMath = normalizeSmartMatch(rawBody.replace(/\$([^$]+)\$/g, ''));
    const withMath = rawBody
      .split(/(\$[^$]+\$)/g)
      .map((part) => (part.startsWith('$') && part.endsWith('$')
        ? formatInlineTex(part.slice(1, -1))
        : applySmartQuotesOutsideMath(part)))
      .join('')
      .trim();
    parsed.push({ depth, withoutMath, withMath });
  }

  let cursor = 0;
  return headings.map((heading) => {
    const targetText = String(heading.text ?? '').trim();
    const targetNorm = normalizeSmartMatch(targetText);
    for (let i = cursor; i < parsed.length; i++) {
      if (parsed[i].depth === heading.depth && parsed[i].withoutMath === targetNorm) {
        cursor = i + 1;
        return parsed[i].withMath === targetText ? heading : { ...heading, text: parsed[i].withMath };
      }
    }
    return heading;
  });
}

/**
 * Split plain heading text into display tokens (leading badge / full-width open bracket / text)
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

  if (rest) tokens.push({ type: 'text', value: rest });

  return tokens;
}

/**
 * Strip a single top-level wrapper heading (e.g. a non-matching chapter H1) and promote its children.
 */
export function normalizeTocSections(headings) {
  if (!Array.isArray(headings) || !headings.length) return [];
  let items = headings;
  if (items.length > 1) {
    const minDepth = Math.min(...items.map((heading) => heading.depth));
    const topCount = items.filter((heading) => heading.depth === minDepth).length;
    if (topCount === 1 && items[0].depth === minDepth) {
      const rest = items.slice(1);
      const nextMin = Math.min(...rest.map((heading) => heading.depth));
      const delta = Math.max(0, nextMin - 2);
      items = rest.map((heading) => ({ ...heading, depth: Math.max(2, heading.depth - delta) }));
    }
  }
  return items.filter((heading) => heading.depth >= 2 && heading.depth <= 3);
}
