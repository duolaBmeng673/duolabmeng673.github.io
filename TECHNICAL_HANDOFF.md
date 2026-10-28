# 技术交接：duolaBmeng673 博客

更新于 2026-10-28。当前结构与验证见 [定向优化记录](docs/REFINEMENT.md)；[此前审计](docs/BLOG_AUDIT.md)保留历史背景，其暂缓公开状态已由作者本次要求替代。学习笔记字段与背诵机制见 [Study Notes 维护说明](docs/STUDY_NOTES.md)。

## 运行与部署

Astro 7、TypeScript、Content Collections、Sätteri Markdown、KaTeX。沿用现有依赖和锁文件，本轮没有升级框架或增加依赖。`npm run build` 执行 `astro check && astro build`；`npm test` 使用 Node 内置测试，要求先构建。建议 Node 22，与 CI 一致。

GitHub Actions 在 `main` 推送或手动触发时执行 `npm ci`、构建、测试，再上传 `dist` 部署到 GitHub Pages。`PUBLIC_BUILD_SHA` 写入页面便于辨认版本。不要提交 `dist`、`.astro`、`node_modules`。没有服务器端运行时或重定向服务；本轮没有 URL 迁移。

## 内容集合与公开规则

`src/content.config.ts` 注册三个集合：

- `blog_read`：`src/content/blog_read/*.{md,mdx}`，12 篇论文笔记。
- `blog_huawei_examination`：同名目录直属 Markdown，6 篇历史技术／算法笔记。
- `study_notes`：`src/content/837考研/**/*.md`，当前 12 篇学习笔记。

前两个集合不要扩大 glob，以免把忽略的嵌套来源档案也发布。博客 URL 始终为 `/blog/${post.id}/`；Study Notes 通过稳定 `studySlug` 生成 ID 与 `/study-notes/837/{slug}/`，不依赖本地中文目录名。

共享字段包括完整 `title`、`description`、`pubDate`、原始 `tags` 与有 schema 类型约束的 `category`、`subcategory`、`series`。`shortTitle`、`subtitle` 是可选视觉字段；不提供时不渲染占位，SEO、RSS、搜索仍保留完整标题。可选 `updatedDate` 表示真实更新时间，不自动以构建时间填充，也不替代首次发布日期。

常规文章公开条件：`!draft && !publicationHoldReason`。学习笔记还必须显式 `published: true`，默认不公开。统一通过 `getBlogPosts()`、`getPublicStudyNotes()`、`getAllPosts()` 获取公开数据，新增输出入口必须复用这些过滤条件。

作者本次明确要求恢复 5 篇算法题解公开。复核未发现明确禁止公开的声明，已移除这 5 篇的 `draft` 与 `publicationHoldReason`，恢复原 URL 的完整正文及搜索／归档／RSS／sitemap。五篇不再含 `Huawei Examination` 来源标签（其中三篇本次移除，两篇此前已无）；Python I/O 文件及 tags 完全不变。正文、日期、分类、ID 与路径未改。通用草稿／暂缓机制继续保留供未来确有需要的内容使用：普通草稿不生成详情页，考试题解集合带 hold 的记录生成 noindex 通用提示页。不要通过删除通用过滤器来恢复某一篇文章。

当前快照：30 篇公开文章（12 论文、6 常规技术／算法、12 学习笔记），没有暂缓提示页，42 个 HTML 页面；RSS 30 项、sitemap 42 个页面 URL。数量来自集合，不要硬编码为业务规则。公开状态不代表复习完成或技术内容已经审校；网站隐藏也不会清除公开 Git 源码或历史。

## 数据、排序与入口

`src/lib/blog.ts` 集中处理公开文章、显示标题、集合限定键、URL、分类统计、时间分组、日期与索引数据。分类只展示实际有文章的项；界面通过 `taxonomyLabel` 显示中文，原始分类值不变。

- 首页：姓名、学校与专业、四个可点击方向名称、3 篇精选阅读与分组近期内容。已删除四句方向说明和总结性概述，不另补类似文案。近期论文取 3 篇，技术和学习各最多 2 篇，不显示空组；各组按 `pubDate` 倒序。
- `/blog/`：默认显示论文与常规技术笔记。分类／子分类／系列／tag 显式筛选或查询可覆盖学习笔记。支持列表、时间线，以及 `category`、`subcategory`、`series`、`tag`、`q`、`view=timeline` 查询参数。
- 普通列表、时间线按 `pubDate` 倒序；日期格式和年月分组使用 UTC，避免构建机器时区改变日期。搜索列表按相关度排序，同分按发布日期、URL 排序；带查询的时间线仍按日期分组。
- `/study-notes/`：按系列直接列出两个独立模块入口；`/study-notes/837/`：兼容旧链接的模块选择页。两处均不重复展开全部知识点。模块页分别为 `/study-notes/837/information-security/`（8 篇）、`/study-notes/837/network-security/`（4 篇），计数与列表均来自真实公开数据。文章返回链接、面包屑与章节页上级导航指向对应模块，模块内上下篇保持原考纲顺序。

旧论文日期继续使用已核对的 Feishu 创建日期（2024–2025），本轮未调整既有文章日期，仅按作者要求移除指定五篇题解的来源标签。下划线、中文历史 URL 保留；新页面使用英文连字符 slug。

## 837 模块、排序与背诵

`src/lib/study.ts` 注册 HIT 837 和两个并列模块：信息安全导论、网络安全基础，界面模块名分别为“信息安全”“网络安全”。`getStudyModuleSummaries()` 集中筛选、排序和动态计数，`getStudyModuleHref()` 集中生成模块链接。`StudyModuleLinks.astro` 复用模块选择，`StudyModule.astro` 只列出传入模块的章节／文章；`[series]/[slug].astro` 同时生成模块和既有文章路由，模块 slug 是保留 ID，重复使用会构建失败。`subject` 使用 schema 枚举。信息安全章节保留 `/chapter/01/`、`04/`、`05/`、`06/`；网络安全章节使用 `/chapter/network-security-01/`，避免同号章节混合。

课程顺序由系列 + 模块内唯一整数 `order` 决定，重复值构建失败；章节按两位数字编号排序，`syllabusSection` 只做可选展示。上下篇限制在同一模块，不按日期或目录字符串排序。

`Article.astro` 复用正文、目录与元数据。`recall.ts` 把已渲染节点移入嵌套原生 `details/summary`，基于 H2–H6 和独占段落的 `strong` 小标题生成折叠。阅读默认全展开，背诵初始全收起；子标题独立、父级保留子状态、批量控制、回到阅读恢复全文。TOC/hash 跳转展开祖先；无 JavaScript 仍显示完整静态正文。没有标题就不显示背诵控件。

旧 `questions` 元数据用于检索和构建校验，要求文本唯一匹配渲染标题。保留历史 `depth` 字段，但不再以它限制匹配：渲染层可能调整深度。新笔记不必编造一问一答。

新增 Web 攻击技术（2026-10-28）位于网络安全基础 → 01 网络攻击 → `1.d`，`order: 104`；URL `/study-notes/837/web-attack-techniques/`，前篇为格式化字符串／缓冲区溢出，当前无后篇。只有这一篇新文章，没有本地附件，正文未改写。

## Markdown、标题与阅读

`astro.config.mjs` 沿用 `@astrojs/markdown-satteri`，原生启用 math，KaTeX 在构建时渲染为 HTML + MathML；CSS 与字体本地打包，无 CDN。`trust: false`，公式语法错误使构建失败。代码保留 Shiki 双主题高亮。

`src/plugins/article-headings.mjs` 是每文档独立的 AST 插件工厂：使用已有 `github-slugger` 按原序分配 ID；首次标题若为同名 H1，以空锚点代替；其他 H1 及其后续标题树降一级，最多 H6。原本正确且未受 H1 章节树影响的 H2/H3 不变。它只处理 Markdown，不修改模板 H1 或 Markdown 源文件；已规范的 AST 无 H1，不会再次持续降级。既有标题 ID 和重复后缀保留。修改时须跑标题、锚点与公式／代码测试。

文章维持约 740px 正文、桌面 sticky H2/H3 TOC、移动折叠目录、完整描述／日期／tags 与可选更新时间；本轮去除粗略阅读时长。`article.ts` 实现目录高亮、代码复制与失败回退。复制只读取 `code.textContent`，失败时选中文本并提示手动复制。长代码、表格、块公式可横向滚动，图片按原比例展示。

SVG 沿用 Astro 本地图片管线，不内联任意 SVG 源码、不转换低清位图；白底保证原图深色文字在暗色主题可见，脚本提供查看原图入口。文章末尾勘误链接使用已核实的项目 Issues 地址，预填标题与 canonical，不自动发送。未配置 Giscus。

## 全文搜索与偏好

`/search-index.json` 在构建时仅输出公开文章。包括完整标题、可选视觉标题、描述、原始分类／tags、中文分类名、课程信息、日期、URL，以及剥离展示标记后的正文文本。`searchText` 是元数据，正文单独保存，避免重复体积。

全站仅有 Header 常驻搜索，`site-search.ts` 与归档 `notes.ts` 共享 `search.ts` 的延迟加载和排序。首页不内嵌／主动下载正文；归档内嵌轻量元数据，出现查询时才加载全文索引。加载失败可重试。结果通过 `textContent` 创建，原始 Markdown 不作为搜索 HTML 注入。

匹配使用 NFKC、大小写归一化、空白分词 AND、连续中文子串。排序优先精确／部分标题，其次标签、分类、描述和正文；同分日期倒序再按 URL。不是语义搜索，不提供同义词或错字纠正。命中正文可展示摘要。当前约 223 KB 原始 JSON、80 KB gzip（增加的内容是本轮恢复的五篇算法题解）；小语料下沿用现有检索，未引入 Pagefind，未进行 Pagefind 实测对比。

Cmd/Ctrl+K 聚焦搜索；Escape、离开控件或点击外部关闭结果，方向键导航链接。表单提交和“全部结果”跳转 `/blog/?q=...`；归档筛选和视图切换保留查询。无 JS 时表单仍会导航，但动态全文结果／筛选需要 JS，完整静态阅读不受影响。

首屏 head 脚本应用主题，`typography.ts` 支持浅色、深色、跟随系统、字号与加粗。持久化键 `duolabmeng673:theme:v2`，兼容 v1 显式选择；存储失败仍可阅读，系统模式监听 OS 变化。

## SEO、订阅与设计约束

`BaseLayout.astro` 提供 `zh-CN`、统一 title 分隔符、description、canonical、OG、Twitter。文章为 `article` 类型，包含真实发布／可选更新日期。默认分享图 `public/og-default.png` 为 1200×630，保留 SVG 编辑源，不逐篇生成重复封面。

`sitemap.xml.ts` 使用公开数据与真实入口／章节路径生成静态 XML；hold 不纳入。`lastmod` 只使用明确 `updatedDate`。`rss.xml.ts` 输出公开文章标题、描述、日期和 canonical，XML 统一转义，布局提供订阅发现链接。`robots.txt` 指向 sitemap。没有增加服务或生成器依赖。

保留青绿／暖褐、冷纸张浅色和深绿灰暗色 tokens。固定角色：`--accent`／`--accent-strong` 控制主交互；`--label: var(--warm)` 控制所有眉题、分类文字、课程编号和检索 taxonomy，浅色暖褐为 #955137、暗色暖橙为 #e0a17d；`--heading` 统一内容标题。暖色也固定用于精选顶边、方向标记、模块入口左边界、时间线节点和可选副标题，`--warm-soft` 只用于辅助 hover。分类识别仅用小圆点，映射固定为论文青绿、技术暖褐、学习中性灰绿，不再根据分类覆盖眉题文字颜色。正文辅助信息使用中性色；浅绿只做柔和背景和主交互反馈。标题为 Iowan Old Style／Noto Serif SC／Songti SC／Georgia，正文为 Inter／Noto Sans SC／PingFang SC／system-ui，代码等宽，均为本地 fallback。主容器 1120px、正文 740px，圆角至多 8px，保留 focus、skip link、reduced-motion。

Header 在 950px 断点让搜索进入第二行，移动端保持常驻搜索，不压缩主题／导航来强行单行；800／520px 等断点继续适配正文。头像仅出现在 About，使用 `public/github-avatar.png` 本地静态文件；首页没有头像，不新增一个。已核验 Git remote 与账号为 `duolaBmeng673`，官方来源为 `https://github.com/duolaBmeng673.png?size=192`。本轮网络域名解析失败，获授权的网络重试又被自动审批服务模型配置错误拒绝，因此没有获取到新头像，保留原文件及引用。它不会自动同步 GitHub。网络恢复后先下载官方 PNG 到临时文件，确认最终响应和图片格式／尺寸、实际查看后，再替换 `public/github-avatar.png`，执行构建并检查 About。不要把失败响应或占位图保存为头像。

## 验证与内容保护

基本回归：`npm run build`、`npm test`、`git diff --check`。测试覆盖 AST 标题与锚点、代码／表格／公式节点、中文与混合全文检索、相关度、构建后的公开边界、元数据、资源与新文章接入。CI 同样先构建再测试。

检查所有旧博客路径、新文章、模块上下篇、查询状态、TOC、SVG、公式与无 JS 阅读。浏览器验收须覆盖 1440／1024／768／390／320px 明暗主题、真实键盘／复制／系统主题联动。本轮构建、静态／DOM 与样式匹配检查通过；真实浏览器仍无法运行：应用内浏览器禁用，本机 Chrome 启动失败，网络提升又受自动审批服务配置异常阻塞。不能用样式匹配或构建成功替代真实视觉验收。

不随意改写技术文章的实质内容；允许最小修复标题层级、错别字、内部链接及必要元数据。涉及技术观点、实验结论或核心论述的修改须有明确依据并记录原因。修改日期、URL、tags 或公开状态须说明影响并验证兼容。来源不明的受限考试材料优先暂缓公开，不宣称改写即可消除风险。

元数据迁移前后仍应逐篇比对正文和资源，防止意外截断、换行规范化或图片引用变动；若有有意的正文修复，单独记录。本轮 134 个原有内容／资源文件完整，只有 5 篇题解的 Front Matter 变更，正文与其余内容资源字节均不变；Python I/O 完全不变，未移动或删除内容。
