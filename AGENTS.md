# 仓库联动规则

【用户决定】2026-11-14 确认启用；每次改动前读取本文件及命中的细则，改动后按触发表自查。本规则不授权提交、推送或部署。
顶栏保留“下滑隐藏、上滑显示”；标签先自动提取并提出建议，由用户修正／确认后落地。依据及后续建议见 [确认记录](docs/rules-review.md)。

## 项目概览

- 【已核实】Astro 7、TypeScript、Markdown 静态博客；依赖与渲染配置见 [package.json](package.json)、[astro.config.mjs](astro.config.mjs)。
- 【已核实】论文、算法／I/O、837 学习笔记为三个内容集合；加载范围与 schema 见 [src/content.config.ts](src/content.config.ts)。
- 【已核实】公开数据供目录、首页、搜索、RSS、sitemap 及首次发布活动复用，入口见 [src/lib/blog.ts](src/lib/blog.ts)、[src/lib/study.ts](src/lib/study.ts)。
- 【已核实】GitHub Pages 工作流构建 `dist/`；本地构建不发布。见 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)。

## 常用命令

【已核实】依据 [package.json](package.json)、[README.md](README.md)、[部署工作流](.github/workflows/deploy.yml)。CI 使用 Node.js 22；测试依赖构建产物，先 build 后 test。

```sh
npm ci                  # 需要安装依赖时执行
npm run dev             # 开发服务器
npm run build           # astro check && astro build
npm test                # Node 测试，包含 dist 检查
git diff --check        # Git 补丁空白检查
npm run preview         # 预览已构建的 dist
```

## 联动触发表

【用户决定】改动前检查 Git 状态并保护已有修改；改动后逐行判断适用性。【已核实】代码事实与【用户决定】规则分开标注，未确认建议不当成已批准数据。

| 改动类型 | 必须同时做的事 | 验证方式 |
|---|---|---|
| 【用户决定】新增／修改目录知识点标签 | 先从正文自动提取标签及归类建议，交用户修正／确认后维护 [knowledge-entries.json](src/data/knowledge-entries.json) 与唯一 [tags.json](src/data/tags.json)；字符串逐字一致，按 [标签规则](docs/tag-taxonomy.md) 归类；不改原文章 tags，不自动替换已确认数据。 | 【已核实】[knowledge-tags.ts](src/lib/knowledge-tags.ts) 对缺项报错、未使用项警告；build + test，并看目录、文章与全局列表。 |
| 【用户决定】新增类别／修改类别颜色 | 类别扩展须先问用户；批准后同步 [类别定义](src/lib/knowledge-tags.ts)、CSS 浅深色变量、图例，以及 [标签规则](docs/tag-taxonomy.md) 和 [设计令牌](docs/design-tokens.md)。 | 【已核实】[KnowledgeDirectory](src/components/KnowledgeDirectory.astro) 从类别定义生成图例；build + test，浅／深色检查标签与图例同色。 |
| 【用户决定】正文最大宽度／顶栏高度或显隐变化 | 按 [设计令牌](docs/design-tokens.md) 重算图例断点；同步 [CSS](src/styles/knowledge-tags.css) 与 [matchMedia](src/scripts/knowledge-directory.ts)；复核 `--header-h` 实测与 `--header-offset`、锚点及 TOC。 | 【用户决定】1100 / 1208 / 1280 / 1440px 各验一次，并测实际断点两侧；顶栏、图例、浮钮互斥规则与正文宽度均正确。 |
| 【用户决定】新增／修改学习笔记 | 按 [笔记规则](docs/notes-rules.md) 校验 schema、稳定 studySlug、subject、章节和 order；核对目录条目与独立标签。按 [热力图规则](docs/heatmap.md) 区分首次发布、实质更新与不计数修改。 | 【已核实】[study.ts](src/lib/study.ts) 自动分组计数；build + test，查看所属模块／章节、上下篇、全局标签展示、搜索与对应活动日期。 |
| 【用户决定】新增／修改技术笔记 | 按 [技术笔记规则](docs/notes-rules.md#技术笔记) 放入正确集合，保留原 ID／URL、完整 title、日期与原始 tags；核对归档、搜索、RSS、sitemap；按热力图规则判断是否手工补记录。 | 【已核实】[blog.ts](src/lib/blog.ts) 统一公开过滤与日期排序；build + test，技术归档与文章可访问，首次发布没有重复手记。 |
| 【用户决定】任何会影响热力图的改动／提交 | 【已核实】先核对自动首次发布记录；额外的真实活动只维护 [activities.ts](src/data/activities.ts)，不按 commit 数计活动、不改 pubDate 造更新。步骤见 [热力图规则](docs/heatmap.md)。 | 【已核实】[activity.test.mjs](tests/activity.test.mjs) 检查聚合／边界；build 后 test；核对首页格子、当日明细、活跃天数与总次数。 |
| 【用户决定】设计令牌（字号／圆角／颜色） | 同步 [设计令牌](docs/design-tokens.md)，复用 [global.css](src/styles/global.css) 与 [knowledge-tags.css](src/styles/knowledge-tags.css)；不要把目录标题 22px 误用于全站标题。 | 【用户决定】浅／深色及窄屏视觉检查；目录标题 22px、标签 12px／400 的层级保持，触屏标签不小于 32px 高。 |
| 【用户决定】知识点展示、文章模板或搜索变化 | 复核同一份标签在目录、文章、首页、全局列表／时间线、搜索候选中的联动；保留 SEO 描述与原始 tags，避免嵌套交互元素。见 [笔记规则](docs/notes-rules.md)。 | 【已核实】[knowledge-tags.test.mjs](tests/knowledge-tags.test.mjs)、[site-search.test.mjs](tests/site-search.test.mjs)；再看原生跳转、URL 筛选、键盘及无 JS 阅读。 |
| 【用户决定】仅格式／空白／Front Matter 元数据／规则文档维护 | 【已核实】这类变更不自动产生额外活动；[活动文件注释](src/data/activities.ts) 明确排除元数据与格式修改。纯文档不冒充博客功能完成事件。 | 【用户决定】确认无额外活动与意外正文修改；检查新增文档路径和补丁，按影响范围说明未运行的验证。 |

## 完成定义

【用户决定】每次改动：

1. 只实施已授权范围；保护已有修改、正文与资源，未经确认不改日期、URL、分类，不新增依赖或清理无关文件。
2. 命中代码／内容链路时先 `npm run build`，再 `npm test`；执行 `git diff --check`。检查新增未跟踪文件，不能把未跟踪文件遗漏当成检查通过。
3. 界面变动检查明暗主题、窄屏与键盘／触屏；不能用构建通过代替浏览器验收。无法实测的项目如实列出。
4. 每次完成改动后，回复末尾必须附「联动清单结果」：对照触发表逐项标记 已做 / 不适用 / 未做（并说明原因）。有任何一项未做，不得声称任务完成。

## 规则维护要求

【用户决定】工作流发生变化时，必须在同一次提交中更新 AGENTS.md 与对应 docs；这不构成自动执行 Git 提交的授权。
【用户决定】保持 AGENTS.md 精简；新增内容前先检查是否能合并到已有行。
【用户决定】规则之间出现冲突，或遇到本表未覆盖但可能需要联动的改动，先问我，不要自行决定。
【用户决定】新的候选标签或历史数据修正建议先交用户确认；未确认事项集中记录，不作为已生效的数据变更。

- [标签规则](docs/tag-taxonomy.md)：七类、决策顺序、词典及校验边界。
- [设计令牌](docs/design-tokens.md)：配色、尺寸、顶栏、图例与断点联动。
- [笔记规则](docs/notes-rules.md)：三个内容集合、schema、公开与路由／排序。
- [热力图规则](docs/heatmap.md)：实际数据来源、计数口径和更新／发布路径。
- [核实与确认记录](docs/rules-review.md)：证据清单、用户确认、后续建议与验证记录；不作为额外规则。
