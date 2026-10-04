import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const schema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  tags: z.array(z.string()),
});

const blogRead = defineCollection({
  loader: glob({ base: './src/content/blog_read', pattern: '*.{md,mdx}' }),
  schema,
});

const blogHuaweiExamination = defineCollection({
  loader: glob({ base: './src/content/blog_huawei_examination', pattern: '*.{md,mdx}' }),
  schema,
});

export const collections = {
  blog_read: blogRead,
  blog_huawei_examination: blogHuaweiExamination,
};
