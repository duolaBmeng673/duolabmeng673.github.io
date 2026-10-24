import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const category = z.enum(['Research', 'Computer Science']);
const subcategory = z.enum(['Paper Notes', 'Algorithms']);
const series = z.enum(['NLP', 'Multimodal', 'Computer Vision', 'LLM & Tables', 'ACM / OJ']);

const schema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  tags: z.array(z.string()),
  category,
  subcategory,
  series,
  shortTitle: z.string().trim().min(1).optional(),
  subtitle: z.string().trim().min(1).optional(),
});

const blogRead = defineCollection({
  loader: glob({ base: './src/content/blog_read', pattern: '*.{md,mdx}' }),
  schema,
});

const blogHuaweiExamination = defineCollection({
  loader: glob({ base: './src/content/blog_huawei_examination', pattern: '*.{md,mdx}' }),
  schema,
});

const studyNotes = defineCollection({
  loader: glob({
    base: './src/content/837考研',
    pattern: '**/*.md',
    generateId: ({ data, entry }) => typeof data.studySlug === 'string' ? data.studySlug : entry.replace(/\.md$/, ''),
  }),
  schema: schema.omit({ category: true, subcategory: true, series: true }).extend({
    category: z.literal('Study Notes'),
    subcategory: z.literal('考研复习'),
    series: z.enum(['HIT 837']),
    subject: z.string().trim().min(1),
    studySlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    syllabusChapter: z.string().regex(/^\d{2}$/),
    chapterTitle: z.string().trim().min(1),
    syllabusSection: z.string().trim().min(1).optional(),
    order: z.number().int().nonnegative(),
    published: z.boolean().default(false),
    questions: z.array(z.object({
      id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      heading: z.string().trim().min(1),
    })).default([]).superRefine((questions, context) => {
      for (const key of ['id', 'heading'] as const) {
        if (new Set(questions.map((question) => question[key])).size !== questions.length) {
          context.addIssue({ code: 'custom', message: `Duplicate question ${key}` });
        }
      }
    }),
  }),
});

export const collections = {
  blog_read: blogRead,
  blog_huawei_examination: blogHuaweiExamination,
  study_notes: studyNotes,
};
