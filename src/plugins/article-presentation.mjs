import { readFileSync } from 'node:fs';

const element = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });
const text = (value) => ({ type: 'text', value });
const priority = (children) => children.flatMap((child) => {
  if (child.type === 'text' && child.value.includes('⭐')) {
    return child.value.split('⭐').flatMap((part, index) => [
      ...(index ? [element('span', { className: ['priority-badge'], role: 'img', ariaLabel: '重点' }, [text('⭐')])] : []),
      text(part),
    ]);
  }
  return [{ ...child, ...(child.children ? { children: priority(child.children) } : {}) }];
});

// Build a derived, isolated presentation. Uploaded HTML and SVG files stay unchanged.
function kmpDocument() {
  const source = readFileSync(new URL('../content/837考研/网络安全基础考点笔记总结/5 典型模式匹配算法/a 单模式匹配算法/kmp_step_by_step.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles/global.css', import.meta.url), 'utf8');
  const light = css.match(/:root \{([\s\S]*?)\n\}/)[1];
  const dark = css.match(/:root\[data-theme="dark"\] \{([\s\S]*?)\n\}/)[1];
  const style = `:root {${light}}
@media (prefers-color-scheme: dark) { :root {${dark}} }
* { box-sizing: border-box; transition: none !important; }
body { margin: 0; padding: 16px; background: var(--surface); color: var(--text); font: 14px/1.7 var(--sans); }
h1 { margin: 0 0 6px; font-size: 16px; } .sub, .st { color: var(--text-muted); }
.diagram, .next-table { max-width: 100%; overflow-x: auto; }
svg { display: block; min-width: 740px; width: 100%; height: auto; cursor: pointer; }
svg text { fill: var(--text); font: 16px var(--mono); text-anchor: middle; dominant-baseline: central; }
.c { stroke: var(--border-strong); stroke-width: 1.5; fill: var(--surface-raised); }
.m, .t { fill: var(--surface-soft); } .ok { fill: var(--accent-soft); stroke: var(--accent); stroke-width: 2; }
.bad { fill: var(--surface-soft); stroke: var(--text); stroke-dasharray: 4 2; stroke-width: 2; }
.ix { fill: var(--text-muted); font-size: 11px; } .lb, .p { font-weight: bold; }
.p { fill: var(--accent); font-size: 14px; }
.bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 12px 0; }
button { min-height: 40px; padding: 5px 12px; border: 1px solid var(--border-strong); border-radius: var(--radius-small); background: var(--surface-raised); color: var(--link); font: inherit; cursor: pointer; }
button:hover { background: var(--accent-soft); } button:disabled { color: var(--text-muted); cursor: default; }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
#msg { min-height: 90px; padding: 10px 12px; border-left: 2px solid var(--accent); background: var(--accent-soft); }
table { border-collapse: collapse; margin-top: 12px; font: 14px var(--mono); }
td { padding: 6px 12px; border: 1px solid var(--border); text-align: center; }
td.h { background: var(--accent-soft); font-weight: bold; } td.l { background: var(--surface-soft); }`;
  return source.replace(/<style>[\s\S]*?<\/style>/, `<style>${style}</style>`)
    .replace('<svg id="sv"', '<div class="diagram"><svg role="img" aria-label="KMP 当前匹配状态" id="sv"')
    .replace('</svg>', '</svg></div>')
    .replace('<table id="tb"></table>', '<div class="next-table"><table aria-label="模式串的 next 数组" id="tb"></table></div>')
    .replace('<div id="msg">', '<div id="msg" role="status" aria-live="polite">')
    .replaceAll('stroke="#c01c28"', 'stroke="var(--accent)"')
    .replace("if(e.key=='ArrowRight')go(1);if(e.key=='ArrowLeft')go(-1)", "if(e.key=='ArrowRight'){e.preventDefault();go(1)}if(e.key=='ArrowLeft'){e.preventDefault();go(-1)}");
}

export const articlePresentation = {
  name: 'article-display-only',
  element: {
    filter: ['h2', 'h3', 'h4', 'h5', 'h6', 'p'],
    visit(node, context) {
      if (node.tagName !== 'p') {
        // Keep textContent (including the original star), heading IDs and question metadata intact.
        if (context.textContent(node).includes('⭐')) context.setProperty(node, 'children', priority(node.children));
        return;
      }
      if (context.data.astro?.frontmatter.studySlug !== 'kmp-algorithm') return;
      const image = node.children?.length === 1 ? node.children[0] : undefined;
      if (image?.type !== 'element' || image.tagName !== 'img' || image.properties?.src !== './kmp_steps_anim.svg') return;
      context.replaceNode(node, element('div', { className: ['kmp-demo'] }, [
        element('iframe', { className: ['kmp-interactive'], title: 'KMP 手动分步演算', sandbox: ['allow-scripts'], loading: 'lazy', srcDoc: kmpDocument() }),
        element('details', { className: ['kmp-fallback'] }, [
          element('summary', {}, [text('查看原始动画（备用）')]),
          element('p', {}, [image]),
        ]),
      ]));
    },
  },
};
