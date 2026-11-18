export const HEATMAP_TIMEZONE = 'Asia/Shanghai' as const;

/**
 * Centralized filtering and classification rules for build-time Git activity extraction.
 * See docs/heatmap-filter.md for thresholds and observed hit counts.
 */
export const HEATMAP_FILTER_CONFIG = {
  /** Rule 1: Skip merge commits (parent count > 1). */
  excludeMerges: true,

  /** Rule 2: Skip automated dependency / CI bot commits. */
  botAuthorPatterns: [
    /dependabot(?:\[bot\])?/i,
    /renovate(?:\[bot\])?/i,
    /github-actions(?:\[bot\])?/i,
    /\[bot\]$/i,
  ],

  /** Rule 3: Skip revert commits and their canceled original commits (including revert-of-revert noise). */
  revertNoise: {
    enabled: true,
    subjectPattern: /^Revert\s+"(.+)"$/i,
    cancelRevertedOriginal: true,
  },

  /** Rule 4: Skip commits whose subject starts with trivial maintenance prefixes. */
  messagePrefixPatterns: [
    /^(?:chore|typo|wip|format|lint)(?:\([^)]*\))?:/i,
    /^(?:typo|wip|format|fixup!|squash!)\b/i,
  ],

  /** Rule 5: Skip non-root commits whose non-whitespace diff (-w --ignore-blank-lines) is empty. */
  excludeWhitespaceOnly: true,

  /** Rule 6: Skip commits touching only Markdown files whose character-level diff is below threshold. */
  tinyMarkdownOnly: {
    enabled: true,
    minChangedChars: 40,
    extensions: ['.md', '.mdx'],
  },

  /** Paths belonging to note content collections. Modified notes count as revision; added/deleted notes come from pubDate. */
  contentNoteRoots: ['src/content/'],

  /** Docs and workspace meta files excluded from triggering "功能更新" (`site`). */
  ignoredMetaPaths: [
    /^AGENTS\.md$/,
    /^CLAUDE\.md$/,
    /^README\.md$/,
    /^TECHNICAL_HANDOFF\.md$/,
    /^docs\//,
    /(?:^|\/)\.DS_Store$/,
  ],
} as const;
