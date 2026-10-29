import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import katex from 'katex';
import { articleHeadings } from './src/plugins/article-headings.mjs';
import { articlePresentation } from './src/plugins/article-presentation.mjs';
import { createCssVariablesTheme } from '@shikijs/core';

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
      mdastPlugins: [articleHeadings, {
        name: 'katex-formulas',
        math: (node, context) => renderMath(node, context, true),
        inlineMath: (node, context) => renderMath(node, context, false),
      }],
      hastPlugins: [articlePresentation],
    }),
    shikiConfig: {
      theme: createCssVariablesTheme({ name: 'notebook', variablePrefix: '--syntax-' }),
    },
  },
});
