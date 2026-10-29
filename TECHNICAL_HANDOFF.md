# 技术交接：duolaBmeng673 博客

更新于 2026-10-29。本轮内容接入与视觉验收记录见 [设计精修记录](docs/DESIGN_REFINEMENT.md)。当前结构与验证见 [定向优化记录](docs/REFINEMENT.md)；[此前审计](docs/BLOG_AUDIT.md)保留历史背景，其暂缓公开状态已由作者本次要求替代。学习笔记字段与背诵机制见 [Study Notes 维护说明](docs/STUDY_NOTES.md)。

## 运行与部署

Astro 7、TypeScript、Content Collections、Sätteri Markdown、KaTeX。沿用现有依赖和锁文件，本轮没有升级框架或增加依赖。`npm run build` 执行 `astro check && astro build`；`npm test` 使用 Node 内置测试，要求先构建。建议 Node 22，与 CI 一致。

GitHub Actions 在 `main` 推送或手动触发时执行 `npm ci`、构建、测试，再上传 `dist` 部署到 GitHub Pages。`PUBLIC_BUILD_SHA` 写入页面便于辨认版本。不要提交 `dist`、`.astro`、`node_modules`。没有服务器端运行时或重定向服务；本轮没有 URL 迁移。

## 内容集合与公开规则

`src/content.config.ts` 注册三个集合：

- `blog_read`：`src/content/blog_read/*.{md,mdx}`，12 篇论文笔记。
- `blog_huawei_examination`：同名目录直属 Markdown，6 篇历史技术／算法笔记。
- `study_notes`：`src/content/837考研/**/*.md`，当前 18 篇学习笔记。

前两个集合不要扩大 glob，以免把忽略的嵌套来源档案也发布。博客 URL 始终为 `/blog/${post.id}/`；Study Notes 通过稳定 `studySlug` 生成 ID 与 `/study-notes/837/{slug}/`，不依赖本地中文目录名。

共享字段包括完整 `title`、`description`、`pubDate`、原始 `tags` 与有 schema 类型约束的 `category`、`subcategory`、`series`。`shortTitle`、`subtitle` 是可选视觉字段；不提供时不渲染占位，SEO、RSS、搜索仍保留完整标题。可选 `updatedDate` 表示真实更新时间，不自动以构建时间填充，也不替代首次发布日期。

常规文章公开条件：`!draft && !publicationHoldReason`。学习笔记还必须显式 `published: true`，默认不公开。统一通过 `getBlogPosts()`、`getPublicStudyNotes()`、`getAllPosts()` 获取公开数据，新增输出入口必须复用这些过滤条件。

2026-10-28，作者明确要求恢复 5 篇算法题解公开。复核未发现明确禁止公开的声明，已移除这 5 篇的 `draft` 与 `publicationHoldReason`，恢复原 URL 的完整正文及搜索／归档／RSS／sitemap。五篇不再含 `Huawei Examination` 来源标签（其中三篇本次移除，两篇此前已无）；Python I/O 文件及 tags 完全不变。正文、日期、分类、ID 与路径未改。通用草稿／暂缓机制继续保留供未来确有需要的内容使用：普通草稿不生成详情页，考试题解集合带 hold 的记录生成 noindex 通用提示页。不要通过删除通用过滤器来恢复某一篇文章。

当前快照：36 篇公开文章（12 论文、6 常规技术／算法、18 学习笔记），没有暂缓提示页，51 个 HTML 页面；RSS 36 项、sitemap 51 个页面 URL。数量来自集合，不要硬编码为业务规则。公开状态不代表复习完成或技术内容已经审校；网站隐藏也不会清除公开 Git 源码或历史。

## 数据、排序与入口

`src/lib/blog.ts` 集中处理公开文章、显示标题、集合限定键、URL、分类统计、时间分组、日期与索引数据。分类只展示实际有文章的项；界面通过 `taxonomyLabel` 显示中文，原始分类值不变。

- 首页：姓名、学校与专业、四个可点击方向名称、3 篇精选阅读与分组近期内容。已删除四句方向说明和总结性概述，不另补类似文案。近期论文取 3 篇，技术和学习各最多 2 篇，不显示空组；各组按 `pubDate` 倒序。
- `/blog/`：默认显示论文与常规技术笔记。分类／子分类／系列／tag 显式筛选或查询可覆盖学习笔记。支持列表、时间线，以及 `category`、`subcategory`、`series`、`tag`、`q`、`view=timeline` 查询参数。
- 普通列表、时间线按 `pubDate` 倒序；日期格式和年月分组使用 UTC，避免构建机器时区改变日期。搜索列表按相关度排序，同分按发布日期、URL 排序；带查询的时间线仍按日期分组。
- `/study-notes/`：按系列直接列出两个独立模块入口；`/study-notes/837/`：兼容旧链接的模块选择页。两处均不重复展开全部知识点。模块页分别为 `/study-notes/837/information-security/`（8 篇）、`/study-notes/837/network-security/`（10 篇），计数与列表均来自真实公开数据。文章返回链接、面包屑与章节页上级导航指向对应模块，模块内上下篇保持原考纲顺序。

旧论文日期继续使用已核对的 Feishu 创建日期（2024–2025），本轮未调整既有文章日期，仅按作者要求移除指定五篇题解的来源标签。下划线、中文历史 URL 保留；新页面使用英文连字符 slug。

## 837 模块、排序与背诵

`src/lib/study.ts` 注册 HIT 837 和两个并列模块：信息安全导论、网络安全基础，界面模块名分别为“信息安全”“网络安全”。`getStudyModuleSummaries()` 集中筛选、排序和动态计数，`getStudyModuleHref()` 集中生成模块链接。`StudyModuleLinks.astro` 复用模块选择，`StudyModule.astro` 只列出传入模块的章节／文章；`[series]/[slug].astro` 同时生成模块和既有文章路由，模块 slug 是保留 ID，重复使用会构建失败。`subject` 使用 schema 枚举。信息安全章节保留 `/chapter/01/`、`04/`、`05/`、`06/`；网络安全章节使用 `/chapter/network-security-01/`、`network-security-02/`、`network-security-03/`、`network-security-05/`，避免同号章节混合。当前共 8 个章节页。

课程顺序由系列 + 模块内唯一整数 `order` 决定，重复值构建失败；章节按两位数字编号排序，`syllabusSection` 只做可选展示。上下篇限制在同一模块，不按日期或目录字符串排序。

`Article.astro` 复用正文、目录与元数据。`recall.ts` 把已渲染节点移入嵌套原生 `details/summary`，基于 H2–H6 和独占段落的 `strong` 小标题生成折叠。阅读默认全展开，背诵初始全收起；子标题独立、父级保留子状态、批量控制、回到阅读恢复全文。TOC/hash 跳转展开祖先；无 JavaScript 仍显示完整静态正文。没有标题就不显示背诵控件。

旧 `questions` 元数据用于检索和构建校验，要求文本唯一匹配渲染标题。保留历史 `depth` 字段，但不再以它限制匹配：渲染层可能调整深度。新笔记不必编造一问一答。

新增 Web 攻击技术（2026-10-28）位于网络安全基础 → 01 网络攻击 → `1.d`，`order: 104`；URL `/study-notes/837/web-attack-techniques/`，前篇为格式化字符串／缓冲区溢出，后篇现为网络数据包的捕获。该篇没有本地附件，正文未改写。

## Markdown、标题与阅读

`astro.config.mjs` 沿用 `@astrojs/markdown-satteri`，原生启用 math，KaTeX 在构建时渲染为 HTML + MathML；CSS 与字体本地打包，无 CDN。`trust: false`，公式语法错误使构建失败。代码沿用 Shiki，在已有 `@shikijs/core` 的 CSS variables theme 上统一使用 `--syntax-*` 令牌，随主题变量变化，无额外依赖。

`src/plugins/article-headings.mjs` 是每文档独立的 AST 插件工厂：使用已有 `github-slugger` 按原序分配 ID；首次标题若为同名 H1，以空锚点代替；其他 H1 及其后续标题树降一级，最多 H6。原本正确且未受 H1 章节树影响的 H2/H3 不变。它只处理 Markdown，不修改模板 H1 或 Markdown 源文件；已规范的 AST 无 H1，不会再次持续降级。既有标题 ID 和重复后缀保留。修改时须跑标题、锚点与公式／代码测试。`article-presentation.mjs` 为独立的 HAST 显示层插件：将 H2–H6 中的 ⭐ 包在带“重点”替代文字的徽标中，保留原始 `textContent`、ID 和 metadata。`HeadingText.astro` 对目录做相同处理，既有 questions 唯一匹配校验不变。

文章维持约 740px 正文、桌面 sticky H2/H3 TOC、移动折叠目录、完整描述／日期／tags 与可选更新时间；本轮去除粗略阅读时长。`article.ts` 实现目录高亮、代码复制与失败回退。复制只读取 `code.textContent`，失败时选中文本并提示手动复制。长代码、表格、块公式可横向滚动，图片按原比例展示。

SVG 沿用 Astro 本地图片管线，不内联任意 SVG 源码、不转换低清位图；白底保证原图深色文字在暗色主题可见，脚本提供查看原图入口。文章末尾勘误链接使用已核实的项目 Issues 地址，预填标题与 canonical，不自动发送。未配置 Giscus。

## 全文搜索与偏好

`/search-index.json` 在构建时仅输出公开文章。包括完整标题、可选视觉标题、描述、原始分类／tags、中文分类名、课程信息、日期、URL，以及剥离展示标记后的正文文本。`searchText` 是元数据，正文单独保存，避免重复体积。

全站仅有 Header 常驻搜索，`site-search.ts` 与归档 `notes.ts` 共享 `search.ts` 的延迟加载和排序。首页不内嵌／主动下载正文；归档内嵌轻量元数据，出现查询时才加载全文索引。加载失败可重试。结果通过 `textContent` 创建，原始 Markdown 不作为搜索 HTML 注入。

匹配使用 NFKC、大小写归一化、空白分词 AND、连续中文子串。排序优先精确／部分标题，其次标签、分类、描述和正文；同分日期倒序再按 URL。不是语义搜索，不提供同义词或错字纠正。命中正文可展示摘要。全文索引体积随公开内容变化，本轮具体数据见设计精修记录；小语料下沿用现有检索，未引入 Pagefind，未进行 Pagefind 实测对比。

Cmd/Ctrl+K 聚焦搜索；Escape、离开控件或点击外部关闭结果，方向键导航链接。表单提交和“全部结果”跳转 `/blog/?q=...`；归档筛选和视图切换保留查询。无 JS 时表单仍会导航，但动态全文结果／筛选需要 JS，完整静态阅读不受影响。

首屏 head 脚本应用主题，`typography.ts` 支持浅色、深色、跟随系统、字号与加粗。持久化键 `duolabmeng673:theme:v2`，兼容 v1 显式选择；存储失败仍可阅读，系统模式监听 OS 变化。

## SEO、订阅与设计约束

`BaseLayout.astro` 提供 `zh-CN`、统一 title 分隔符、description、canonical、OG、Twitter。文章为 `article` 类型，包含真实发布／可选更新日期。默认分享图 `public/og-default.png` 为 1200×630，保留 SVG 编辑源，不逐篇生成重复封面。

`sitemap.xml.ts` 使用公开数据与真实入口／章节路径生成静态 XML；hold 不纳入。`lastmod` 只使用明确 `updatedDate`。`rss.xml.ts` 输出公开文章标题、描述、日期和 canonical，XML 统一转义，布局提供订阅发现链接。`robots.txt` 指向 sitemap。没有增加服务或生成器依赖。

## Visual system

沿用 `global.css` 的既有变量名。当前根据作者的暖调参考图统一全站：浅色 `--bg: #f7f5ef`，`--surface: #fbfaf6`，`--surface-raised: #ffffff`，`--surface-soft: #eee9dd`，`--text: #2a2622`，`--text-soft: #453f38`，`--text-muted: #6b645a`，`--border: #e2dccf`。暗色背景 `#181614`，表面 `#201d1a`／`#282420`，柔和表面 `#26221e`，正文 `#ece7dd`，辅助文字 `#a39b8c`，分隔线 `#34302a`。主青绿保持 `#0e6b5c`／`#4db6a0`，用于主按钮、链接、悬停／聚焦动作与焦点，不再铺满装饰元素。

新增共享令牌：`--nav-active: #ebe5d8`／`#2c2722`，选中导航使用正文色；`--row-hover: #eee9dd`／`#2c2722`，用于列表与搜索结果悬停底；`--border-control: #cfc8ba`／`#4a443b` 为胶囊、主题和字号入口的轻轮廓，文字／图标本身保持高对比，搜索输入框和需明确边界的控件继续使用 `--border-strong: #8a8378`／`#7d766a`。不要将低对比的轻轮廓宣称为 3:1 控件边界。

分类色仅用于小圆点，不用于正文或整行背景。固定映射：Research → `--cat-research: #4161ad`／`#8ca7e2`（墨蓝），Computer Science → `--cat-tech: #b95330`／`#e08a66`（赤陶），Study Notes → `--cat-study: #9a7100`／`#d6b35d`（赭黄）。由 `data-category` 统一设置 `--category-color`，首页索引／方向胶囊／文章列表、Notes／Timeline、搜索结果、学习模块入口和文章分类路径共用。普通眉题、副标题与分类文字仍为暖灰色。关注方向胶囊使用主文字色，前三项映射论文，最后一项按既有学习模块目标映射学习，链接未改。

站名后的点使用 `--warm`，重点徽标继续使用 `--warm-text`／`--warm-soft`；正文列表点、索引竖线、精选顶线、年份标题、引用块、About 辅助信息改为暖中性。文章可点击链接与当前目录项保留青绿；代码高亮用暖墨色层级和原有字体样式，避免静态代码大面积绿色。KaTeX 随正文继承颜色；SVG 保留 `--svg-bg: #ffffff`。KMP 派生嵌入文档自动读取这套根令牌，原插图和源内容不变。现行对比度计算见 [对比度数据](docs/design-contrast.csv)，取代此前配色数值；静态样式检查不能替代真实浏览器验收。

字体角色保持 serif 标题、sans 正文、等宽代码。主容器 1120px、正文最大 740px，默认正文 1.04rem（16.64px）／1.8 行高，移动端 16px／1.85；段间距 1em，用户字号及加粗仍可覆盖。引用统一暖中性浅底与 2px 左边界；表格在自身容器横向滚动（包括列表内表格），表头浅底、细行线、无斑马纹。圆角至多 8px，保留 focus、skip link、reduced-motion。

首页 Hero 为“杨雨飞 → 哈尔滨工业大学 · 信息安全 → 主操作”，品牌名保留在顶栏。关注方向为可换行的紧凑链接标签；精选仍取 survey、CLIP、Python I/O，首篇更突出；三个近期分组保持全宽、纵向排列，以容纳中英文长标题并统一日期列，组内眉题不重复分类名，副标题紧跟标题。详情页目录结构未重做。

主题按钮按 System → Light → Dark 循环，原存储键、head 防闪烁脚本和系统监听不变。隐藏的主题状态文字提供当前模式，键盘可操作。搜索、主题与字号入口统一 40px 高度、5px 圆角；搜索为明确边界，主题／字号入口为轻轮廓；Mac 显示 Cmd K，其他平台 Ctrl K，触屏隐藏快捷键。站内箭头为 →，外链保留 ↗。

Header 在 950px 断点让搜索进入第二行，移动端保持常驻搜索，不压缩主题／导航来强行单行；800／520px 等断点继续适配正文。头像仅出现在 About，使用 `public/github-avatar.png` 本地静态文件；首页没有头像，不新增一个。已核验 Git remote 与账号为 `duolaBmeng673`，官方来源为 `https://github.com/duolaBmeng673.png?size=192`。本轮网络域名解析失败，获授权的网络重试又被自动审批服务模型配置错误拒绝，因此没有获取到新头像，保留原文件及引用。它不会自动同步 GitHub。网络恢复后先下载官方 PNG 到临时文件，确认最终响应和图片格式／尺寸、实际查看后，再替换 `public/github-avatar.png`，执行构建并检查 About。不要把失败响应或占位图保存为头像。

## 验证与内容保护

基本回归：`npm run build`、`npm test`、`git diff --check`。测试覆盖 AST 标题与锚点、代码／表格／公式节点、中文与混合全文检索、相关度、构建后的公开边界、元数据、资源与新文章接入。CI 同样先构建再测试。

检查所有旧博客路径、新文章、模块上下篇、查询状态、TOC、SVG、公式与无 JS 阅读。浏览器验收须覆盖 1440／1024／768／390／320px 明暗主题、真实键盘／复制／系统主题联动。本轮构建、静态／DOM 与样式匹配检查通过；真实浏览器仍无法运行：应用内浏览器禁用，本机 Chrome 启动失败，网络提升又受自动审批服务配置异常阻塞。不能用样式匹配或构建成功替代真实视觉验收。

不随意改写技术文章的实质内容；允许最小修复标题层级、错别字、内部链接及必要元数据。涉及技术观点、实验结论或核心论述的修改须有明确依据并记录原因。修改日期、URL、tags 或公开状态须说明影响并验证兼容。来源不明的受限考试材料优先暂缓公开，不宣称改写即可消除风险。

元数据迁移前后仍应逐篇比对正文和资源，防止意外截断、换行规范化或图片引用变动；若有有意的正文修复，单独记录。上一轮（2026-10-28）验证 134 个原有内容／资源文件完整，只有 5 篇题解的 Front Matter 变更，正文与其余内容资源字节均不变；Python I/O 完全不变，未移动或删除内容。本轮保护结果见下节。

## 2026-10-29 内容同步与 KMP

作者本轮允许先修改内容目录完成正式接入，再冻结内容进行主题设计。6 篇新笔记只增加 Front Matter：网络数据包的捕获（2.a／201）、包捕获机制（2.b／202）、数据链路层编程接口（2.c／203）、主机发现技术（3.a／301）、端口扫描（3.b／302）、KMP 算法（5.a.1／501）；显式公开日期 2026-10-29。全部归属网络安全基础，schema 与 stable studySlug 机制不变；未使用运行时外置导入元数据。已有 Snort 更新由作者提供，本轮原样保留。

KMP 文章在原动画所在位置，由 `article-presentation.mjs` 将上传的 `kmp_step_by_step.html` 派生为同页 iframe：仅该页加载手动演算脚本，sandbox 仅允许脚本、不授予同源权限，不请求外部服务。使用本站主题令牌、图形与 next 表格内部横向滚动，无自动播放或过渡动画。支持上一步、下一步、重置和左右方向键；保留原 SVG 为默认收起的备用入口。HTML、SVG 与 Markdown 源文件均未改写。若更新原 HTML，需要复核脚本没有新增外部请求、嵌入仍匹配固定图片引用，并重新运行构建与演算检查。

本轮初始快照含 145 个内容／资源文件（包含作者未提交的 Snort 修改）；6 篇新 Markdown 的正文与原始上传逐字节一致，其他 139 个文件完整。迁移后再次建立 145 文件快照，主题阶段全部字节不变。因此相对 Git HEAD 的内容 diff 仍会包含作者原有 Snort 编辑与新增文件，这是已授权的同步阶段变更，不能为追求空 diff 将它们回滚。未更改原文日期、tags、路径、URL 或既有标题锚点。

构建与 12 项现有测试通过；现有测试只更新网络模块的过期文章列表，并使主文档的 H1 检查忽略 iframe 的独立 srcdoc 文档。没有新建测试框架／测试套件。额外一次性校验脚本放在临时目录：51 路由、486 个正文标题及 ID、877 个站内锚点、137 个代码块、84 个公式节点、公开边界、18 篇背诵 DOM、主题与搜索脚本、KMP 手动演算。原生浏览器／截图验收未执行成功，不能宣称五种宽度已无视觉溢出。具体阻塞及 JS gzip 比较见本轮记录。
