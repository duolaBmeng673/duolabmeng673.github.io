import dictionary from '../data/tags.json' with { type: 'json' };
import entries from '../data/knowledge-entries.json' with { type: 'json' };

export const knowledgeCategories = {
  concept: '概念 / 原理', algorithm: '算法 / 体制', protocol: '协议 / 流程',
  model: '模型 / 策略', struct: '结构 / 组件', threat: '威胁 / 攻击', defense: '防护 / 检测',
} as const;
export type KnowledgeCategory = keyof typeof knowledgeCategories;
type KnowledgeEntry = { section: string; knowledgeTags: readonly string[] };

// Validate the complete curated data set, not just the labels on one page.
export function validateKnowledgeTags(
  items: Record<string, KnowledgeEntry>, tags: Record<string, string>, warn = console.warn,
) {
  const invalid = Object.entries(tags).filter(([, category]) => !Object.hasOwn(knowledgeCategories, category));
  if (invalid.length) throw new Error(`tags.json 类别无效：${invalid.map(([name, category]) => `${name}: ${category}`).join('、')}`);
  const used = new Set(Object.values(items).flatMap((entry) => [...entry.knowledgeTags]));
  const missing = [...used].filter((name) => !Object.hasOwn(tags, name));
  if (missing.length) throw new Error(`tags.json 缺少知识点标签：${missing.join('、')}`);
  const unused = Object.keys(tags).filter((name) => !used.has(name));
  if (unused.length) warn(`tags.json 未使用的知识点标签：${unused.join('、')}`);
}

validateKnowledgeTags(entries, dictionary);
const knowledgeEntries: Record<string, KnowledgeEntry> = entries;
const tagDictionary = dictionary as Record<string, KnowledgeCategory>;

export function getKnowledgeTags(id: string) {
  return (knowledgeEntries[id]?.knowledgeTags ?? []).map((name) => ({ name, category: tagDictionary[name] }));
}

export function validateKnowledgePosts(posts: readonly { id: string; data: { syllabusSection?: string; syllabusChapter?: string } }[]) {
  for (const [id, entry] of Object.entries(knowledgeEntries)) {
    const post = posts.find((post) => post.id === id);
    if (!post || (post.data.syllabusSection ?? post.data.syllabusChapter) !== entry.section) throw new Error(`知识点条目未匹配原文章 / 考纲编号：${id} (${entry.section})`);
  }
}

