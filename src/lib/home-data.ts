import { render } from 'astro:content';
import { siteConfig } from '../config';
import { buildActivityDataset } from './activity-data';
import { type ActivityRecord } from './activity';
import { getAllPosts, getPostHref, getPostTitle, type BlogPost } from './blog';
import { enrichHeadingsWithMath, stripHeadingBadge } from '../plugins/heading-tokens.mjs';
import { studyModules } from './study';

export interface PresetNoteItem {
  date: string;
  title: string;
  href: string;
}

export interface StagePreset {
  slug: 'all' | 'research' | 'cs' | '837';
  name: string;
  presetName: string;
  count: number;
  horizonColor: string;
  waveColor: string;
  crestColor: string;
  amplitude: number;
  swell: number;
  turbulence: number;
  waveScale: number;
  lightAngle: number;
  speed: number;
  notes: PresetNoteItem[];
}

export interface HeatmapItemPayload {
  date: string;
  type: ActivityRecord['type'];
  label: string;
  count: number;
  description: string;
}

export interface DailyReviewItem {
  question: string;
  isExam: boolean;
  subject: string;
  noteTitle: string;
  href: string;
}

export interface DailyReviewData {
  buildDate: string;
  initialIndex: number;
  items: DailyReviewItem[];
}

export function pickDailyReviewIndex(dateStr: string, length: number): number {
  if (length <= 1) return 0;
  let hash = 2166136261;
  for (let i = 0; i < dateStr.length; i += 1) {
    hash ^= dateStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % length;
}

const EXAM_HEADING_RE = /[（(【\[]\s*原题\s*[）)】\]]/;
const QUESTION_END_RE = /[？?]\s*$/;

function formatSlashDate(date: Date) {
  return date.toISOString().slice(0, 10).replace(/-/g, '/');
}

function toPresetNote(post: BlogPost): PresetNoteItem {
  return {
    date: formatSlashDate(post.data.pubDate),
    title: getPostTitle(post),
    href: getPostHref(post),
  };
}

export async function getHomePageData() {
  const posts = await getAllPosts();
  const researchPosts = posts.filter((post) => post.data.category === 'Research');
  const csPosts = posts.filter((post) => post.data.category === 'Computer Science');
  const studyPosts = posts.filter((post) => post.collection === 'study_notes');

  const infoSecPosts = studyPosts
    .filter((post) => post.collection === 'study_notes' && post.data.subject === '信息安全导论')
    .sort((a, b) => (a.collection === 'study_notes' && b.collection === 'study_notes' ? a.data.order - b.data.order : 0));
  const netSecPosts = studyPosts
    .filter((post) => post.collection === 'study_notes' && post.data.subject === '网络安全基础')
    .sort((a, b) => (a.collection === 'study_notes' && b.collection === 'study_notes' ? a.data.order - b.data.order : 0));
  const cnPosts = studyPosts
    .filter((post) => post.collection === 'study_notes' && post.data.subject === '计算机网络')
    .sort((a, b) => (a.collection === 'study_notes' && b.collection === 'study_notes' ? a.data.order - b.data.order : 0));

  const presets: StagePreset[] = [
    {
      slug: 'all',
      name: '全部笔记',
      presetName: 'Dusk',
      count: posts.length,
      horizonColor: '#5227FF',
      waveColor: '#C084FC',
      crestColor: '#F3E8FF',
      amplitude: 2.35,
      swell: 30,
      turbulence: 19,
      waveScale: 0.58,
      lightAngle: 145,
      speed: 0.44,
      notes: posts.slice(0, 6).map(toPresetNote),
    },
    {
      slug: 'research',
      name: '论文笔记',
      presetName: 'Ocean',
      count: researchPosts.length,
      horizonColor: '#2563EB',
      waveColor: '#38BDF8',
      crestColor: '#E0F2FE',
      amplitude: 2.55,
      swell: 34,
      turbulence: 21,
      waveScale: 0.58,
      lightAngle: 130,
      speed: 0.45,
      notes: researchPosts.slice(0, 6).map(toPresetNote),
    },
    {
      slug: 'cs',
      name: '技术笔记',
      presetName: 'Dune',
      count: csPosts.length,
      horizonColor: '#C2416B',
      waveColor: '#FB7185',
      crestColor: '#FFE4E6',
      amplitude: 2.65,
      swell: 36,
      turbulence: 22,
      waveScale: 0.58,
      lightAngle: 154,
      speed: 0.47,
      notes: csPosts.slice(0, 6).map(toPresetNote),
    },
    {
      slug: '837',
      name: '学习笔记',
      presetName: 'Aurora',
      count: studyPosts.length,
      horizonColor: '#0D9488',
      waveColor: '#34D399',
      crestColor: '#D1FAE5',
      amplitude: 2.45,
      swell: 33,
      turbulence: 20,
      waveScale: 0.58,
      lightAngle: 138,
      speed: 0.43,
      notes: studyPosts.slice(0, 6).map(toPresetNote),
    },
  ];

  // Build activity items using the shared Git + publication dataset builder (homepage displays content categories only)
  const activityDataset = buildActivityDataset(posts);
  const {
    buildDate,
    visibleHomeSummary: visibleSummary,
    rawWritingRecords: writingRecords,
    rawContentActivityRecords: rawActivities,
    writingItems: heatmapWritingItems,
    contentActivityItems: heatmapActivityItems,
  } = activityDataset;

  const combinedItems = [...heatmapActivityItems, ...heatmapWritingItems].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const recentActivityPreview = combinedItems.slice(0, 4);
  const latestActiveDate = combinedItems[0]?.date ?? buildDate;
  const latestActiveEntries = combinedItems.filter((item) => item.date === latestActiveDate);

  // Build deterministic review question pool from all public 837 study notes
  const reviewPool: DailyReviewItem[] = [];
  for (const post of [...infoSecPosts, ...netSecPosts, ...cnPosts]) {
    if (post.collection !== 'study_notes') continue;
    const { headings } = await render(post);
    const enriched = enrichHeadingsWithMath(headings, post.body ?? '', post.data.title, post.data.shortTitle);
    const postHref = getPostHref(post);
    const noteTitle = getPostTitle(post);
    const subjectTitle = studyModules[post.data.subject]?.title ?? post.data.subject;
    for (const heading of enriched) {
      if (heading.depth < 2 || heading.depth > 3) continue;
      const isExam = EXAM_HEADING_RE.test(heading.text);
      const clean = stripHeadingBadge(heading.text).trim();
      if (!clean || (!isExam && !QUESTION_END_RE.test(clean))) continue;
      reviewPool.push({
        question: clean,
        isExam,
        subject: subjectTitle,
        noteTitle,
        href: `${postHref}#${heading.slug}`,
      });
    }
  }

  const dailyReview: DailyReviewData = {
    buildDate,
    initialIndex: pickDailyReviewIndex(buildDate, reviewPool.length),
    items: reviewPool,
  };

  return {
    site: siteConfig,
    totalCount: posts.length,
    presets,
    tracks: {
      research: {
        count: researchPosts.length,
        items: researchPosts.slice(0, 3).map((post) => ({
          href: getPostHref(post),
          title: getPostTitle(post),
          dateShort: post.data.pubDate.toISOString().slice(5, 10),
        })),
      },
      cs: {
        count: csPosts.length,
        items: csPosts.slice(0, 3).map((post) => ({
          href: getPostHref(post),
          title: getPostTitle(post),
          dateShort: post.data.pubDate.toISOString().slice(5, 10),
        })),
      },
      study: {
        count: studyPosts.length,
        infoSecCount: infoSecPosts.length,
        netSecCount: netSecPosts.length,
        cnCount: cnPosts.length,
      },
    },
    dailyReview,
    heatmap: {
      buildDate,
      windowLabel: visibleSummary.windowLabel,
      visibleWeeks: visibleSummary.weeks,
      activeDays: visibleSummary.activityDays,
      totalActivities: visibleSummary.totalActivities,
      longestStreak: visibleSummary.longestStreak,
      monthActivities: visibleSummary.monthActivities,
      latestActiveDate,
      latestActiveEntries,
      recentActivityPreview,
      writingItems: heatmapWritingItems,
      activityItems: heatmapActivityItems,
      rawWritingRecords: writingRecords,
      rawActivities,
    },
  };
}
