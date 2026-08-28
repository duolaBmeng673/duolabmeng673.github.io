# Technical Handoff: duolabmeng673.github.io

This document is for the next Codex agent or engineer taking over the project.

## Project Summary

This is a personal static blog for Yang Yufei, deployed through GitHub Pages at:

```text
https://duolabmeng673.github.io
```

The site is built with Astro 7 and uses Markdown content collections for blog posts. The current visual direction is a restrained dark "Liquid Glass inspired" interface: dark background, translucent navigation/panels, subtle pointer glow, reveal-on-scroll animation, and light card tilt interactions.

Do not use Apple logos, WWDC names, or protected Apple assets. The design should stay inspired by liquid glass UI behavior, not copied from Apple pages.

## Tech Stack

- Runtime/build: Astro `^7.0.7`
- Type checking: `@astrojs/check`
- Language: TypeScript + Astro components
- Content: Markdown files under `src/content/blog`
- Deployment: GitHub Actions to GitHub Pages
- Package manager: npm

Useful commands:

```bash
npm install
npm run dev
npm run build
npm run preview
```

`npm run build` runs:

```bash
astro check && astro build
```

Always run it before committing.

## Repository Structure

Key files:

```text
astro.config.mjs
package.json
tsconfig.json
.github/workflows/deploy.yml
src/config.ts
src/content.config.ts
src/content/blog/*.md
src/layouts/BaseLayout.astro
src/pages/index.astro
src/pages/about.astro
src/pages/blog/index.astro
src/pages/blog/[slug].astro
src/scripts/site-motion.ts
src/styles/global.css
public/favicon.svg
```

Generated directories that should not be committed:

```text
node_modules/
dist/
.astro/
```

These are already ignored by `.gitignore`.

## Site Configuration

Shared profile/site data lives in `src/config.ts`.

Current shape:

```ts
export const siteConfig = {
  name: '杨雨飞',
  title: '杨雨飞的博客',
  description: '哈尔滨工业大学信息安全专业，关注 Web 开发、分布式系统、AI 与算法。',
  education: '哈尔滨工业大学 信息安全专业',
  github: 'https://github.com/duolaBmeng673',
  tags: ['Web 开发', '分布式系统', 'AI', '算法', 'CMU'],
};
```

Use this file for global identity/profile changes instead of duplicating values across pages.

## Content Model

Blog posts are Markdown files in:

```text
src/content/blog/
```

The collection is defined in `src/content.config.ts` using Astro 7's loader API:

```ts
const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()),
  }),
});
```

Required frontmatter for every post:

```yaml
---
title: "文章标题"
description: "文章摘要"
pubDate: 2026-07-10
tags: ["标签1", "标签2"]
---
```

Routing uses `post.id`, not `post.slug`. In Astro 7 content collections, `id` is the correct field for the current implementation.

## Pages and Layout

### `BaseLayout.astro`

Responsible for:

- Global `<head>` metadata
- Shared navigation
- Shared footer
- Ambient visual background DOM:
  - `.ambient-stage`
  - `.ambient-arc`
  - `.ambient-core`
  - `.ambient-noise`
  - `.pointer-glow`
- Client-side motion script import:

```astro
<script>
  import '../scripts/site-motion';
</script>
```

Important: do not import `site-motion.ts` in frontmatter. It uses `window`, so it must run only in the browser.

### `index.astro`

Homepage structure:

- Hero with:
  - `Personal Knowledge Space`
  - `Yang Yufei, Information Security`
  - main Chinese headline
  - short site description
  - buttons to blog/about
  - small glass panel with current focus
- Three focus cards:
  - Web Development
  - Distributed Systems
  - AI & Algorithms
- Latest posts, showing up to 3 recent blog entries.

### `about.astro`

Personal detail page. Contains:

- Name and short profile
- GitHub avatar loaded from `https://github.com/duolaBmeng673.png`
- Education panel
- Focus tags
- Current writing/learning intent

### Blog Pages

- `src/pages/blog/index.astro`: full post list.
- `src/pages/blog/[slug].astro`: static detail route generated from content collection entries.

## Visual System

Main stylesheet: `src/styles/global.css`.

Current design principles:

- Dark canvas, not pure decorative noise.
- Liquid Glass style is reserved for navigation, buttons, hero glass panel, and content cards.
- Typography should be lighter and calmer than previous versions.
- Main hero line should not become an oversized heavy billboard.
- Persona text uses mono-style font and purple color, similar to:

```text
Yang Yufei, Information Security
```

Core visual variables:

```css
--bg: #050509;
--canvas: #0a0a10;
--surface: rgba(255, 255, 255, 0.075);
--surface-solid: rgba(16, 16, 24, 0.78);
--ink: #f5f5f7;
--muted: rgba(245, 245, 247, 0.56);
--violet: #a895ff;
--blue: #8bb8ff;
--green: #8af0cf;
```

Avoid making the whole page too bright or too noisy. If adding new visual effects, keep article readability first.

## Motion System

Client script: `src/scripts/site-motion.ts`.

It provides three behaviors:

1. Pointer glow
   - Updates CSS variables:

```css
--pointer-x
--pointer-y
```

2. Scroll reveal
   - Elements with `data-reveal` get `.is-visible` when entering viewport.

3. Card tilt
   - Elements with `data-tilt` receive:

```css
--tilt-x
--tilt-y
--spot-x
--spot-y
```

Accessibility/performance behavior:

- Disabled when `prefers-reduced-motion: reduce`.
- Pointer effects disabled unless `(pointer: fine)`.
- Pointer updates use `requestAnimationFrame`.
- Tilt is intentionally subtle: around 3 degrees.

When adding new cards, use:

```astro
<article data-reveal data-tilt>
  ...
</article>
```

For text-only or long-reading areas, prefer only `data-reveal`, not `data-tilt`.

## Deployment

Deployment workflow:

```text
.github/workflows/deploy.yml
```

Trigger:

- Push to `main`
- Manual `workflow_dispatch`

Build job:

```bash
npm ci
npm run build
```

Deploy job:

- Uploads `dist`
- Uses GitHub Pages deployment action

GitHub Pages source should remain GitHub Actions.

Remote:

```text
git@github.com:duolaBmeng673/duolabmeng673.github.io.git
```

Standard release flow:

```bash
npm run build
git status --short
git add .
git commit -m "Meaningful commit message"
git push
```

Then check:

```text
https://github.com/duolaBmeng673/duolabmeng673.github.io/actions
https://duolabmeng673.github.io
```

GitHub Pages can cache for several minutes. If the browser shows stale UI, use a hard refresh.

## Known Notes

- The GitHub Actions logs may show warnings about Node.js 20 deprecation for GitHub-maintained actions. These are not site build failures.
- Astro preview may require permission to bind a local port in restricted environments.
- Do not commit `dist`, `.astro`, or `node_modules`.
- Do not replace the Astro 7 content collection API with the legacy `src/content/config.ts` form. The current project uses `src/content.config.ts`.

## Suggested Next Improvements

- Add RSS feed.
- Add SEO/Open Graph metadata.
- Add per-post reading time.
- Add a projects page if the site becomes more portfolio-oriented.
- Add a small theme QA checklist with screenshots for desktop/mobile.
