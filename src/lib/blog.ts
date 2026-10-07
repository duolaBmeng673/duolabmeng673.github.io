import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

export type BlogPost = CollectionEntry<'blog_read'> | CollectionEntry<'blog_huawei_examination'>;

export const categories = ['Research', 'Computer Science'] as const;

export function getPostTitle(post: BlogPost) {
  return post.data.shortTitle ?? post.data.title;
}

export function getPostHref(post: BlogPost) {
  return `/blog/${post.id}/`;
}

export function formatPostDate(date: Date) {
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' });
}

export function getReadingTime(post: BlogPost) {
  const body = typeof post.body === 'string' ? post.body : '';
  const characters = body.replace(/\s+/g, '').length;
  return Math.max(1, Math.ceil(characters / 500));
}

export function getCategorySummaries(posts: BlogPost[]) {
  return categories
    .map((category) => {
      const categoryPosts = posts.filter((post) => post.data.category === category);
      const subcategories = [...new Set(categoryPosts.map((post) => post.data.subcategory))];
      const series = [...new Set(categoryPosts.map((post) => post.data.series))];
      return { category, count: categoryPosts.length, subcategories, series };
    })
    .filter((summary) => summary.count > 0);
}

export function getTimeline(posts: BlogPost[]) {
  const years = new Map<number, Map<number, BlogPost[]>>();
  for (const post of posts) {
    const year = post.data.pubDate.getUTCFullYear();
    const month = post.data.pubDate.getUTCMonth();
    if (!years.has(year)) years.set(year, new Map());
    const months = years.get(year)!;
    if (!months.has(month)) months.set(month, []);
    months.get(month)!.push(post);
  }

  return [...years.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, months]) => ({
      year,
      months: [...months.entries()]
        .sort(([a], [b]) => b - a)
        .map(([month, monthPosts]) => ({
          month,
          label: new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long' }),
          posts: monthPosts,
        })),
    }));
}

export function toSearchRecord(post: BlogPost) {
  const fields = [
    post.data.title,
    post.data.shortTitle,
    post.data.subtitle,
    post.data.description,
    post.data.category,
    post.data.subcategory,
    post.data.series,
    ...post.data.tags,
  ].filter(Boolean);

  return {
    title: post.data.title,
    shortTitle: post.data.shortTitle ?? null,
    subtitle: post.data.subtitle ?? null,
    description: post.data.description,
    category: post.data.category,
    subcategory: post.data.subcategory,
    series: post.data.series,
    tags: post.data.tags,
    date: post.data.pubDate.toISOString().slice(0, 10),
    href: getPostHref(post),
    searchText: fields.join(' ').toLocaleLowerCase(),
  };
}

export async function getAllPosts(): Promise<BlogPost[]> {
  const [readingNotes, examinationNotes] = await Promise.all([
    getCollection('blog_read'),
    getCollection('blog_huawei_examination'),
  ]);

  return [...readingNotes, ...examinationNotes].sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );
}
