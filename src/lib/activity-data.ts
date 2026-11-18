import {
  createActivityCalendar,
  getVisibleCalendarStats,
  type ActivityRecord,
  type HeatmapCategory,
} from './activity.ts';
import { heatmapCategoryMeta } from './about-heatmap-model.ts';
import { getGitActivityResult, toShanghaiDateKey, type GitFilterHits, type NoteTargetInfo } from './activity-git.ts';
import { getPostHref, getPostTitle, taxonomyLabel, type BlogPost } from './blog';

export interface UnifiedHeatmapItem {
  date: string;
  type: ActivityRecord['type'];
  category: HeatmapCategory;
  categoryLabel: string;
  label: string;
  count: number;
  description: string;
  href: string;
  shortHash?: string;
}

export interface UnifiedHeatmapDataset {
  buildDate: string;
  yearsWithData: number[];
  rawWritingRecords: ActivityRecord[];
  rawActivityRecords: ActivityRecord[];
  rawContentActivityRecords: ActivityRecord[];
  writingItems: UnifiedHeatmapItem[];
  activityItems: UnifiedHeatmapItem[];
  contentActivityItems: UnifiedHeatmapItem[];
  allItems: UnifiedHeatmapItem[];
  homeCalendar365: ReturnType<typeof createActivityCalendar>;
  visibleHomeSummary: ReturnType<typeof getVisibleCalendarStats>;
  filterStats: {
    totalCommits: number;
    filteredCount: number;
    filterHits: GitFilterHits;
    nonCountingCount: {
      addedNotesOnly: number;
      docsMetaOnly: number;
    };
  };
}

function postToHeatmapCategory(post: BlogPost): HeatmapCategory {
  if (post.collection === 'study_notes') return 'study';
  return post.data.category === 'Research' ? 'paper' : 'tech';
}

/**
 * Single source of truth used by BOTH Homepage (`home-data.ts`) and `/about/` (`about.astro`).
 * - Writing first-publications come from post `pubDate` (no duplicate counting from Git note imports).
 * - Revisions (`revision`) and site updates (`site`) come automatically from filtered Git history (Asia/Shanghai).
 */
export function buildActivityDataset(
  posts: BlogPost[],
  options: { today?: Date; cwd?: string } = {},
): UnifiedHeatmapDataset {
  const noteHrefByPath = new Map<string, NoteTargetInfo>();
  for (const post of posts) {
    if (typeof post.filePath === 'string' && post.filePath.length > 0) {
      noteHrefByPath.set(post.filePath.replace(/\\/g, '/'), {
        href: getPostHref(post),
        title: getPostTitle(post),
      });
    }
  }

  const gitResult = getGitActivityResult({
    cwd: options.cwd,
    noteHrefByPath,
  });

  const rawWritingRecords: ActivityRecord[] = posts.map((post) => ({
    date: post.data.pubDate.toISOString().slice(0, 10),
    type: 'writing',
    count: 1,
    description: post.data.title,
  }));

  const writingItems: UnifiedHeatmapItem[] = posts.map((post) => {
    const category = postToHeatmapCategory(post);
    return {
      date: post.data.pubDate.toISOString().slice(0, 10),
      type: 'writing',
      category,
      categoryLabel: heatmapCategoryMeta[category].label,
      label: taxonomyLabel(post.data.category),
      count: 1,
      description: getPostTitle(post),
      href: getPostHref(post),
    };
  });

  const rawActivityRecords: ActivityRecord[] = gitResult.entries.map((entry) => ({
    date: entry.date,
    type: entry.type,
    count: 1,
    description: entry.description,
  }));

  const activityItems: UnifiedHeatmapItem[] = gitResult.entries.map((entry) => ({
    date: entry.date,
    type: entry.type,
    category: entry.category,
    categoryLabel: heatmapCategoryMeta[entry.category].label,
    label: entry.type === 'site' ? '博客功能' : heatmapCategoryMeta[entry.category].label,
    count: 1,
    description: entry.description,
    href: entry.href,
    shortHash: entry.shortHash,
  }));

  const rawContentActivityRecords = rawActivityRecords.filter((record) => record.type !== 'site');
  const contentActivityItems = activityItems.filter((item) => item.type !== 'site');

  const allItems = [...activityItems, ...writingItems].sort((a, b) => b.date.localeCompare(a.date));
  const yearsWithData = [...new Set(allItems.map((item) => Number(item.date.slice(0, 4))))]
    .filter((year) => Number.isInteger(year))
    .sort((a, b) => b - a);

  const today = options.today ?? new Date();
  const buildDate = toShanghaiDateKey(today);
  const shanghaiAnchor = new Date(`${buildDate}T00:00:00`);
  shanghaiAnchor.setHours(0, 0, 0, 0);
  const homeCalendar365 = createActivityCalendar(
    [...rawContentActivityRecords, ...rawWritingRecords],
    shanghaiAnchor,
    365,
  );
  const visibleHomeSummary = getVisibleCalendarStats(homeCalendar365, buildDate, 34);

  return {
    buildDate,
    yearsWithData,
    rawWritingRecords,
    rawActivityRecords,
    rawContentActivityRecords,
    writingItems,
    activityItems,
    contentActivityItems,
    allItems,
    homeCalendar365,
    visibleHomeSummary,
    filterStats: {
      totalCommits: gitResult.totalCommits,
      filteredCount: gitResult.filteredCount,
      filterHits: gitResult.filterHits,
      nonCountingCount: gitResult.nonCountingCount,
    },
  };
}
