import entries from './tools.json' with { type: 'json' };

// Edit tools.json to add links. Only name and url are required.
export interface Tool {
  name: string;
  url: string;
  description?: string;
  category?: string;
}

export function defineTools(entries: readonly Tool[]): Tool[] {
  const seen = new Set<string>();
  return entries.map((entry, index) => {
    const name = entry.name.trim();
    const url = entry.url.trim();
    if (!name) throw new Error(`tools.json 第 ${index + 1} 项缺少名称。`);
    let parsed: URL;
    try { parsed = new URL(url); }
    catch { throw new Error(`tools.json「${name}」需要完整的 http:// 或 https:// URL。`); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new Error(`tools.json「${name}」只支持不含账号密码的 HTTP / HTTPS 链接。`);
    }
    if (seen.has(parsed.href)) throw new Error(`tools.json「${name}」的 URL 重复。`);
    seen.add(parsed.href);
    const description = entry.description?.trim();
    const category = entry.category?.trim();
    return { name, url, ...(description ? { description } : {}), ...(category ? { category } : {}) };
  });
}

export const tools = defineTools(entries);

// Both category order and tool order follow their first occurrence in tools.json.
export function groupTools(entries: readonly Tool[]) {
  const groups = new Map<string, Tool[]>();
  for (const tool of entries) {
    const category = tool.category ?? '其他';
    const items = groups.get(category) ?? [];
    items.push(tool);
    groups.set(category, items);
  }
  return [...groups].map(([category, tools]) => ({ category, tools }));
}
