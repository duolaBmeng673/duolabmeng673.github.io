import { getCollection, type CollectionEntry } from 'astro:content';

export type StudyPost = CollectionEntry<'study_notes'>;
export const studySeries = {
  'HIT 837': {
    slug: '837',
    title: '哈工大 837 网络与信息安全',
    description: '按照考试大纲整理的网络与信息安全复习笔记，记录核心概念、协议流程、易混知识点与典型问题。',
  },
} as const;

export function getStudySeries(series: string) {
  const info = studySeries[series as keyof typeof studySeries];
  if (!info) throw new Error(`Study series is not registered: ${series}`);
  return info;
}

export function getStudyHref(post: StudyPost) {
  return `/study-notes/${getStudySeries(post.data.series).slug}/${post.id}/`;
}

export function getChapterHref(post: StudyPost) {
  return `/study-notes/${getStudySeries(post.data.series).slug}/chapter/${post.data.syllabusChapter}/`;
}

export async function getPublicStudyNotes() {
  const posts = await getCollection('study_notes', ({ data }) => data.published);
  const routes = new Set<string>();
  const orders = new Set<string>();
  for (const post of posts) {
    const route = getStudyHref(post);
    const order = `${post.data.series}:${post.data.order}`;
    if (routes.has(route) || orders.has(order)) throw new Error(`Duplicate study route/order: ${post.id}`);
    routes.add(route); orders.add(order);
  }
  return posts.sort((a, b) => a.data.order - b.data.order);
}

export function getStudyChapters(posts: StudyPost[]) {
  const chapters = new Map<string, { code: string; title: string; posts: StudyPost[] }>();
  for (const post of [...posts].sort((a, b) => a.data.order - b.data.order)) {
    const code = post.data.syllabusChapter;
    const existing = chapters.get(code);
    if (existing && existing.title !== post.data.chapterTitle) throw new Error(`Conflicting chapter title: ${code}`);
    if (!existing) chapters.set(code, { code, title: post.data.chapterTitle, posts: [] });
    chapters.get(code)!.posts.push(post);
  }
  return [...chapters.values()].sort((a, b) => Number(a.code) - Number(b.code));
}
