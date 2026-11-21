import { siteConfig } from '../config';
import { buildActivityDataset } from './activity-data';
import { type ActivityRecord } from './activity';
import { getAllPosts, getPostHref, getPostTitle, type BlogPost } from './blog';
import { getKnowledgeTags } from './knowledge-tags';
import { PALETTE } from './palette';
import { getStudyModuleHref, studyModules } from './study';

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
  moreHref: string;
  moreLabel: string;
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

export interface KnowledgeQuickTag {
  name: string;
  category: string;
  href: string;
  tooltip: string;
}

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
      presetName: PALETTE.channels.all.presetName,
      count: posts.length,
      moreHref: '/blog/',
      moreLabel: '查看全部笔记 ↗',
      horizonColor: PALETTE.channels.all.wave.horizon,
      waveColor: PALETTE.channels.all.wave.wave,
      crestColor: PALETTE.channels.all.wave.crest,
      amplitude: 2.2,
      swell: 28,
      turbulence: 18,
      waveScale: 0.58,
      lightAngle: 145,
      speed: 0.48,
      notes: posts.slice(0, 6).map(toPresetNote),
    },
    {
      slug: 'research',
      name: '论文笔记',
      presetName: PALETTE.channels.research.presetName,
      count: researchPosts.length,
      moreHref: '/blog/?category=Research',
      moreLabel: '查看全部论文笔记 ↗',
      horizonColor: PALETTE.channels.research.wave.horizon,
      waveColor: PALETTE.channels.research.wave.wave,
      crestColor: PALETTE.channels.research.wave.crest,
      amplitude: 2.7,
      swell: 35,
      turbulence: 22,
      waveScale: 0.62,
      lightAngle: 125,
      speed: 0.45,
      notes: researchPosts.slice(0, 6).map(toPresetNote),
    },
    {
      slug: 'cs',
      name: '技术笔记',
      presetName: PALETTE.channels.cs.presetName,
      count: csPosts.length,
      moreHref: '/blog/?category=Computer+Science',
      moreLabel: '查看全部技术笔记 ↗',
      horizonColor: PALETTE.channels.cs.wave.horizon,
      waveColor: PALETTE.channels.cs.wave.wave,
      crestColor: PALETTE.channels.cs.wave.crest,
      amplitude: 3.0,
      swell: 38,
      turbulence: 25,
      waveScale: 0.54,
      lightAngle: 160,
      speed: 0.52,
      notes: csPosts.slice(0, 6).map(toPresetNote),
    },
    {
      slug: '837',
      name: '学习笔记',
      presetName: PALETTE.channels['837'].presetName,
      count: studyPosts.length,
      moreHref: '/study-notes/837/',
      moreLabel: '查看全部学习笔记 ↗',
      horizonColor: PALETTE.channels['837'].wave.horizon,
      waveColor: PALETTE.channels['837'].wave.wave,
      crestColor: PALETTE.channels['837'].wave.crest,
      amplitude: 2.5,
      swell: 33,
      turbulence: 20,
      waveScale: 0.6,
      lightAngle: 135,
      speed: 0.46,
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

  // Collect all unique 837 knowledge tags with direct valid targets
  const tagMap = new Map<
    string,
    { name: string; category: string; subject: string; moduleHref: string; posts: BlogPost[] }
  >();
  for (const post of studyPosts) {
    if (post.collection !== 'study_notes') continue;
    const moduleHref = getStudyModuleHref(post);
    for (const kt of getKnowledgeTags(post.id)) {
      let existing = tagMap.get(kt.name);
      if (!existing) {
        existing = {
          name: kt.name,
          category: kt.category,
          subject: post.data.subject,
          moduleHref,
          posts: [],
        };
        tagMap.set(kt.name, existing);
      }
      existing.posts.push(post);
    }
  }

  const allKnowledgeTags: KnowledgeQuickTag[] = [...tagMap.values()].map((item) => ({
    name: item.name,
    category: item.category,
    href:
      item.posts.length === 1
        ? getPostHref(item.posts[0])
        : `${item.moduleHref}?tag=${encodeURIComponent(item.name)}`,
    tooltip:
      item.posts.length === 1
        ? `直达《${getPostTitle(item.posts[0])}》`
        : `共 ${item.posts.length} 篇相关笔记（${studyModules[item.subject as keyof typeof studyModules]?.title ?? item.subject}）`,
  }));

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
    allKnowledgeTags,
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
