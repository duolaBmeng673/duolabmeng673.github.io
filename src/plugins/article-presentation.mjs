import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

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

// Explicitly reviewed local demos only; never embed arbitrary article URLs.
const patternRoot = '../content/837考研/网络安全基础考点笔记总结/5 典型模式匹配算法/';
const demos = {
  'kmp-algorithm': { file: 'a 单模式匹配算法/5.a.1 KMP算法/kmp_step_by_step.html', reference: 'kmp_steps_anim.svg', title: 'KMP 手动分步演算', height: 600 },
  'bm-algorithm': { file: 'a 单模式匹配算法/5.a.2 BM算法/bm-demo.html', reference: 'bm-demo.html', title: 'BM 算法逐步演示', height: 880 },
  'ac-algorithm': { file: 'b 多模式匹配算法/5.b.1 AC 算法/ac_demo.html', reference: 'ac_demo.html', title: 'AC 自动机初始化与匹配演示', height: 880 },
  'wm-algorithm': { file: 'b 多模式匹配算法/5.b.2 WM 算法/wm_simulator.html', reference: 'wm_simulator.html', title: 'Wu-Manber 多模式匹配交互模拟', height: 1900 },
};

function embeddedDocument(slug, demo) {
  const original = readFileSync(new URL(patternRoot + demo.file, import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles/global.css', import.meta.url), 'utf8');
  const light = css.match(/:root \{([\s\S]*?)\n\}/)[1];
  const dark = css.match(/:root\[data-theme="dark"\] \{([\s\S]*?)\n\}/)[1];
  const key = createHash('sha256').update(slug + original).digest('hex').slice(0, 24);
  let source = original;
  if (slug === 'kmp-algorithm') {
    source = source.replace(/<style>[\s\S]*?<\/style>/, `<style>
:root {${light}}
@media(prefers-color-scheme:dark) { :root:not([data-theme]) {${dark}} }
:root[data-theme="light"] {${light}}
:root[data-theme="dark"] {${dark}}
* { box-sizing:border-box; transition:none !important; }
body { margin:0; padding:16px; max-width:none; background:var(--surface); color:var(--text); font:14px/1.7 var(--sans); }
h1 { font-size:1.1rem; } .sub,.st { color:var(--text-muted); }
.diagram,.next-table { max-width:100%; overflow-x:auto; }
svg { display:block; min-width:740px; width:100%; height:auto; cursor:pointer; }
svg text { fill:var(--text); font:16px var(--mono); text-anchor:middle; dominant-baseline:central; }
.c { stroke:var(--border-strong); stroke-width:1.5; fill:var(--surface-raised); }
.m,.t { fill:var(--surface-soft); } .ok { fill:var(--accent-soft); stroke:var(--accent); stroke-width:2; }
.bad { fill:var(--surface-soft); stroke:var(--text); stroke-dasharray:4 2; stroke-width:2; }
.ix { fill:var(--text-muted); font-size:11px; } .lb,.p { font-weight:bold; } .p { fill:var(--accent); font-size:14px; }
.bar { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin:12px 0; }
button { min-height:40px; padding:5px 12px; border:1px solid var(--border-strong); border-radius:var(--radius-small); background:var(--surface-raised); color:var(--link); font:inherit; cursor:pointer; }
button:hover { background:var(--accent-soft); } button:disabled { color:var(--text-muted); cursor:default; }
:focus-visible { outline:2px solid var(--focus); outline-offset:2px; }
#msg { min-height:90px; padding:10px 12px; border-left:2px solid var(--accent); background:var(--accent-soft); }
table { border-collapse:collapse; margin-top:12px; font:14px var(--mono); } td { padding:6px 12px; border:1px solid var(--border); text-align:center; }
td.h { background:var(--accent-soft); font-weight:bold; } td.l { background:var(--surface-soft); }
</style>`)
      .replace('<svg id="sv"', '<div class="diagram"><svg role="img" aria-label="KMP 当前匹配状态" id="sv"')
      .replace('</svg>', '</svg></div>')
      .replace('<table id="tb"></table>', '<div class="next-table"><table aria-label="模式串的 next 数组" id="tb"></table></div>')
      .replace('<div id="msg">', '<div id="msg" role="status" aria-live="polite">')
      .replaceAll('stroke="#c01c28"', 'stroke="var(--accent)"')
      .replace("if(e.key=='ArrowRight')go(1);if(e.key=='ArrowLeft')go(-1)", "if(e.key=='ArrowRight'){e.preventDefault();go(1)}if(e.key=='ArrowLeft'){e.preventDefault();go(-1)}");
  } else {
    const themeStyle = `<style>
:root {${light}}
@media(prefers-color-scheme:dark) { :root:not([data-theme]) {${dark}} }
:root[data-theme="light"] {${light}}
:root[data-theme="dark"] {${dark}}
:root { --fg:var(--text); --mut:var(--text-muted); --mu:var(--text-muted); --bd:var(--border-strong); --card:var(--surface-soft); --ac:var(--accent); --acc:var(--warm); --node:var(--surface-soft); }
* { box-sizing:border-box; }
body { margin:0; padding:16px; max-width:none; background:var(--surface); color:var(--text); font-family:var(--sans); overflow-wrap:anywhere; }
h1 { font-size:1.2rem; }
.wrap { padding:0; } .card { background:var(--surface); border-color:var(--border); border-radius:var(--radius); }
input,select,button { max-width:100%; min-height:40px; background:var(--surface-raised); color:var(--text); border:1px solid var(--border-strong); border-radius:var(--radius-small); }
button { cursor:pointer; } button:hover { background:var(--row-hover); } button.p,button.pri { background:var(--accent); color:var(--button-text); }
input,select { min-width:0; } label { max-width:100%; } .ctl { align-items:start; }
#tbc,#tgs,#tb,#preT,#ptrT,.t3>div { max-width:100%; overflow-x:auto; }
#info,#msg,#d,.desc { color:var(--text); background:var(--surface-soft); }
.t3 h3 { color:var(--text-muted); } th { background:var(--surface-soft); color:var(--text); }
.tag { background:var(--surface-soft); color:var(--text); }
:focus-visible { outline:2px solid var(--focus); outline-offset:2px; }
@media(prefers-reduced-motion:reduce) { *,*::before,*::after { transition:none!important; animation:none!important; } }
</style>`;
    source = source.replace('</head>', themeStyle + '</head>');
  }
  const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'">`;
  const bridge = `<script>(() => {
const key = ${JSON.stringify(key)};
let queued=false,lastHeight=0;
const measure=()=>{ queued=false; const body=document.body; const height=Math.ceil(Math.max(body.scrollHeight,body.getBoundingClientRect().height)+4); if(height!==lastHeight){lastHeight=height;parent.postMessage({type:'blog-demo:size',key,height},'*')} };
const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(measure)}};
window.addEventListener('message',event=>{if(event.source!==parent||event.data?.type!=='blog-demo:theme'||event.data.key!==key)return;const theme=event.data.theme;if(theme!=='light'&&theme!=='dark')return;document.documentElement.dataset.theme=theme;schedule()});
new ResizeObserver(schedule).observe(document.body); new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,characterData:true});window.addEventListener('resize',schedule);
parent.postMessage({type:'blog-demo:ready',key},'*');schedule();
})();</script>`;
  const html = source.replace(/(<head[^>]*>)/i, '$1' + policy).replace('</body>', bridge + '</body>');
  return { html, key };
}

const isReference = (node, reference) => node.type === 'element'
  && ['img', 'a'].includes(node.tagName)
  && String(node.properties?.[node.tagName === 'img' ? 'src' : 'href'] ?? '').replace(/^\.\//, '') === reference;

export const articlePresentation = {
  name: 'article-display-only',
  element: {
    filter: ['h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'blockquote'],
    visit(node, context) {
      if (/^h[2-6]$/.test(node.tagName)) {
        if (context.textContent(node).includes('⭐')) context.setProperty(node, 'children', priority(node.children));
        return;
      }
      const slug = context.data.astro?.frontmatter.studySlug;
      const demo = demos[slug];
      if (!demo) return;
      const reference = node.children?.find((child) => isReference(child, demo.reference));
      if (!reference) return;
      const { html, key } = embeddedDocument(slug, demo);
      const frame = element('iframe', {
        className: ['article-interactive'], title: demo.title, sandbox: ['allow-scripts'],
        loading: 'lazy', height: demo.height, dataDemoKey: key, srcDoc: html,
      });
      const fallback = slug === 'kmp-algorithm' ? [element('details', { className: ['interactive-fallback'] }, [
        element('summary', {}, [text('查看原始动画（备用）')]), element('p', {}, [reference]),
      ])] : [];
      const embed = element('div', { className: ['article-demo'] }, [frame, ...fallback]);
      if (reference.tagName === 'img') context.replaceNode(node, embed);
      else context.setProperty(node, 'children', [...node.children.map((child) => child === reference
        ? element('span', {}, [text(demo.title)]) : child), embed]);
    },
  },
};
