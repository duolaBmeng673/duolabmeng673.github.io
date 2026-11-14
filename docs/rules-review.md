# 联动规则核实与确认记录

【用户决定】用户已于 2026-11-14 回答草稿中的三项问题，根 [AGENTS.md](../AGENTS.md) 与四份细则据此更新并启用。本页保留证据、确认结果与后续建议，不是额外规则。此次启用只修改六份规则文档，不修改博客功能、正文、发布日期、分类、活动数据或词典，不执行 Git 提交、推送或部署。

## 已核实的证据索引

【已核实】核实日期：2026-11-14。以下事实以当前源码为准，不将历史交接记录中的数量当成当前常量：

| 范围 | 实际证据 | 已核实结果 |
|---|---|---|
| 命令与发布 | [package.json](../package.json)、[README](../README.md)、[deploy.yml](../.github/workflows/deploy.yml) | build 含 astro check；测试先构建；CI Node 22；push main／手动工作流才部署 |
| 内容集合与字段 | [content.config.ts](../src/content.config.ts)、[blog.ts](../src/lib/blog.ts)、[study.ts](../src/lib/study.ts) | 两个技术集合与一个学习集合；不同公开条件；全局日期排序与学习模块 order 排序分开 |
| 标签 | [knowledge-entries.json](../src/data/knowledge-entries.json)、[tags.json](../src/data/tags.json)、[knowledge-tags.ts](../src/lib/knowledge-tags.ts) | 独立标签字段与唯一词典；缺项报错、未用项警告；不覆盖原 tags |
| 展示与过滤 | [KnowledgeDirectory](../src/components/KnowledgeDirectory.astro)、[KnowledgeChips](../src/components/KnowledgeChips.astro)、[knowledge-directory.ts](../src/scripts/knowledge-directory.ts) | 标签交集、URL 恢复与类别视觉高亮；模块、文章及全局列表联动 |
| 主题与图例 | [global.css](../src/styles/global.css)、[knowledge-tags.css](../src/styles/knowledge-tags.css)、[BaseLayout](../src/layouts/BaseLayout.astro)、[site-header.ts](../src/scripts/site-header.ts) | 暖中性色与青绿交互；当前 1500px 图例断点；顶栏向下隐藏、向上显示 |
| 热力图 | [首页](../src/pages/index.astro)、[ActivityCalendar](../src/components/ActivityCalendar.astro)、[activity.ts](../src/lib/activity.ts)、[activities.ts](../src/data/activities.ts) | 公开首发自动计 Writing + 手工记录；五类活动；没有按 Git 提交自动记数 |
| 回归检查 | [tests](../tests/) | 内容、标签、活动、搜索、顶栏、工具和生成产物的现有 Node 测试 |
| 既有说明 | [STUDY_NOTES.md](STUDY_NOTES.md)、[TECHNICAL_HANDOFF.md](../TECHNICAL_HANDOFF.md) | 补充背景和历史接入记录；带日期快照不可替代源码核实 |

## 用户确认结果

- 【用户决定】**顶栏**：保留当前“下滑隐藏、上滑显示”，覆盖旧草稿中“全站 sticky 常驻”的可见性要求；sticky 定位、焦点保护及无 JS 回退保持原实现。规则见 [设计令牌](design-tokens.md#用户决定)。
- 【用户决定】**标签来源**：“你自动提取，给我建议，我来修正/确认”，覆盖旧草稿中“标签内容与分类由我手工提供”的来源限制；保留禁止机械拆句、新增类别及擅改已确认标签的约束。流程见 [标签维护步骤](tag-taxonomy.md#维护步骤)。
- 【用户决定】**algorithm**：保留现有归类；规则扩展为“有输入输出、能计算的方法，包括密码算法、字符串匹配算法、聚类与分类算法等”。机器学习中的决策树、朴素贝叶斯等“模型”归 `algorithm`，`model` 仅指访问控制与安全模型。规则见 [归类易混点](tag-taxonomy.md#归类易混点)。
- 【用户决定】其余已确认的七类 ID／图例文字、独立字段、标签尺寸及浅色色值保持不变。原先三项问题已关闭；新增的数据修正建议单独列在文末，不自动改动已有映射。
- 【用户决定】根文件精简，详细字段、颜色与活动流程分别放细则；以后变更工作流须同步根文件与对应细则，冲突先问用户。
- 【用户决定】回复末尾必须附「联动清单结果」，逐项标记已做／不适用／未做并说明；存在未做项不得声称任务完成。

## 已核实的机制缺口

【已核实】以下是对仓库中“未发现”的范围说明，不是要求本轮补写新功能。若需要建立这些机制：仓库中未发现，请用户确认。

- 一键笔记同步／正文哈希保护／热力图更新专用命令：[package.json](../package.json) 没有这些脚本；现有测试有定向保护，不能说完全没有内容测试。
- Git commit → 有效活动的自动采集、Contributions 导入或更新 hook：[活动代码](../src/lib/activity.ts)、[手工数据](../src/data/activities.ts)、[工作流](../.github/workflows/deploy.yml) 中没有这条自动链路。
- 所有新文章必须配知识点的反向构建约束，以及通用 JSON 重复键／同义词校验：[knowledge-tags.ts](../src/lib/knowledge-tags.ts) 只有现有配置到公开文章的验证，其他由现有定向测试与人工复核覆盖。
- 固定统计时区：自动首发取 UTC 日期串，窗口按运行环境本地日期；[activity.ts](../src/lib/activity.ts) 和 [ActivityCalendar](../src/components/ActivityCalendar.astro) 没有统一固定时区配置。

## 草稿编写阶段验证（2026-11-14，上一轮）

【已核实】以下是上一轮草稿编写时执行的记录，不作为本轮启用时重新运行的结果：

- `npm run build` 通过：`astro check` 为 0 errors、0 warnings、3 hints，静态构建 72 页；提示来自既有 `execCommand` 弃用及两处多余 await，本轮未改这些源文件。
- `npm test` 通过：41 项通过、0 失败；包含标签缺项报错／未使用警告、现有活动与日期边界、顶栏和搜索的回归测试。
- `git diff --check` 通过；另行检查六个未跟踪草稿的尾空白、216 个本地链接与目标锚点，均通过。七条指定决定逐字保留；根文件 62 行，未超过约 150 行限制。
- 动笔前对 255 个已跟踪文件建立 SHA256 基线，复核均未改变；Git 状态只有六个新增草稿。文章、日期、路由、分类、依赖／锁文件及活动数据未修改。
- 本轮没有修改界面，不重新执行 Safari／Chrome 及四个宽度的视觉验收；这些是未来相关改动的验收要求，不能记为本次已经实测。

【已核实】命令依据：[package.json](../package.json)；提示位置为 [article.ts](../src/scripts/article.ts)、[blog.test.mjs](../tests/blog.test.mjs)，测试入口为 [tests/](../tests/)。草稿阶段临时基线不作为仓库已有的保护脚本。

## 规则启用阶段验证（2026-11-14，本轮）

【已核实】启用前已保护 255 个跟踪文件及六份现有草稿；复核只有这六份文档变化，原有 255 个跟踪文件哈希全部不变。`git diff --check`、未跟踪文档尾空白及 219 个本地链接／锚点检查均通过；根文件 62 行，已去除有效规则中的未启用与争议措辞。未修改代码／内容链路，不重复运行 build／test，也不将上一轮通过结果冒充本轮执行；未修改界面，不重复浏览器验收。

## 待确认

【待确认】原草稿的三项规则问题均已确认；以下只有一条新发现的数据修正建议，不阻碍已确认规则启用，不自动改变现有标签数据。

1. **“决策树”的既有映射**：[tags.json](../src/data/tags.json) 当前为 `"决策树": "struct"`，与新规则不一致。建议将该项改为 `algorithm`，保留标签名称和条目引用；“朴素贝叶斯”已是 `algorithm`。按本次“保留现有归类”要求，词典本轮不动，待用户确认这项修正后另行落地并验证。
