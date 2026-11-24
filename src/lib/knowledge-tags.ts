import dictionary from '../data/tags.json' with { type: 'json' };
import entries from '../data/knowledge-entries.json' with { type: 'json' };
import blogDictionary from '../data/blog-tags.json' with { type: 'json' };
import blogEntries from '../data/blog-knowledge-entries.json' with { type: 'json' };

export const knowledgeCategories = {
  concept: '概念 / 原理', algorithm: '算法 / 体制', protocol: '协议 / 流程',
  model: '模型 / 策略', struct: '结构 / 组件', threat: '威胁 / 攻击', defense: '防护 / 检测',
} as const;
export type KnowledgeCategory = keyof typeof knowledgeCategories;
export type KnowledgeTagItem = { name: string; category: KnowledgeCategory };
type KnowledgeEntry = { section: string; knowledgeTags: readonly string[] };
type BlogKnowledgeEntry = { collection: string; knowledgeTags: readonly string[] };

function validateDictionaryEntries<T extends { knowledgeTags: readonly string[] }>(
  items: Record<string, T>,
  tags: Record<string, string>,
  labelFile: string,
  warn = console.warn,
) {
  const invalid = Object.entries(tags).filter(([, category]) => !Object.hasOwn(knowledgeCategories, category));
  if (invalid.length) throw new Error(`${labelFile} 类别无效：${invalid.map(([name, category]) => `${name}: ${category}`).join('、')}`);
  const used = new Set(Object.values(items).flatMap((entry) => [...entry.knowledgeTags]));
  const missing = [...used].filter((name) => !Object.hasOwn(tags, name));
  if (missing.length) throw new Error(`${labelFile} 缺少知识点标签：${missing.join('、')}`);
  const unused = Object.keys(tags).filter((name) => !used.has(name));
  if (unused.length) warn(`${labelFile} 未使用的知识点标签：${unused.join('、')}`);
}

// Validate the complete curated data set, not just the labels on one page.
export function validateKnowledgeTags(
  items: Record<string, KnowledgeEntry>, tags: Record<string, string>, warn = console.warn,
) {
  validateDictionaryEntries(items, tags, 'tags.json', warn);
}

export function validateBlogKnowledgeTags(
  items: Record<string, BlogKnowledgeEntry>,
  tags: Record<string, string>,
  studyTags: Record<string, string> = dictionary,
  warn = console.warn,
) {
  validateDictionaryEntries(items, tags, 'blog-tags.json', warn);
  for (const [name, category] of Object.entries(tags)) {
    if (Object.hasOwn(studyTags, name) && studyTags[name] !== category) {
      throw new Error(`blog-tags.json 与 tags.json 类别不一致：${name} (${category} != ${studyTags[name]})`);
    }
  }
}

validateKnowledgeTags(entries, dictionary);
validateBlogKnowledgeTags(blogEntries, blogDictionary);
const knowledgeEntries: Record<string, KnowledgeEntry> = entries;
const tagDictionary = dictionary as Record<string, KnowledgeCategory>;
const blogKnowledgeEntries: Record<string, BlogKnowledgeEntry> = blogEntries;
const blogTagDictionary = blogDictionary as Record<string, KnowledgeCategory>;

export function getKnowledgeTags(id: string): KnowledgeTagItem[] {
  return (knowledgeEntries[id]?.knowledgeTags ?? []).map((name) => ({ name, category: tagDictionary[name] }));
}

export function getBlogKnowledgeTags(id: string): KnowledgeTagItem[] {
  return (blogKnowledgeEntries[id]?.knowledgeTags ?? []).map((name) => ({ name, category: blogTagDictionary[name] }));
}

export function countKnowledgeCategories(
  ids: readonly string[],
  getTags: (id: string) => readonly KnowledgeTagItem[],
) {
  const categoryTagSets = new Map<KnowledgeCategory, Set<string>>();
  for (const id of ids) {
    for (const kt of getTags(id)) {
      let set = categoryTagSets.get(kt.category);
      if (!set) {
        set = new Set<string>();
        categoryTagSets.set(kt.category, set);
      }
      set.add(kt.name);
    }
  }
  return Object.entries(knowledgeCategories).map(([id, label]) => ({
    id: id as KnowledgeCategory,
    label,
    count: categoryTagSets.get(id as KnowledgeCategory)?.size ?? 0,
  }));
}

export function validateKnowledgePosts(posts: readonly { id: string; data: { syllabusSection?: string; syllabusChapter?: string } }[]) {
  for (const [id, entry] of Object.entries(knowledgeEntries)) {
    const post = posts.find((post) => post.id === id);
    if (!post || (post.data.syllabusSection ?? post.data.syllabusChapter) !== entry.section) throw new Error(`知识点条目未匹配原文章 / 考纲编号：${id} (${entry.section})`);
  }
}

export function validateBlogKnowledgePosts(posts: readonly { id: string; collection: string }[]) {
  for (const [id, entry] of Object.entries(blogKnowledgeEntries)) {
    const post = posts.find((item) => item.id === id && item.collection === entry.collection);
    if (!post) throw new Error(`技术笔记知识点条目未匹配原文章：${entry.collection}:${id}`);
  }
  for (const post of posts) {
    if ((post.collection === 'blog_read' || post.collection === 'blog_coding_practice') && !Object.hasOwn(blogKnowledgeEntries, post.id)) {
      throw new Error(`公开技术笔记缺少知识点条目：${post.collection}:${post.id}`);
    }
  }
}

