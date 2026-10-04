import { getCollection } from 'astro:content';

export async function getAllPosts() {
  const [readingNotes, examinationNotes] = await Promise.all([
    getCollection('blog_read'),
    getCollection('blog_huawei_examination'),
  ]);

  return [...readingNotes, ...examinationNotes].sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );
}
