import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import katex from 'katex';

function renderMath(node, context, displayMode) {
  context.replaceNode(node, {
    type: 'html',
    value: katex.renderToString(node.value, {
      displayMode,
      output: 'htmlAndMathml',
      strict: 'ignore',
      trust: false,
      throwOnError: true,
    }),
  });
}

export default defineConfig({
  site: 'https://duolabmeng673.github.io',
  markdown: {
    processor: satteri({
      features: { math: true },
      mdastPlugins: [{
        name: 'katex-formulas',
        math: (node, context) => renderMath(node, context, true),
        inlineMath: (node, context) => renderMath(node, context, false),
      }],
    }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
});
