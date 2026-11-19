import { execFileSync } from 'node:child_process';
import { HEATMAP_FILTER_CONFIG, HEATMAP_TIMEZONE } from '../config/heatmap-filter.ts';
import type { ActivityType, HeatmapCategory } from './activity.ts';

export interface ParsedGitFileChange {
  status: string;
  path: string;
}

export interface ParsedGitCommit {
  hash: string;
  shortHash: string;
  parentCount: number;
  committedAt: string;
  author: string;
  email: string;
  subject: string;
  files: ParsedGitFileChange[];
  isWhitespaceOnly?: boolean;
  mdChangedChars?: number;
}

export interface GitFilterHits {
  mergeCommits: number;
  botAuthors: number;
  revertNoise: number;
  messagePrefix: number;
  whitespaceOnly: number;
  tinyMarkdownOnly: number;
}

export interface GitActivityEntry {
  date: string;
  type: Extract<ActivityType, 'revision' | 'site'>;
  category: Extract<HeatmapCategory, 'revision' | 'site'>;
  label: string;
  count: 1;
  description: string;
  href: string;
  shortHash: string;
}

export interface GitActivityExtractionResult {
  totalCommits: number;
  filteredCount: number;
  filterHits: GitFilterHits;
  nonCountingCount: {
    addedNotesOnly: number;
    docsMetaOnly: number;
  };
  entries: GitActivityEntry[];
}

export function redactHeatmapSubject(subject: string): string {
  const { patterns, replacement } = HEATMAP_FILTER_CONFIG.subjectRedaction;
  return patterns.some((pattern) => pattern.test(subject)) ? replacement : subject;
}

export interface NoteTargetInfo {
  href: string;
  title: string;
}

const shanghaiDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: HEATMAP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Format any Date, ISO timestamp string, or Unix epoch ms into a YYYY-MM-DD key in Asia/Shanghai. */
export function toShanghaiDateKey(input: Date | string | number): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`Invalid commit timestamp for Asia/Shanghai conversion: ${String(input)}`);
  }
  return shanghaiDateFormatter.format(date);
}

/** Abort build loudly if repository is shallow, preventing truncated Git heatmaps in CI. */
export function assertFullGitHistory(cwd = process.cwd()): void {
  const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
    cwd,
    encoding: 'utf8',
  }).trim();
  if (shallow === 'true') {
    throw new Error(
      'Shallow git repository detected (`git rev-parse --is-shallow-repository` === true). ' +
      'Complete git history is required to generate the activity heatmap. ' +
      'Run `git fetch --unshallow` locally or set `fetch-depth: 0` on `actions/checkout` in `.github/workflows/deploy.yml`.',
    );
  }
}

function isMarkdownPath(filePath: string): boolean {
  return HEATMAP_FILTER_CONFIG.tinyMarkdownOnly.extensions.some((ext) =>
    filePath.toLowerCase().endsWith(ext),
  );
}

function isContentNotePath(filePath: string): boolean {
  return (
    HEATMAP_FILTER_CONFIG.contentNoteRoots.some((root) => filePath.startsWith(root)) &&
    isMarkdownPath(filePath)
  );
}

function isIgnoredMetaPath(filePath: string): boolean {
  return HEATMAP_FILTER_CONFIG.ignoredMetaPaths.some((re) => re.test(filePath));
}

function inferSiteHref(files: ParsedGitFileChange[]): string {
  const paths = files.map((file) => file.path);
  if (paths.some((p) => p.includes('/tools/') || p.startsWith('src/data/tools'))) return '/tools/';
  if (paths.some((p) => p.includes('about'))) return '/about/';
  if (paths.some((p) => p.includes('study-notes') || p.includes('knowledge-') || p.includes('tags.json'))) {
    return '/study-notes/837/';
  }
  if (paths.some((p) => p.includes('blog'))) return '/blog/';
  return '/';
}

function inferRevisionHref(
  files: ParsedGitFileChange[],
  noteHrefByPath?: Map<string, NoteTargetInfo>,
): string {
  const modifiedNotes = files.filter((file) => isContentNotePath(file.path) && /^[MR]/.test(file.status));
  if (noteHrefByPath) {
    for (const noteFile of modifiedNotes) {
      const target = noteHrefByPath.get(noteFile.path);
      if (target) return target.href;
    }
  }
  if (modifiedNotes.some((file) => file.path.includes('837考研'))) return '/study-notes/837/';
  return '/blog/';
}

function measureNonWhitespaceDiffChars(hash: string, cwd: string): number {
  const wd = execFileSync(
    'git',
    ['-c', 'core.quotepath=false', 'show', '--root', '--format=', '--word-diff=porcelain', '--word-diff-regex=.', hash],
    { cwd, encoding: 'utf8' },
  );
  let chars = 0;
  for (const line of wd.split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@') || line.startsWith('diff ')) {
      continue;
    }
    if (line.startsWith('+') || line.startsWith('-')) {
      chars += line.slice(1).replace(/\s+/g, '').length;
    }
  }
  return chars;
}

function isCommitWhitespaceOnly(hash: string, cwd: string): boolean {
  const diffOut = execFileSync(
    'git',
    ['-c', 'core.quotepath=false', 'diff-tree', '--no-commit-id', '-r', '-p', '-w', '--ignore-blank-lines', hash],
    { cwd, encoding: 'utf8' },
  ).trim();
  return diffOut.length === 0;
}

export function filterAndClassifyGitCommits(
  commits: ParsedGitCommit[],
  options: {
    noteHrefByPath?: Map<string, NoteTargetInfo>;
    measureWhitespaceOnly?: (commit: ParsedGitCommit) => boolean;
    measureMdChangedChars?: (commit: ParsedGitCommit) => number;
  } = {},
): GitActivityExtractionResult {
  const filterHits: GitFilterHits = {
    mergeCommits: 0,
    botAuthors: 0,
    revertNoise: 0,
    messagePrefix: 0,
    whitespaceOnly: 0,
    tinyMarkdownOnly: 0,
  };
  const nonCountingCount = { addedNotesOnly: 0, docsMetaOnly: 0 };

  const revertPendingOriginal = new Map<string, number>();
  if (HEATMAP_FILTER_CONFIG.revertNoise.enabled && HEATMAP_FILTER_CONFIG.revertNoise.cancelRevertedOriginal) {
    for (const commit of commits) {
      const m = commit.subject.match(HEATMAP_FILTER_CONFIG.revertNoise.subjectPattern);
      if (m) {
        revertPendingOriginal.set(m[1], (revertPendingOriginal.get(m[1]) ?? 0) + 1);
      }
    }
  }

  const entries: GitActivityEntry[] = [];

  for (const commit of commits) {
    if (HEATMAP_FILTER_CONFIG.excludeMerges && commit.parentCount > 1) {
      filterHits.mergeCommits += 1;
      continue;
    }

    if (
      HEATMAP_FILTER_CONFIG.botAuthorPatterns.some(
        (re) => re.test(commit.author) || re.test(commit.email),
      )
    ) {
      filterHits.botAuthors += 1;
      continue;
    }

    if (HEATMAP_FILTER_CONFIG.revertNoise.enabled) {
      if (HEATMAP_FILTER_CONFIG.revertNoise.subjectPattern.test(commit.subject)) {
        filterHits.revertNoise += 1;
        continue;
      }
      const pending = revertPendingOriginal.get(commit.subject) ?? 0;
      if (pending > 0) {
        revertPendingOriginal.set(commit.subject, pending - 1);
        filterHits.revertNoise += 1;
        continue;
      }
    }

    if (HEATMAP_FILTER_CONFIG.messagePrefixPatterns.some((re) => re.test(commit.subject))) {
      filterHits.messagePrefix += 1;
      continue;
    }

    if (
      HEATMAP_FILTER_CONFIG.excludeWhitespaceOnly &&
      commit.parentCount > 0 &&
      commit.files.length > 0
    ) {
      const wsOnly = commit.isWhitespaceOnly ?? options.measureWhitespaceOnly?.(commit) ?? false;
      if (wsOnly) {
        filterHits.whitespaceOnly += 1;
        continue;
      }
    }

    if (
      HEATMAP_FILTER_CONFIG.tinyMarkdownOnly.enabled &&
      commit.files.length > 0 &&
      commit.files.every((file) => isMarkdownPath(file.path))
    ) {
      const chars = commit.mdChangedChars ?? options.measureMdChangedChars?.(commit) ?? Infinity;
      if (chars < HEATMAP_FILTER_CONFIG.tinyMarkdownOnly.minChangedChars) {
        filterHits.tinyMarkdownOnly += 1;
        continue;
      }
    }

    const hasRevision = commit.files.some(
      (file) => isContentNotePath(file.path) && /^[MR]/.test(file.status),
    );
    const hasSite = commit.files.some(
      (file) => !file.path.startsWith('src/content/') && !isIgnoredMetaPath(file.path),
    );

    if (!hasRevision && !hasSite) {
      if (commit.files.some((file) => isContentNotePath(file.path) && file.status.startsWith('A'))) {
        nonCountingCount.addedNotesOnly += 1;
      } else {
        nonCountingCount.docsMetaOnly += 1;
      }
      continue;
    }

    const date = toShanghaiDateKey(commit.committedAt);
    const displaySubject = redactHeatmapSubject(commit.subject);

    if (hasRevision) {
      entries.push({
        date,
        type: 'revision',
        category: 'revision',
        label: '修订',
        count: 1,
        description: displaySubject,
        href: inferRevisionHref(commit.files, options.noteHrefByPath),
        shortHash: commit.shortHash,
      });
    }

    if (hasSite) {
      entries.push({
        date,
        type: 'site',
        category: 'site',
        label: '功能更新',
        count: 1,
        description: displaySubject,
        href: inferSiteHref(commit.files),
        shortHash: commit.shortHash,
      });
    }
  }

  const filteredCount = Object.values(filterHits).reduce((sum, n) => sum + n, 0);
  return {
    totalCommits: commits.length,
    filteredCount,
    filterHits,
    nonCountingCount,
    entries,
  };
}

function parseGitCommitsFromRepo(cwd: string): ParsedGitCommit[] {
  const raw = execFileSync(
    'git',
    ['-c', 'core.quotepath=false', 'log', '--format=@@@%H|%h|%P|%cI|%an|%ae|%s', '--name-status'],
    { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  const blocks = raw.split('@@@').slice(1);
  return blocks.map((block: string) => {
    const lines = block.trim().split('\n').filter(Boolean);
    const [hash, shortHash, parents, committedAt, author, email, ...subjectParts] = lines[0].split('|');
    const subject = subjectParts.join('|');
    const files: ParsedGitFileChange[] = lines.slice(1).map((line: string) => {
      const parts = line.split('\t');
      return { status: parts[0], path: parts[parts.length - 1] };
    });
    return {
      hash,
      shortHash,
      parentCount: parents ? parents.split(' ').filter(Boolean).length : 0,
      committedAt,
      author,
      email,
      subject,
      files,
    };
  });
}

let cachedParsedCommits: { cwd: string; head: string; commits: ParsedGitCommit[] } | null = null;

export function getGitActivityResult(options: {
  cwd?: string;
  noteHrefByPath?: Map<string, NoteTargetInfo>;
  bypassCache?: boolean;
} = {}): GitActivityExtractionResult {
  const cwd = options.cwd ?? process.cwd();
  assertFullGitHistory(cwd);
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();

  const cached = cachedParsedCommits;
  let commits: ParsedGitCommit[];
  if (!options.bypassCache && cached && cached.cwd === cwd && cached.head === head) {
    commits = cached.commits;
  } else {
    commits = parseGitCommitsFromRepo(cwd).map((commit) => {
      const enriched: ParsedGitCommit = { ...commit };
      if (commit.parentCount > 0 && commit.files.length > 0) {
        enriched.isWhitespaceOnly = isCommitWhitespaceOnly(commit.hash, cwd);
      }
      if (commit.files.length > 0 && commit.files.every((file) => isMarkdownPath(file.path))) {
        enriched.mdChangedChars = measureNonWhitespaceDiffChars(commit.hash, cwd);
      }
      return enriched;
    });
    cachedParsedCommits = { cwd, head, commits };
  }

  return filterAndClassifyGitCommits(commits, {
    noteHrefByPath: options.noteHrefByPath,
  });
}
