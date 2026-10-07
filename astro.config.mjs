import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://duolabmeng673.github.io',
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
});
