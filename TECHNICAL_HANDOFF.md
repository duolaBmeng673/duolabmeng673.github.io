# Technical handoff: duolaBmeng673 notebook

## Runtime and deployment

Astro 7, TypeScript, Markdown content collections, npm. No new dependencies were added for this redesign. `npm run build` runs `astro check && astro build`; `npm run dev` serves a live preview and `npm run preview` serves `dist`.

GitHub Actions builds on Node 22 with `npm ci` and `npm run build`, uploads `dist`, and deploys to GitHub Pages when `main` is pushed or the workflow is manually dispatched. The workflow and Astro configuration are unchanged. Never commit `dist`, `.astro`, or `node_modules`.

## Content contract

Deployable Markdown lives directly in `src/content/blog_read/` and `src/content/blog_huawei_examination/`. The loaders intentionally match `*.{md,mdx}` and exclude the ignored nested source archives. Do not broaden the glob to include duplicate local imports.

Both collections share `src/content.config.ts`. Required fields: `title`, `description`, `pubDate`, `tags`, `category`, `subcategory`, `series`. The taxonomy fields have explicit enum schemas. `shortTitle` and `subtitle` are optional visual fields; the full original `title` is used for page metadata and search. Do not render missing fields as blank placeholders.

```yaml
---
title: "Full original title"
description: "Short summary"
pubDate: 2026-10-04
category: Research
subcategory: Paper Notes
series: NLP
tags: [NLP, Transformers]
---
```

The 14 existing articles keep their file paths, `post.id`, URLs, original tags and body bytes. Only front matter was extended. Detail routes remain `/blog/${post.id}/`. Never change IDs as a side effect of classification.

Current taxonomy:

- Research → Paper Notes → NLP: BERT, GPT-1, Transformers.
- Research → Paper Notes → Multimodal: CLIP, MathVista, MMMU.
- Research → Paper Notes → Computer Vision: SqueezerFaceNet, TableSense.
- Research → Paper Notes → LLM & Tables: LLM for Table Processing Survey, SheetCopilot, SpreadsheetLLM, TableQuest.
- Computer Science → Algorithms → ACM / OJ: Python ACM / OJ 模式：输入与输出, 最少机器覆盖业务需求：状态压缩 DP.

The machine coverage note uses `shortTitle: 最少机器覆盖业务需求` and `subtitle: State Compression DP`; its full title remains unchanged.

## Shared data and pages

`src/lib/blog.ts` centralizes sorted posts, display titles, URLs, category summaries, timeline grouping, estimated reading time and search records. Only categories with articles appear in navigation. Dates represent publication calendar dates and are formatted in UTC to avoid build-host timezone shifts.

Home contains identity, research interests, non-empty category summaries, five recent notes, and About/GitHub links. The avatar appears only on About, using the existing local `public/github-avatar.png`.

The Notes archive offers category/subcategory/series filters, local search, existing tag filtering and Notes/Timeline views. Both views use the same content source. Query state is shareable using `category`, `subcategory`, `series`, `tag`, `q` and `view=timeline` parameters. `src/scripts/notes.ts` applies query state, filters rows, hides empty month/year groups and updates counts.

Article pages use a 740px reading column, metadata, linked taxonomy, original tags, sticky desktop H2/H3 TOC and mobile collapsible TOC. `src/scripts/article.ts` updates the active chapter. Markdown rendering and syntax highlighting remain on Astro's existing renderer; no math parser or new content transformation was introduced. Existing math text and formula images are preserved.

## Search and preferences

`src/pages/search-index.json.ts` produces `/search-index.json` at build time. It contains the full title, optional display title/subtitle, description, taxonomy, tags, ISO date and original URL for all 14 posts. `src/lib/search.ts` provides case-insensitive matching across whitespace-separated terms.

`src/scripts/site-search.ts` fetches the index lazily when opening the global dialog. Cmd/Ctrl+K opens it, Escape closes it, and focus returns to the opener. Results are created with text nodes. Loading failure is shown explicitly and reopening retries. Notes has an inline index derived from the same records.

The head script applies the theme before paint. `src/scripts/typography.ts` supports Light, Dark and System, listens to OS preference changes in System mode, and preserves size/bold controls. Theme storage uses `duolabmeng673:theme:v2`, with migration from existing explicit light/dark choices in `v1`; new visitors follow System. Storage failures do not prevent rendering.

## Visual system

`src/styles/global.css` defines a cool paper light palette (#f4f7f2 background, #1d2926 text, #087f76 teal accent, #ba633c warm accent) and deep green-gray dark palette (#12201d background, #edf4ed text, #75d2bd accent, #e0a17d warm accent). Surfaces, borders, code and hover states have separate tokens for each mode.

Headings use Iowan Old Style / Noto Serif SC / Songti SC / Georgia. Body uses Inter / Noto Sans SC / PingFang SC / system-ui. Code and metadata use SF Mono / ui-monospace / Menlo / Monaco / Consolas. These are local fallback stacks, with no external font requests.

The main container is 1120px, the reading column is 740px, surfaces have at most 8px radius, and motion is limited to small interaction transitions. Breakpoints at 800px and 520px adapt layouts, and the header wraps on phone widths. Focus styles, skip link and reduced-motion support are included.

## Verification and content protection

Run `npm run build` and `git diff --check`. Verify 14 search records, 14 original article routes, linked taxonomy and tag queries, Notes/Timeline views, search shortcuts/results/empty state, theme persistence/System response, TOC and mobile layout.

Before/after metadata changes, split each tracked Markdown at the closing front matter delimiter and compare the remaining bytes against the baseline (including trailing blank lines). Also compare original title, description, date and tags. Do not normalize line endings or trim bodies. Ignored nested source archives are not deployed articles and must remain untouched.
