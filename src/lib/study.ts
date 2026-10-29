import { getCollection, type CollectionEntry } from 'astro:content';

export type StudyPost = CollectionEntry<'study_notes'>;
export const studySeries = {
  'HIT 837': {
    slug: '837',
    title: '哈工大 837 网络与信息安全',
    description: '按照考试大纲整理的网络与信息安全复习笔记，记录核心概念、协议流程、易混知识点与典型问题。',
  },
} as const;

export const studyModules = {
  信息安全导论: { slug: 'information-security', title: '信息安全', description: '基本概念、病毒、防火墙、入侵检测、安全传输协议与风险管理。' },
  网络安全基础: { slug: 'network-security', title: '网络安全', description: '网络攻击、数据获取、扫描技术与模式匹配算法。' },
} as const;

// Keep all published information-security chapter URLs unchanged.
export function getChapterKey(post: StudyPost) {
  return post.data.subject === '信息安全导论'
    ? post.data.syllabusChapter
    : `${studyModules[post.data.subject].slug}-${post.data.syllabusChapter}`;
}

export function getStudySeries(series: string) {
  const info = studySeries[series as keyof typeof studySeries];
  if (!info) throw new Error(`Study series is not registered: ${series}`);
  return info;
}

export function getStudyHref(post: StudyPost) {
  return `/study-notes/${getStudySeries(post.data.series).slug}/${post.id}/`;
}

export function getChapterHref(post: StudyPost) {
  return `/study-notes/${getStudySeries(post.data.series).slug}/chapter/${getChapterKey(post)}/`;
}

export function getStudyModuleHref(post: StudyPost) {
  return `/study-notes/${getStudySeries(post.data.series).slug}/${studyModules[post.data.subject].slug}/`;
}

export function getStudyModuleSummaries(posts: StudyPost[]) {
  return Object.entries(studySeries).flatMap(([series, info]) =>
    Object.entries(studyModules).flatMap(([subject, module]) => {
      const notes = posts.filter((post) => post.data.series === series && post.data.subject === subject)
        .sort((a, b) => a.data.order - b.data.order);
      return notes.length ? [{ ...module, series, seriesTitle: info.title, subject, posts: notes, count: notes.length, href: getStudyModuleHref(notes[0]) }] : [];
    }),
  );
}

export type StudyModuleSummary = ReturnType<typeof getStudyModuleSummaries>[number];

export async function getPublicStudyNotes() {
  const posts = await getCollection('study_notes', ({ data }) => data.published && !data.draft && !data.publicationHoldReason);
  const routes = new Set<string>();
  const orders = new Set<string>();
  for (const post of posts) {
    if (Object.values(studyModules).some((module) => module.slug === post.id)) throw new Error(`Study slug reserved for module: ${post.id}`);
    const route = getStudyHref(post);
    const order = `${post.data.series}:${post.data.subject}:${post.data.order}`;
    if (routes.has(route) || orders.has(order)) throw new Error(`Duplicate study route/order: ${post.id}`);
    routes.add(route); orders.add(order);
  }
  return posts.sort((a, b) => Object.keys(studyModules).indexOf(a.data.subject) - Object.keys(studyModules).indexOf(b.data.subject) || a.data.order - b.data.order);
}

export function getStudyChapters(posts: StudyPost[]) {
  const chapters = new Map<string, { key: string; subject: StudyPost['data']['subject']; code: string; title: string; posts: StudyPost[] }>();
  for (const post of [...posts].sort((a, b) => a.data.order - b.data.order)) {
    const code = post.data.syllabusChapter;
    const key = getChapterKey(post);
    const existing = chapters.get(key);
    if (existing && existing.title !== post.data.chapterTitle) throw new Error(`Conflicting chapter title: ${code}`);
    if (!existing) chapters.set(key, { key, subject: post.data.subject, code, title: post.data.chapterTitle, posts: [] });
    chapters.get(key)!.posts.push(post);
  }
  return [...chapters.values()].sort((a, b) => Object.keys(studyModules).indexOf(a.subject) - Object.keys(studyModules).indexOf(b.subject) || Number(a.code) - Number(b.code));
}
