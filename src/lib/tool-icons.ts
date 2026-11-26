import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Tool } from '../data/tools';

function resolveLucideIconsDir(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkgDir = dirname(require.resolve('lucide-static/package.json'));
    const iconsDir = join(pkgDir, 'icons');
    if (existsSync(iconsDir)) return iconsDir;
  } catch {
    // Fallback below if module resolution runs from an unrooted bundle.
  }

  const fromRelative = fileURLToPath(
    new URL('../../node_modules/lucide-static/icons', import.meta.url),
  );
  if (existsSync(fromRelative)) return fromRelative;

  return join(process.cwd(), 'node_modules', 'lucide-static', 'icons');
}

export const LUCIDE_ICONS_DIR = resolveLucideIconsDir();

export const CATEGORY_FALLBACK_ICONS: Record<string, string> = {
  壁纸: 'image',
  文档: 'file-text',
  下载: 'download',
  前端组件: 'component',
  'AI 工具': 'bot',
  学习与社区: 'book-open',
  开发工具: 'wrench',
  'Google 组件': 'puzzle',
};

export const DEFAULT_TOOL_ICON = 'external-link';

const ICON_NAME_PATTERN = /^[a-z0-9-]+$/;
const svgCache = new Map<string, string>();

/** Check whether an icon identifier uses a valid Lucide kebab-case filename. */
export function isValidIconName(name: string): boolean {
  return ICON_NAME_PATTERN.test(name.trim());
}

/** Resolve a tool's Lucide icon name with per-tool priority and category fallback. */
export function resolveToolIconName(tool: Pick<Tool, 'icon' | 'category'>): string {
  const custom = tool.icon?.trim();
  if (custom) return custom;
  const category = tool.category?.trim();
  if (category && category in CATEGORY_FALLBACK_ICONS) {
    return CATEGORY_FALLBACK_ICONS[category];
  }
  return DEFAULT_TOOL_ICON;
}

/** Check whether the named icon SVG exists in node_modules/lucide-static/icons. */
export function hasLucideIcon(name: string): boolean {
  const normalized = name.trim();
  if (!isValidIconName(normalized)) return false;
  return existsSync(join(LUCIDE_ICONS_DIR, `${normalized}.svg`));
}

function normalizeRootSvgAttributes(attrsText: string): string {
  const cleaned = attrsText
    .replace(/\s*\b(?:width|height|stroke|stroke-width|aria-hidden)\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
    .replace(/\s*\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/gi, (_match: string, dbl: string | undefined, sgl: string | undefined) => {
      const tokens = (dbl ?? sgl ?? '')
        .split(/\s+/)
        .filter((token) => token && token !== 'preview-icon');
      return tokens.length ? ` class="${tokens.join(' ')}"` : '';
    })
    .replace(/\s+/g, ' ')
    .trim();

  const extraAttrs = 'width="20" height="20" stroke="currentColor" stroke-width="2" aria-hidden="true"';
  return cleaned ? `${cleaned} ${extraAttrs}` : extraAttrs;
}

/** Load and normalize an inline Lucide SVG at build time. */
export function loadLucideSvg(name: string): string {
  const normalized = name.trim();
  if (!isValidIconName(normalized)) {
    throw new Error(`非法的 Lucide 图标名：「${name}」`);
  }
  const cached = svgCache.get(normalized);
  if (cached) return cached;

  const iconPath = join(LUCIDE_ICONS_DIR, `${normalized}.svg`);
  if (!existsSync(iconPath)) {
    throw new Error(`未在 lucide-static 找到图标文件：${normalized}.svg`);
  }

  const raw = readFileSync(iconPath, 'utf8')
    .replace(/^(?:\s*<!--[\s\S]*?-->\s*)+/, '')
    .trim();

  const normalizedSvg = raw.replace(/<svg\b([^>]*)>/i, (_full: string, attrs: string) => {
    return `<svg ${normalizeRootSvgAttributes(attrs)}>`;
  });

  if (!normalizedSvg.startsWith('<svg')) {
    throw new Error(`Lucide 图标文件格式异常：${normalized}.svg`);
  }

  svgCache.set(normalized, normalizedSvg);
  return normalizedSvg;
}

/** Resolve and load a tool card's inline Lucide SVG markup. */
export function renderToolIcon(tool: Pick<Tool, 'icon' | 'category'>): string {
  return loadLucideSvg(resolveToolIconName(tool));
}
