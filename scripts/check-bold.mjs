import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);
const SKIP_TAGS = new Set(['script', 'style', 'pre', 'code', 'math', 'svg', 'textarea', 'title']);
const TOKEN_RE = /<!--[\s\S]*?-->|<\/?([a-zA-Z0-9-]+)([^>]*?)>|([^<]+)/g;
const LITERAL_MARK_RE = /\*\*|__/;

function walkHtmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkHtmlFiles(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out.sort();
}

export function findResidualBoldInHtml(html, file = '<html-input>') {
  const hits = [];
  const skipStack = [];
  let line = 1;

  for (const match of html.matchAll(TOKEN_RE)) {
    const raw = match[0];
    if (match[3] !== undefined) {
      if (skipStack.length === 0 && LITERAL_MARK_RE.test(match[3])) {
        const subLines = match[3].split('\n');
        subLines.forEach((segment, offset) => {
          if (LITERAL_MARK_RE.test(segment)) {
            hits.push({
              file,
              line: line + offset,
              context: segment.trim().replace(/\s+/g, ' ').slice(0, 140),
            });
          }
        });
      }
    } else if (match[1]) {
      const tag = match[1].toLowerCase();
      const isClose = raw.startsWith('</');
      const isSelfClose = raw.endsWith('/>') || VOID_TAGS.has(tag);
      if (isClose) {
        for (let i = skipStack.length - 1; i >= 0; i--) {
          if (skipStack[i] === tag) {
            skipStack.splice(i);
            break;
          }
        }
      } else if (!isSelfClose) {
        const attrs = match[2] ?? '';
        const isSkip = SKIP_TAGS.has(tag) || /\bclass\s*=\s*["'][^"']*\bkatex(?:-[a-z-]+)?\b/i.test(attrs);
        if (isSkip || skipStack.length > 0) {
          skipStack.push(tag);
        }
      }
    }
    const newlines = raw.match(/\n/g);
    if (newlines) line += newlines.length;
  }

  return hits;
}

export function scanBuiltBoldIssues(distDir = 'dist') {
  const hits = [];
  for (const file of walkHtmlFiles(distDir)) {
    hits.push(...findResidualBoldInHtml(readFileSync(file, 'utf8'), file));
  }
  return hits;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const distDir = process.argv[2] ?? 'dist';
  const hits = scanBuiltBoldIssues(distDir);
  for (const hit of hits) {
    console.log(`${hit.file}:${hit.line} | ${hit.context}`);
  }
  console.log(`Total residual ** / __ hits: ${hits.length}`);
  if (hits.length > 0) process.exitCode = 1;
}
