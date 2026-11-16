import { activities } from '../data/activities';
import { siteConfig } from '../config';
import { createActivityCalendar, localDateKey, type ActivityRecord } from './activity';
import { getAllPosts, getPostHref, getPostTitle, taxonomyLabel, type BlogPost } from './blog';
import { getKnowledgeTags } from './knowledge-tags';
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

export interface SwapCardItem {
  cat: string;
  title: string;
  desc: string;
  href: string;
  accent: string;
  icon: 'book' | 'sparkles' | 'cpu' | 'sigma' | 'code';
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

  const presets: StagePreset[] = [
    {
      slug: 'all',
      name: '全部笔记',
      presetName: 'Ocean',
      count: posts.length,
      moreHref: '/blog/',
      moreLabel: '查看全部笔记 ↗',
      horizonColor: '#2563EB',
      waveColor: '#38BDF8',
      crestColor: '#E0F2FE',
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
      presetName: 'Dusk',
      count: researchPosts.length,
      moreHref: '/blog/?category=Research',
      moreLabel: '查看全部论文笔记 ↗',
      horizonColor: '#5227FF',
      waveColor: '#C084FC',
      crestColor: '#F3E8FF',
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
      presetName: 'Dune',
      count: csPosts.length,
      moreHref: '/blog/?category=Computer+Science',
      moreLabel: '查看全部技术笔记 ↗',
      horizonColor: '#C2416B',
      waveColor: '#FB7185',
      crestColor: '#FFE4E6',
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
      presetName: 'Aurora',
      count: studyPosts.length,
      moreHref: '/study-notes/837/',
      moreLabel: '查看全部学习笔记 ↗',
      horizonColor: '#0D9488',
      waveColor: '#34D399',
      crestColor: '#D1FAE5',
      amplitude: 2.5,
      swell: 33,
      turbulence: 20,
      waveScale: 0.6,
      lightAngle: 135,
      speed: 0.46,
      notes: studyPosts.slice(0, 6).map(toPresetNote),
    },
  ];

  // Build activity items from real posts + confirmed feature activities
  const writingRecords: ActivityRecord[] = posts.map((post) => ({
    date: post.data.pubDate.toISOString().slice(0, 10),
    type: 'writing',
    count: 1,
    description: post.data.title,
  }));

  const heatmapWritingItems: HeatmapItemPayload[] = posts.map((post) => ({
    date: post.data.pubDate.toISOString().slice(0, 10),
    type: 'writing',
    label: taxonomyLabel(post.data.category),
    count: 1,
    description: getPostTitle(post),
  }));

  const heatmapActivityItems: HeatmapItemPayload[] = activities.map((act) => ({
    date: act.date,
    type: act.type,
    label: act.type === 'site' ? '博客功能' : taxonomyLabel(act.type),
    count: act.count,
    description: act.description ?? '',
  }));

  const today = new Date();
  const buildDate = localDateKey(today);
  const calendar = createActivityCalendar([...activities, ...writingRecords], today);

  // Recent real records for static no-JS / pre-hydration fallback & initial active day
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

  // Curated CardSwap portal cards backed by real routes
  const swapCandidates: Array<{
    id: string;
    cat: string;
    fallbackTitle: string;
    desc: string;
    accent: string;
    icon: SwapCardItem['icon'];
  }> = [
    {
      id: 'llm-table-processing-survey',
      cat: '论文',
      fallbackTitle: 'Table Survey',
      desc: '大模型表格理解综述',
      accent: '#7aa2ff',
      icon: 'book',
    },
    {
      id: 'clip',
      cat: '论文',
      fallbackTitle: 'CLIP 精读',
      desc: '图文对比预训练核心机制',
      accent: '#a78bfa',
      icon: 'sparkles',
    },
    {
      id: 'kmp-algorithm',
      cat: '837 算法',
      fallbackTitle: 'KMP 交互演示',
      desc: 'next 数组与无回溯步进',
      accent: '#5fd6b8',
      icon: 'cpu',
    },
    {
      id: 'naive-bayes-classification',
      cat: '837 算法',
      fallbackTitle: '朴素贝叶斯',
      desc: '条件独立与 m 估计平滑',
      accent: '#ff8aa8',
      icon: 'sigma',
    },
    {
      id: 'acm_io',
      cat: '技术',
      fallbackTitle: 'Python ACM/OJ',
      desc: '算法竞赛快读与模板实践',
      accent: '#e6b450',
      icon: 'code',
    },
  ];

  const swapCards: SwapCardItem[] = swapCandidates
    .map((spec) => {
      const found = posts.find((post) => post.id === spec.id);
      if (!found) return null;
      return {
        cat: spec.cat,
        title: spec.fallbackTitle,
        desc: spec.desc,
        href: getPostHref(found),
        accent: spec.accent,
        icon: spec.icon,
      };
    })
    .filter((item): item is SwapCardItem => item !== null);

  return {
    site: siteConfig,
    totalCount: posts.length,
    presets,
    recentPosts: posts.slice(0, 6).map((post) => ({
      href: getPostHref(post),
      category: post.data.category,
      categoryLabel: taxonomyLabel(post.data.category),
      date: post.data.pubDate.toISOString().slice(0, 10),
      title: getPostTitle(post),
      description: post.data.description,
    })),
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
      },
    },
    allKnowledgeTags,
    swapCards,
    heatmap: {
      buildDate,
      activeDays: calendar.activityDays,
      totalActivities: calendar.totalActivities,
      latestActiveDate,
      latestActiveEntries,
      recentActivityPreview,
      writingItems: heatmapWritingItems,
      activityItems: heatmapActivityItems,
      rawWritingRecords: writingRecords,
      rawActivities: activities,
    },
  };
}
