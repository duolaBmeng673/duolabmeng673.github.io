const OPEN_SENTINEL = '\uE000 ';
const CLOSE_SENTINEL = ' \uE001';
const CJK_CHAR_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const PUNCT_RE = /[\p{P}\p{S}]/u;
const WS_RE = /\s/u;

const SKIP_PATTERNS = [
  /^---[\r\n][\s\S]*?[\r\n]---(?:\r?\n|$)/g,
  /^([ \t]*)(`{3,}|~{3,})[^\n]*\r?\n[\s\S]*?\r?\n\1\2[ \t]*$/gm,
  /<!--[\s\S]*?-->/g,
  /\$\$[\s\S]*?\$\$/g,
  /(`+)[\s\S]*?\1/g,
  /(?<!\\)\$(?!\s)[^\n$]+?(?<!\s)\$/g,
  /\]\((?:\\.|[^()\n]|\([^)\n]*\))*\)/g,
];

function computeSkipRanges(src) {
  const ranges = [];
  for (const re of SKIP_PATTERNS) {
    for (const match of src.matchAll(re)) {
      ranges.push([match.index, match.index + match[0].length]);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const seg of ranges) {
    if (!merged.length || seg[0] >= merged[merged.length - 1][1]) {
      merged.push([seg[0], seg[1]]);
    } else {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], seg[1]);
    }
  }
  return merged;
}

/**
 * Pad CJK punctuation-adjacent emphasis delimiters (** / *** / __) with removable sentinel spaces
 * so CommonMark flanking rules recognize bold spans cleanly without changing Markdown source files.
 */
export function preprocessCjkEmphasis(source) {
  const src = String(source ?? '');
  if (!src.includes('**') && !src.includes('__')) return src;

  const skips = computeSkipRanges(src);
  let skipIdx = 0;
  const inSkip = (pos) => {
    while (skipIdx < skips.length && skips[skipIdx][1] <= pos) skipIdx += 1;
    return skipIdx < skips.length && pos >= skips[skipIdx][0] && pos < skips[skipIdx][1];
  };

  let out = '';
  let i = 0;
  let starOpen = false;
  let underOpen = false;

  while (i < src.length) {
    if (
      src[i] === '\n'
      && (src[i + 1] === '\n'
        || (src[i + 1] === '\r' && src[i + 2] === '\n')
        || /^(?:[ \t]*(?:#{1,6}\s|[-*+]\s|\d+\.\s|>|\|))/.test(src.slice(i + 1, i + 16)))
    ) {
      starOpen = false;
      underOpen = false;
    }

    if (!inSkip(i) && (src.startsWith('**', i) || src.startsWith('__', i)) && (i === 0 || src[i - 1] !== '\\')) {
      const ch = src[i];
      let j = i;
      while (j < src.length && src[j] === ch) j += 1;
      const runLen = j - i;
      const prev = i > 0 ? src[i - 1] : '';
      const next = j < src.length ? src[j] : '';
      const prevIsWs = !prev || WS_RE.test(prev);
      const nextIsWs = !next || WS_RE.test(next);
      const prevIsCjk = Boolean(prev) && CJK_CHAR_RE.test(prev);
      const nextIsCjk = Boolean(next) && CJK_CHAR_RE.test(next);
      const prevIsPunct = Boolean(prev) && PUNCT_RE.test(prev);
      const nextIsPunct = Boolean(next) && PUNCT_RE.test(next);

      if (runLen >= 2) {
        const isOpen = ch === '*' ? starOpen : underOpen;
        let prefix = '';
        let suffix = '';

        if (!isOpen && !nextIsWs) {
          if ((prevIsCjk && nextIsPunct) || (ch === '_' && prevIsCjk)) {
            prefix = OPEN_SENTINEL;
          }
          if (ch === '*') starOpen = true;
          else underOpen = true;
        } else if (isOpen && !prevIsWs) {
          if ((prevIsPunct && nextIsCjk) || (ch === '_' && nextIsCjk)) {
            suffix = CLOSE_SENTINEL;
          }
          if (ch === '*') starOpen = false;
          else underOpen = false;
        } else if (isOpen && prevIsWs && !nextIsWs && ((prevIsCjk && nextIsPunct) || (ch === '_' && prevIsCjk))) {
          prefix = OPEN_SENTINEL;
        }

        out += prefix + src.slice(i, j) + suffix;
        i = j;
        continue;
      }
    }

    out += src[i];
    i += 1;
  }

  return out;
}

export const stripCjkEmphasisSentinels = {
  name: 'cjk-emphasis-strip-sentinels',
  text(node, context) {
    if (!node.value || (!node.value.includes('\uE000') && !node.value.includes('\uE001'))) return;
    const cleaned = node.value
      .replace(/\uE000 /g, '')
      .replace(/ \uE001/g, '')
      .replace(/[\uE000\uE001]/g, '');
    context.setProperty(node, 'value', cleaned);
  },
};

export function withCjkEmphasis(baseProcessor) {
  baseProcessor.options.mdastPlugins = [
    stripCjkEmphasisSentinels,
    ...(baseProcessor.options?.mdastPlugins ?? []),
  ];
  return {
    ...baseProcessor,
    async createRenderer(shared) {
      const renderer = await baseProcessor.createRenderer(shared);
      return {
        ...renderer,
        render(content, renderOpts) {
          return renderer.render(preprocessCjkEmphasis(content), renderOpts);
        },
      };
    },
  };
}
