# Technical handoff: duolaBmeng673 notebook

## Runtime and deployment

Astro 7, TypeScript, Markdown content collections, npm. The redesign added no dependencies; formula rendering subsequently added `katex` and explicitly declared Astro's existing `@astrojs/markdown-satteri` processor. `npm run build` runs `astro check && astro build`; `npm run dev` serves a live preview and `npm run preview` serves `dist`.

GitHub Actions builds on Node 22 with `npm ci` and `npm run build`, uploads `dist`, and deploys to GitHub Pages when `main` is pushed or the workflow is manually dispatched. The workflow and Astro configuration are unchanged. Never commit `dist`, `.astro`, or `node_modules`.

## Content contract

Existing blog Markdown lives directly in `src/content/blog_read/` and `src/content/blog_huawei_examination/`. Those loaders intentionally match `*.{md,mdx}` and exclude the ignored nested source archives. Do not broaden their globs. Study Notes uses a separate recursive `study_notes` collection for `src/content/837考研/**/*.md`, retaining the author's original directories and relative images. Only explicitly `published: true` notes enter public routes and data sources; missing publication state defaults to false.

The collections share base fields in `src/content.config.ts`: `title`, `description`, `pubDate`, `tags`, `category`, `subcategory`, `series`. The existing blog taxonomy retains its explicit enums; Study Notes uses category/subcategory literals and registered series. `shortTitle` and `subtitle` are optional visual fields; the full original `title` is used for page metadata and search. Do not render missing fields as blank placeholders. Study metadata, publication rules and explicit H2/H3 question mappings are documented in `docs/STUDY_NOTES.md`.

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

The 14 existing articles keep their file paths, `post.id`, URLs, original tags and body bytes. Only front matter was extended, and the 12 paper-note dates were corrected to their original Feishu creation dates. Detail routes remain `/blog/${post.id}/`. Never change IDs as a side effect of classification.

Current taxonomy:

- Research → Paper Notes → NLP: BERT, GPT-1, Transformers.
- Research → Paper Notes → Multimodal: CLIP, MathVista, MMMU.
- Research → Paper Notes → Computer Vision: SqueezerFaceNet, TableSense.
- Research → Paper Notes → LLM & Tables: LLM for Table Processing Survey, SheetCopilot, SpreadsheetLLM, TableQuest.
- Computer Science → Algorithms → ACM / OJ: Python ACM / OJ 模式：输入与输出, 最少机器覆盖业务需求：状态压缩 DP, 从三维 DP 到单调队列：CI/CD Pipeline Jobs 最小成本问题, 光伏优化器最少安装数量：贪心算法总结, 从频次约束到最优划分, 迷宫最短救援：从 BFS 到状态空间搜索.
- Study Notes → 考研复习 → HIT 837: 信息安全的基本概念, 防火墙理论与 netfilter 结构原理, 入侵检测理论与 snorts 结构原理, IPSec协议的组成及工作原理, SSL协议的组成及工作原理, SET 协议体系与关键技术, 信息系统风险评估与控制. The five original notes were authorized for publication on 2026-10-24; the two new chapter 05 notes were published on 2026-10-25. Publication does not imply review completion.

The machine coverage note uses `shortTitle: 最少机器覆盖业务需求` and `subtitle: State Compression DP`; its full title remains unchanged.

## Shared data and pages

`src/lib/blog.ts` centralizes sorted posts, display titles, URLs, category summaries, timeline grouping, estimated reading time and search records. Only categories with articles appear in navigation. Every view and search result preserves descending `pubDate` order without relevance ranking. Paper-note dates represent original Feishu creation dates, from 2024-07-13 (Transformers) to 2025-03-15 (TableSense); both ACM/OJ notes retain 2026-10-04. Dates are formatted and grouped in UTC to avoid build-host timezone shifts. The full title also populates Open Graph metadata.

Home contains identity, research interests, non-empty category summaries, five recent notes, and About/GitHub links. The avatar appears only on About, using the existing local `public/github-avatar.png`.

`/study-notes/` lists real public series; `/study-notes/837/` groups existing chapters 01, 05 and 06; chapter routes use `/study-notes/837/chapter/{code}/`. Stable `studySlug` IDs generate `/study-notes/837/{slug}/` without exposing original directories. `src/lib/study.ts` centralizes series metadata, publication filtering, chapter grouping and syllabus ordering. Numeric chapter codes order groups; the unique series-wide `order` field orders notes and previous/next links (chapter 05 now includes `5.a`, `5.b`, `5.c.1`, `5.c.2`, and `5.d`). Global Home/Notes/Timeline/search still sort by descending `pubDate`. The original 18 `/blog/.../` routes use `getBlogPosts()` and retain their IDs and metadata.

`src/components/Article.astro` shares the established article layout between old and study routes. Study pages add a single breadcrumb, syllabus number and real previous/next links. Explicit `questions: [{ id, heading, depth }]` entries reference one existing H2/H3 each (`depth` defaults to 2); answers stop at the next same-or-higher-level heading and recall retains parent headings. Unmatched or duplicate mappings fail validation. `src/scripts/recall.ts` reparents existing rendered nodes without duplicating answers or rendering untrusted strings. Reading is default and remains complete without JavaScript. Recall hides answers and unmarked paragraphs, supports independent/bulk toggles with native buttons, `hidden`, `aria-expanded` and `aria-controls`, and restores full reading on switch back. All 7 notes currently support 65 selected questions; other article types have no recall controls.

The Notes archive offers category/subcategory/series filters, existing tag filtering and Notes/Timeline views. Header search is the sole search input; there is no separate Search navigation item, Notes input or modal. Both views use the same content source. Query state is shareable using `category`, `subcategory`, `series`, `tag`, `q` and `view=timeline` parameters. `src/scripts/notes.ts` reads `q` independently of the input, preserves it across filters/view changes, shows a clearable query label, filters actual rows, hides empty month/year groups and updates counts. Submitting Header search navigates to Notes with the query; typing in Header continues to show global results.

Article pages use a 740px reading column, metadata, linked taxonomy, original tags, sticky desktop H2/H3 TOC and mobile collapsible TOC. `src/scripts/article.ts` updates the active chapter and adds a keyboard-accessible Copy toolbar above each scrolling code block. Copy reads only `code.textContent`, uses the Clipboard API, falls back to local copying, then selects the code with an inline hint if copying fails. Success feedback lasts two seconds. Code uses .95rem desktop / .9rem mobile with 1.75 line height; nested code inherits that size and inline code uses .9em. Astro's existing Sätteri Markdown processor enables its native math feature; a small mdast plugin in `astro.config.mjs` renders `$...$` inline and `$$...$$` display nodes with KaTeX at build time, producing visual HTML and accessible MathML. KaTeX CSS and fonts are bundled locally through BaseLayout, without a CDN or runtime math script. Display formulas scroll horizontally when needed. Strict typography warnings are ignored to support Chinese text; untrusted commands remain disabled, and invalid formula syntax fails the build. Syntax highlighting, fenced code, existing formula images and all Markdown source bytes are preserved.

## Search and preferences

`src/pages/search-index.json.ts` produces `/search-index.json` at build time. It contains the full title, optional display title/subtitle, description, taxonomy, tags, ISO date and original URL for all public posts (currently 25: 18 existing + 7 study notes). Study matching also includes subject, chapter, section number and explicit question headings. The existing index does not index full bodies. `src/lib/search.ts` provides case-insensitive matching across whitespace-separated terms. Notes uses collection-prefixed keys to avoid ID collisions across collections.

`src/scripts/site-search.ts` fetches the index lazily from the permanent Header search field, with an anchored result panel. Cmd/Ctrl+K focuses the input; Escape, outside click and leaving the search controls close results. Arrow keys navigate result links, with native Tab/Enter support. Form submission and the all-results link navigate to `/blog/?q=...`, including without JavaScript. Results are created with text nodes and preserve date order, including conditional subtitles. Loading failure is shown inline and subsequent input/focus retries. Notes has an inline index derived from the same records.

The head script applies the theme before paint. `src/scripts/typography.ts` supports Light, Dark and System, listens to OS preference changes in System mode, and preserves size/bold controls. Theme storage uses `duolabmeng673:theme:v2`, with migration from existing explicit light/dark choices in `v1`; new visitors follow System. Storage failures do not prevent rendering.

## Visual system

`src/styles/global.css` defines a cool paper light palette (#f4f7f2 background, #1d2926 text, #087f76 teal accent, #ba633c warm accent) and deep green-gray dark palette (#12201d background, #edf4ed text, #75d2bd accent, #e0a17d warm accent). Surfaces, borders, code and hover states have separate tokens for each mode.

Headings use Iowan Old Style / Noto Serif SC / Songti SC / Georgia. Body uses Inter / Noto Sans SC / PingFang SC / system-ui. Code and metadata use SF Mono / ui-monospace / Menlo / Monaco / Consolas. These are local fallback stacks, with no external font requests.

The main container is 1120px, the reading column is 740px, surfaces have at most 8px radius, and motion is limited to small interaction transitions. Semantic tokens cover links, focus, category accents, timeline nodes and button hover. Research uses teal; Computer Science and timeline markers use restrained warm accents. The Header search is approximately 220px on desktop, becomes a full second row at 950px, and remains a permanent search row on mobile. Breakpoints at 800px and 520px adapt page layouts without squeezing theme/navigation controls. Focus styles, skip link and reduced-motion support are included.

## Verification and content protection

Run `npm run build` and `git diff --check`. Verify all 25 public article search records, the 18 unchanged blog routes (including the 14 original routes), 7 study article routes, 3 existing chapter routes and 2 study index routes. Check taxonomy/tag/query filtering and actual visible rows in Notes/Timeline, global search, syllabus prev/next, all recall controls and no-question behavior, themes, TOC and 1440/1024/768/390/320px layouts. There is currently no sitemap or RSS generator; this task does not add one.

Before/after metadata changes, split each tracked Markdown at the closing front matter delimiter and compare the remaining bytes against the baseline (including trailing blank lines). Also compare original title, description and tags; validate intentional date changes against the supplied date mapping. Stop and report immediately on any body difference. Do not normalize line endings or trim bodies. Ignored nested source archives are not deployed articles and must remain untouched.
