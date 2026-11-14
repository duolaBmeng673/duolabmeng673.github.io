# 知识点标签规则

【用户决定】2026-11-14 确认启用，配合 [AGENTS.md](../AGENTS.md) 执行。保留现有归类；新的标签或归类修正先由代理给出建议，再由用户修正／确认，不自动重分现有数据。确认记录与后续建议见 [rules-review.md](rules-review.md)。

## 用户决定

【用户决定】以下为本次确认后的有效规则；标签来源与 algorithm 范围已按用户最新决定更新：

- 标签：每个条目的标签只写名称；类别由全局词典 tags.json 统一管理，一个标签只出现一次、只属于一个类别。七类为 concept / algorithm / protocol / model / struct / threat / defense，图例文字为「概念 / 原理、算法 / 体制、协议 / 流程、模型 / 策略、结构 / 组件、威胁 / 攻击、防护 / 检测」。
- 归类决策顺序（命中即停）：攻击或恶意程序 → threat；阻止或发现攻击 → defense；多方按步骤交互 → protocol；有输入输出、能计算的方法，包括密码算法、字符串匹配算法、聚类与分类算法等 → algorithm；访问控制与安全模型（如定义访问权限的规则体系）→ model；系统里的具体数据对象或部件 → struct；其余 → concept。
- 标签内容与分类先由代理从正文自动提取并给出建议，由用户修正／确认；不要用标点自动切分描述句，不要自行新增类别或改写已确认标签。未确认建议不直接写入正式条目或词典。

【用户决定】知识点标签使用独立字段，不与文章原有 tags 混用。

## 归类易混点

- 【用户决定】`algorithm`：有输入输出、能计算的方法，包括密码算法、字符串匹配算法、聚类与分类算法等。
- 【用户决定】机器学习中的决策树、朴素贝叶斯等“模型”归 `algorithm`，不能只因名称或说明中含“模型”就归入 `model`。
- 【用户决定】`model` 仅指访问控制与安全模型，例如 DAC、MAC、RBAC、Bell-LaPadula、Biba；不泛指机器学习模型。具体数据对象或部件归 `struct`，不要把分类方法与其内部部件混为一谈。
- 【已核实】用户于 2026-11-14 明确确认后，[现有词典](../src/data/tags.json) 中“决策树”由 `struct` 修正为 `algorithm`；“朴素贝叶斯”原本即为 `algorithm`。标签名称与文章引用均保留，确认结果见 [rules-review.md](rules-review.md#归类修正确认)。

## 已核实的数据与职责

- 【已核实】[src/data/knowledge-entries.json](../src/data/knowledge-entries.json) 以稳定文章 ID（学习笔记的 `studySlug`）为键，值只维护 `section` 和按显示顺序排列的 `knowledgeTags` 名称数组；未把类别复制进每篇 Markdown。
- 【已核实】[src/data/tags.json](../src/data/tags.json) 是唯一名称到类别的词典；同一标签可被多篇文章引用，“只出现一次”指词典只维护一个键，不是全站只能引用一次。
- 【已核实】[src/lib/knowledge-tags.ts](../src/lib/knowledge-tags.ts) 的 `knowledgeCategories` 定义七类 ID、图例文字和顺序；`getKnowledgeTags()` 连接条目与词典，提供渲染用的 `{ name, category }`。
- 【已核实】原文章 `tags` 仍由 [src/content.config.ts](../src/content.config.ts) 定义；[src/lib/blog.ts](../src/lib/blog.ts) 输出独立的 `knowledgeTags` 字段并将名称加入全局检索文本，未覆盖原 `tags`。

【已核实】现存条目片段来自 [src/data/knowledge-entries.json](../src/data/knowledge-entries.json)，不是新增的演示活动或新文章：

```json
{
  "symmetric-authentication-kerberos": {
    "section": "3.a",
    "knowledgeTags": ["挑战—应答", "重放防护", "对称 Needham–Schroeder", "Kerberos 认证流程", "票据"]
  }
}
```

【已核实】对应词典将上述协议标签归入 `protocol`、重放防护归入 `defense`、票据归入 `struct`。证据：[src/data/tags.json](../src/data/tags.json)。保留 `–`（如 `Needham–Schroeder`）与 `—`（如 `挑战—应答`）的逐字差异。

## 已核实的构建校验与边界

- 【已核实】[validateKnowledgeTags](../src/lib/knowledge-tags.ts) 导入时验证：未知类别报错；条目用到的词典缺项汇总报错；词典中未被引用的标签警告，不静默兜底。
- 【已核实】[validateKnowledgePosts](../src/lib/knowledge-tags.ts) 经 [getPublicStudyNotes](../src/lib/study.ts) 调用：所有已配置 ID 必须匹配公开文章，`section` 必须等于 `syllabusSection ?? syllabusChapter`。因此将已有标签文章转草稿／暂缓公开时，也要处理独立标签配置，不能仅改 `published` 后忽略构建失败。
- 【已核实】校验是“配置 → 公开文章”方向；没有反向强制每篇新文章必须配标签。没有标签时 [StudyNoteList](../src/components/StudyNoteList.astro)、[StudyPostRow](../src/components/StudyPostRow.astro)、[Article](../src/components/Article.astro) 会退回描述展示；不能把这个回退说成已完成标签接入。
- 【已核实】[tests/knowledge-tags.test.mjs](../tests/knowledge-tags.test.mjs) 校验当前 35 篇覆盖、条目内不重复、原先批准的 8 组／47 项哈希、词典项、渲染及过滤。新增文章须更新覆盖预期；原批准数据变更须先获授权，不能为使测试通过而直接重算保护哈希。
- 【已核实】当前测试检查解析后的词典与标签；仓库中未发现专门检测原始 JSON 重复键、同义词或连字符近似项的通用 lint。依据：[package.json](../package.json)、[src/lib/knowledge-tags.ts](../src/lib/knowledge-tags.ts)、[tests/knowledge-tags.test.mjs](../tests/knowledge-tags.test.mjs)。

## 维护步骤

【用户决定】自动提取负责提出建议，用户负责修正／确认；不将提取结果当成已批准数据：

1. 阅读文章正文、现有条目和词典，按知识点语义自动提取候选；不按标点、“与”或“及”机械拆分描述句，优先复用现有一致写法。
2. 按文章给出候选标签、建议类别与正文出处；已有归类不符时单列修正建议，不静默替换。
3. 等用户修正／确认后再落地；条目只列名称，词典只维护一次归类，保留原始文章 `tags`、日期及正文。不自行加第八类或改写已确认字符串。
4. 校验文章 ID 与考纲编号，运行 build 后 test；检查缺项报错与未使用警告。只整理建议而未改数据时按文档变更验证。
5. 正式接入后看目录、文章及全局检索标签是否同步，测试交集筛选、同名标签联动、清除及分享链接。

## 已核实的交互范围

- 【已核实】[knowledge-directory.ts](../src/scripts/knowledge-directory.ts) 与 [knowledge-filter.ts](../src/lib/knowledge-filter.ts)：标签按钮多选取交集、重复标签同步、URL `?tag=` 保存精确名称，支持刷新和前进后退；未知标签产生空结果。图例只改变其他类别标签透明度，不改变匹配行。
- 【已核实】[KnowledgeChips](../src/components/KnowledgeChips.astro) 在文章及全局列表链接到所属模块筛选；时间线及搜索候选内的标签为非交互文本，由整行链接进入文章。证据：[src/pages/blog/index.astro](../src/pages/blog/index.astro)、[src/scripts/site-search.ts](../src/scripts/site-search.ts)。
- 【已核实】侧边图例仅在信息安全模块渲染，网络安全与章节页不渲染图例；依据 [StudyModule](../src/components/StudyModule.astro)。颜色、位置和尺寸见 [设计令牌](design-tokens.md)。
