# duolaBmeng673 的技术博客

[访问博客](https://duolabmeng673.github.io/) · [技术笔记](https://duolabmeng673.github.io/blog/) · [HIT 837 学习笔记](https://duolabmeng673.github.io/study-notes/837/) · [RSS](https://duolabmeng673.github.io/rss.xml)

杨雨飞的个人笔记，整理信息安全、语言模型、多模态、表格理解与算法学习内容。使用 Astro 7、TypeScript 和 Markdown，静态部署到 GitHub Pages。

## 本地运行

使用 Node.js 22 与 npm：

```sh
npm ci
npm run dev
```

构建、检查与预览：

```sh
npm run build
npm test
git diff --check
npm run preview
```

测试包含构建产物检查，运行 `npm test` 前须先完成构建。推送到 `main` 后，GitHub Actions 安装依赖、构建、测试并部署 `dist/`；本地构建本身不会发布网站。

## 内容与功能

- `src/content/blog_read/`：论文笔记，读取目录直属 Markdown。
- `src/content/blog_huawei_examination/`：算法与输入输出笔记，读取目录直属 Markdown；目录名是历史内部归档名。
- `src/content/837考研/`：按原始目录保存的学习笔记与图片，递归读取 Markdown。
- `src/content.config.ts`：元数据、分类、公开状态与课程字段约束。
- `src/lib/`：公开文章数据、分类、课程顺序、全文搜索及 XML 工具。
- `src/components/Article.astro`：共享文章模板、目录、学习导航与背诵入口。
- `src/plugins/article-headings.mjs`：渲染时规范正文标题，保留原始锚点。
- `src/pages/`：页面，以及静态搜索索引、sitemap、RSS。
- `public/`：头像、分享图、站点图标及公开静态资源。

提供亮色／暗色／跟随系统主题、字号与加粗设置、中文全文搜索、列表／时间线筛选、目录、代码复制、KaTeX 公式、SVG 插图和按标题折叠背诵。

学习入口直接区分[信息安全](https://duolabmeng673.github.io/study-notes/837/information-security/)与[网络安全](https://duolabmeng673.github.io/study-notes/837/network-security/)，旧 837 地址保留为模块选择页。技术归档默认展示常规笔记；搜索与显式分类／标签／系列筛选覆盖全部公开文章。课程目录与上下篇按课程 `order` 排序；普通列表与时间线按发布日期倒序，搜索列表按相关度排序。

## 内容维护与公开边界

新增学习笔记请参阅 [维护说明](docs/STUDY_NOTES.md)。学习笔记必须显式设置 `published: true`，且不得为 `draft` 或带有 `publicationHoldReason`，才进入网站。常规笔记同样尊重后两个字段。

当前六篇算法／I/O 笔记均按作者要求公开。若未来确有内容需要暂缓公开，可使用草稿／hold 字段；带 hold 的历史题解保留提示页并排除搜索、RSS 与 sitemap。**这些字段只控制网站构建，不会隐藏 Git 仓库里的源文件或历史。** 不要提交私人资料、凭据或不应公开的材料。

不随意改写文章实质内容或调整旧日期、URL、tags。必要的标题层级、错字、内部链接和元数据修复应保持最小范围；涉及技术结论的改动须有明确依据并记录。

[技术交接](TECHNICAL_HANDOFF.md) · [定向优化记录](docs/REFINEMENT.md) · [此前审计](docs/BLOG_AUDIT.md)

发现错误可使用文章末尾的勘误入口，或在[项目 Issues](https://github.com/duolaBmeng673/duolabmeng673.github.io/issues)中附上文章链接与问题说明。
