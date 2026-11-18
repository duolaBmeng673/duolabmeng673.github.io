# 热力图 Git 提交过滤规则说明

本文档说明构建期从 Git 历史自动采集热力图活动时所采用的噪声过滤配置，所有规则集中定义在 [src/config/heatmap-filter.ts](../src/config/heatmap-filter.ts)，由 [src/lib/activity-git.ts](../src/lib/activity-git.ts) 按固定顺序执行，**不散落在业务组件中**。

---

## 1. 过滤规则与阈值清单

| 顺序 | 规则键名 (`filterHits`) | 判定条件与阈值 | 当前仓库实测命中数 |
|---|---|---|---:|
| 1 | `mergeCommits` | 提交父节点数 `parentCount > 1`（合并提交） | **1** (`f2e31d0`) |
| 2 | `botAuthors` | 作者名或邮箱匹配 `/dependabot(?:\[bot\])?/i`、`/renovate(?:\[bot\])?/i`、`/github-actions(?:\[bot\])?/i`、`/\[bot\]$/i` | **0** |
| 3 | `revertNoise` | 标题匹配 `/^Revert\s+"(.+)"$/i` 的回退提交（含 `Revert "Revert ..."`）及其在同历史中互相抵消的原提交（`cancelRevertedOriginal: true`） | **2** (`826448e` + `65f9067`) |
| 4 | `messagePrefix` | 标题前缀匹配 `/^(?:chore\|typo\|wip\|format\|lint)(?:\([^)]*\))?:/i` 或 `/^(?:typo\|wip\|format\|fixup!\|squash!)\b/i` | **2** (`cf48f15`, `f3ab204`) |
| 5 | `whitespaceOnly` | 非根提交且 `git diff-tree -p -w --ignore-blank-lines` 忽略空白与空行后无任何有效差异 | **1** (`0f2b4f8`) |
| 6 | `tinyMarkdownOnly` | 本次仅改动 `.md` / `.mdx` 文件，且字符级差异（`--word-diff=porcelain --word-diff-regex=.` 去除空白字符后）总改动字符数 **`< 40`** | **4** (`3237e52` [3], `5305736` [7], `2f53fc9` [20], `5f7e48f` [31]) |

- **上述 6 类合计实测过滤**：**`10` 条**（总提交 `129` 条），该数字会直接渲染在 `/about/` 热力图底部的“已过滤 N 条琐碎提交”说明行中（`data-activity-filtered-count="10"`）。

---

## 2. 不计入但不算作琐碎提交的类别（去重与范围隔离）

为防止与文章首发日重复计数，以及避免纯规范文档冒充博客功能更新，以下两条分类边界同样集中配置在 `HEATMAP_FILTER_CONFIG`：

1. **纯新增文章提交（`addedNotesOnly`，当前命中 `5` 条）**：
   - `a15bab4`、`5de057f`、`8e31b0e`、`fdae2a2`、`2d087b7` 等仅向 `src/content/` 新增笔记文件的提交。
   - **处理方式**：由文章 Front Matter `pubDate` 在 论文/技术/学习笔记 分类中计入创作日活动，Git 侧不再生成 `writing` 或 `revision`。
   - 对只修改已有 `src/content/**/*.md`（状态 `M` 或 `R`）才记为 `1` 次 `revision`（修订）。
2. **纯元文档与工作区说明提交（`docsMetaOnly`，当前命中 `2` 条）**：
   - 仅改动 `AGENTS.md`、`CLAUDE.md`、`README.md`、`TECHNICAL_HANDOFF.md`、`docs/**` 或 `.DS_Store`（`ignoredMetaPaths`），如 `dc9bffe`。
   - **处理方式**：不触发 `site`（功能更新）或 `revision`（修订）。

---

## 3. 如何调整规则或阈值

如需微调过滤粒度（例如将极短 Markdown 勘误阈值 `40` 调大或增减忽略前缀），**只需修改 [src/config/heatmap-filter.ts](../src/config/heatmap-filter.ts)**，再运行 `npm run build && npm test` 即可生效并同步更新首页、`/about/` 与页面上的过滤统计数。
