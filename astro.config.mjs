import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { satteri } from '@astrojs/markdown-satteri';
import katex from 'katex';
import { articleHeadings } from './src/plugins/article-headings.mjs';
import { articlePresentation, articleSvgHtml } from './src/plugins/article-presentation.mjs';
import { articleInlineSvg } from './src/plugins/article-inline-svg.mjs';
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
  integrations: [react()],
  markdown: {
    processor: satteri({
      features: { math: true },
      mdastPlugins: [articleHeadings, articleInlineSvg, articleSvgHtml, {
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
