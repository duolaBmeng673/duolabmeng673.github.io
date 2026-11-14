# 笔记接入与维护

【用户决定】2026-11-14 确认启用，配合 [AGENTS.md](../AGENTS.md) 执行；先核实当前机制，再按已授权范围接入内容。知识点标签先从正文自动提取为建议，由用户修正／确认后落地，不因启用规范而改写文章。确认记录见 [rules-review.md](rules-review.md)。

## 已核实的内容入口

【已核实】以下加载范围来自 [src/content.config.ts](../src/content.config.ts)，不是按目录名称猜测：

| 集合 | 加载范围 | 用途 |
|---|---|---|
| `blog_read` | `src/content/blog_read/*.{md,mdx}`，仅直属文件 | 当前论文笔记 |
| `blog_huawei_examination` | `src/content/blog_huawei_examination/*.{md,mdx}`，仅直属文件 | 当前算法与 Python I/O 技术笔记；集合名是历史内部名称 |
| `study_notes` | `src/content/837考研/**/*.md`，排除根部 `笔记设计规范.md` | HIT 837 学习笔记 |

【已核实】两个学习模块的实际源目录分别是 [信息安全导论考点问题总结](../src/content/837考研/信息安全导论/信息安全导论考点问题总结/) 与 [网络安全基础考点笔记总结](../src/content/837考研/网络安全基础考点笔记总结/)；模块归属最终由 `subject` 元数据决定。代码依据：[src/lib/study.ts](../src/lib/study.ts)。

【已核实】根目录汇总文件、`article/`、论文集合中的嵌套旧归档不在上述加载范围；不要把“文件存在”当成“已发布”。依据：[src/content.config.ts](../src/content.config.ts)、[.gitignore](../.gitignore)。

## 已核实的 Front Matter

【已核实】公共字段来自 [schema](../src/content.config.ts)：

- 必填：`title`、`description`、`pubDate`、`tags`、`category`、`subcategory`、`series`。`pubDate` 转为 Date，`tags` 为字符串数组。
- 可选：`shortTitle`、`subtitle`、`updatedDate`、`publicationHoldReason`；其中 `shortTitle`、`subtitle`、`publicationHoldReason` 均须 trim 后非空，`updatedDate` 转为 Date。
- `draft` 默认 `false`；`publicationHoldReason` 一旦有值就会暂缓公开，不只是展示说明。

【已核实】`description` 仍是必需元数据，供搜索、RSS、SEO 等使用。学习笔记界面改用知识点标签并不意味着应删除或清空它。依据：[src/content.config.ts](../src/content.config.ts)、[src/lib/blog.ts](../src/lib/blog.ts)、[Article](../src/components/Article.astro)、[rss.xml.ts](../src/pages/rss.xml.ts)。

## 技术笔记

- 【已核实】两个技术集合共用 schema：`category` 为 `Research / Computer Science`，`subcategory` 为 `Paper Notes / Algorithms`，`series` 为 `NLP / Multimodal / Computer Vision / LLM & Tables / ACM / OJ`。当前论文采用 `Research → Paper Notes`，算法／I/O 采用 `Computer Science → Algorithms → ACM / OJ`。schema 只分别校验枚举，未实现三字段组合的交叉校验。依据：[src/content.config.ts](../src/content.config.ts)、[现有论文](../src/content/blog_read/)、[现有算法笔记](../src/content/blog_huawei_examination/)。
- 【已核实】公开条件为 `!draft && !publicationHoldReason`，没有学习集合的 `published` 开关。文章 URL 为 `/blog/${post.id}/`；此处使用 loader 生成的 ID，不是按标题生成。依据：[src/lib/blog.ts](../src/lib/blog.ts)、[blog/[slug].astro](../src/pages/blog/[slug].astro)。
- 【用户决定】维护原文件名／ID 和已发布 URL；未经授权不改发布日期或恢复已移除的考试来源标签。完整 `title` 用于检索与元数据，`shortTitle`／`subtitle` 只在有值时辅助展示，不用缩写覆盖完整标题。
- 【已核实】技术归档底层读取 `getAllPosts()`，默认用 `regularPosts` 及行的 `hidden` 状态只展示论文和算法；全局搜索与显式分类／标签／系列筛选仍可访问学习笔记，不能将其从底层公开数据移除。首页及时间线也复用统一公开数据。依据：[src/pages/blog/index.astro](../src/pages/blog/index.astro)、[src/scripts/notes.ts](../src/scripts/notes.ts)、[src/lib/blog.ts](../src/lib/blog.ts)。

## 学习笔记

【已核实】学习集合在公共 schema 上增加或覆盖以下字段，依据 [src/content.config.ts](../src/content.config.ts)：

| 字段 | 当前约束 |
|---|---|
| `category / subcategory / series` | 固定 `Study Notes / 考研复习 / HIT 837` |
| `subject` | `信息安全导论` 或 `网络安全基础` |
| `studySlug` | 必填，小写字母／数字及单个连字符连接；作为稳定 ID |
| `syllabusChapter` | 两位数字字符串，例如 `"02"` |
| `chapterTitle` | trim 后非空 |
| `syllabusSection` | 可选，trim 后非空；与知识点配置中的 `section` 对应 |
| `order` | 非负整数，同一 series + subject 的公开文章中不得重复 |
| `published` | 默认 `false`，须显式公开 |
| `questions` | 默认 `[]`；每项有 `id`、`heading`、可选 `depth`（2 或 3，默认 2）；id 与 heading 在数组内各自唯一 |

- 【已核实】公开条件为 `published && !draft && !publicationHoldReason`。[study.ts](../src/lib/study.ts) 另查重 URL／order、禁止占用模块 slug，并检查同章标题冲突；`questions` 中的 heading 须与渲染后的一个且仅一个标题匹配，检查在 [Article](../src/components/Article.astro)。
- 【已核实】目录由集合数据自动生成，不需复制正文或手写每篇入口。学习总入口 `/study-notes/`；兼容入口 `/study-notes/837/` 继续选择模块；信息安全与网络安全各有 `/study-notes/837/information-security/`、`/study-notes/837/network-security/`。依据：[学习总入口](../src/pages/study-notes/index.astro)、[系列入口](../src/pages/study-notes/[series]/index.astro)、[动态模块／文章页](../src/pages/study-notes/[series]/[slug].astro)。
- 【已核实】文章 URL 为 `/study-notes/837/${studySlug}/`；章节 URL 分别如 `/study-notes/837/chapter/02/`、`/study-notes/837/chapter/network-security-02/`，保留信息安全旧章节路径。依据：[src/lib/study.ts](../src/lib/study.ts)。
- 【已核实】模块目录与模块内上下篇按 `order`；章节按数值章号，不按字符串或发布日期。模块归属取 `subject`，不凭单个标题关键词推断；篇数从真正公开的集合计算。依据：[src/lib/study.ts](../src/lib/study.ts)、[动态模块／文章页](../src/pages/study-notes/[series]/[slug].astro)。
- 【已核实】知识点配置在 [knowledge-entries.json](../src/data/knowledge-entries.json) 的独立 `knowledgeTags` 字段，以 `studySlug` 为键，`section` 对应 `syllabusSection ?? syllabusChapter`；词典在 [tags.json](../src/data/tags.json)。目录、文章、全局列表等复用它，原文章 `tags` 保持独立。校验与维护见 [标签规则](tag-taxonomy.md)。
- 【已核实】背诵模式支持按标题自由折叠，不强制改成一问一答；[recall.ts](../src/scripts/recall.ts) 处理 H2–H6 与纯加粗标题段落，保留原 DOM 与锚点。已有维护说明见 [STUDY_NOTES.md](STUDY_NOTES.md)。

## 已核实的全站联动

- 【已核实】首页／全局列表的公开文章按 `pubDate` 降序；时间线按发布日期分年／月。搜索先相关度、同分再按日期与 href 排序，不能把它写成“搜索只按日期”。依据：[blog.ts](../src/lib/blog.ts)、[search.ts](../src/lib/search.ts)。
- 【已核实】搜索索引、RSS、sitemap 共用公开数据；应改源文件后构建，不直接改 `dist` 的生成文件。依据：[search-index.json.ts](../src/pages/search-index.json.ts)、[rss.xml.ts](../src/pages/rss.xml.ts)、[sitemap.xml.ts](../src/pages/sitemap.xml.ts)。
- 【已核实】首次公开文章按原 `pubDate` 自动计一次 Writing；`updatedDate` 和保存文件不会自动产生更新活动。实质更新需明确的手工记录，元数据／格式／空白修改不计额外次数。依据：[ActivityCalendar](../src/components/ActivityCalendar.astro)、[activities.ts](../src/data/activities.ts)；细节见 [热力图规则](heatmap.md)。

## 内容与资源保护

【用户决定】同步只在授权范围补必要元数据与渲染适配；保留正文、算法思路、证明、代码、公式、表格、图片、引用及链接。修显示优先检查渲染链，不为统一样式擅自重写正文；改前后基于工作区快照比较，不能仅靠相对 HEAD 的 diff 判断是否覆盖了用户修改。

- 【已核实】相对图片与 Markdown 保持原有资源关系，现有论文还引用 `public/articles/`；数学由 [astro.config.mjs](../astro.config.mjs) 中 Sätteri 自定义插件调用 KaTeX 渲染，`throwOnError: true`、`trust: false`。仓库当前不是用 remark-math／rehype-katex 管道。
- 【已核实】[article-headings.mjs](../src/plugins/article-headings.mjs) 在呈现层调整重复 H1 与标题层级；[article-inline-svg.mjs](../src/plugins/article-inline-svg.mjs) 只隔离信息安全第 02 章的内联 SVG，不能称为全站所有 SVG 自动修复。
- 【已核实】[article-presentation.mjs](../src/plugins/article-presentation.mjs) 仅对白名单内 KMP／BM／AC／WM 本地 HTML 演示创建 `srcdoc` iframe，使用 `sandbox="allow-scripts"`、CSP 与主题／尺寸桥接；不是任意 HTML 链接都会嵌入。新增演示须先审查资源和行为，再在获授权范围内适配，不更改既有算法逻辑。
- 【已核实】仓库中未发现通用的正文哈希保护命令；[package.json](../package.json) 只有 dev／build／preview／test。测试包含定向内容／结构保护，不能替代当次变更前后的正文与资源比对。

## 维护与检查步骤

【用户决定】每次接入先检查 Git 状态与源文件，再按上述真实集合和 schema 处理；目录由代码生成，独立标签先按 [标签规则](tag-taxonomy.md#维护步骤) 自动提取并建议，经用户修正／确认后维护。新增或修改内容后执行 `npm run build` → `npm test` → `git diff --check`，检查模块／章节／上下篇、全局入口与搜索、图片／公式／演示、活动日期与计数。纯元数据变化不手工补首发活动；有实质更新时按 [热力图规则](heatmap.md) 判断。

【用户决定】内容接入改变工作流或字段约定时，同步本文件、[AGENTS.md](../AGENTS.md) 及受影响细则；[STUDY_NOTES.md](STUDY_NOTES.md)、[TECHNICAL_HANDOFF.md](../TECHNICAL_HANDOFF.md) 的带日期快照不能当永久数量常量。有冲突先询问，不为了通过测试重写批准的数据或扩大同步范围。
