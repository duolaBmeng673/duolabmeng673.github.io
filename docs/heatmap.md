# 更新记录热力图

【用户决定】2026-11-18 批次 3 确认启用；将热力图数据源由「`pubDate` + 手工 `activities.ts`」升级为「**构建期统一从 `pubDate` + 本地 Git 历史自动构建**」，使每次部署（deploy）自动进入热力图，无需再手工维护活动文件。

---

## 1. 共享数据链路（首页与 `/about/` 共用）

【已核实】首页（[index.astro](../src/pages/index.astro) → [home-data.ts](../src/lib/home-data.ts)）与关于页（[about.astro](../src/pages/about.astro) → [AboutHeatmap.astro](../src/components/AboutHeatmap.astro)）共同调用 [`buildActivityDataset`](../src/lib/activity-data.ts)，保证两端数据完全一致、零第二套构建逻辑：

1. **写作首发（`writing` → 论文 / 技术 / 学习笔记）**：
   - 继续读取 `getAllPosts()` 中全部公开文章的 `pubDate`（按 `YYYY-MM-DD`，覆盖 2024-07 至 2026-11）。
   - Git 中批量导入或新增文章的提交（`A` 状态 `src/content/**/*.md`）**不会**再次生成 `writing` 或 `revision`，杜绝重复计数。
2. **Git 历史自动提取（`revision` 与 `site`）**：
   - 由 [`getGitActivityResult`](../src/lib/activity-git.ts) 在构建期读取本地完整 Git 历史（`git -c core.quotepath=false log`），在浏览器端不请求 GitHub API。
   - **时区固定**：所有 Git 提交时间与构建期锚点 `buildDate` 统一由 `Intl.DateTimeFormat(..., { timeZone: 'Asia/Shanghai' })` 转换为北京日期（例如 UTC `16:30` 自动归入次日并落在窗口最后一格内），避免 CI（UTC）与本地（CST）出现跨天偏差。
   - **分类拆分与封顶**：
     - 修改已有笔记内容（`src/content/**/*.md` 且变更状态为 `M` / `R`）→ 计 `1` 次 **修订（`revision`）**，关联被改笔记页面链接；
     - 修改站点代码、样式、配置或非内容资源（排除 `src/content/` 与纯元文档）→ 计 `1` 次 **功能更新（`site`）**，按改动路径关联对应功能页面链接；
     - 同一提交同时涉及两类时，各计 `1` 次；**批量大提交（如 `c0006fa` 迁移 68 张图片）每类最多计 `1` 次**，不按改动文件数刷高密度或加深颜色。
     - **`/about/` 同日功能更新二次封顶**：同日多次 `site` 提交在计算格子颜色深浅（`level`）与封顶计数时**最多计 `1` 次**，旁侧明细面板仍保留当日全部提交；顶部“功能更新”标签以 `data-capped-count` / `data-raw-count` 并列标注两个口径。其余四类不封顶。
   - **过滤集中管理**：琐碎提交（合并、机器人、revert 对消、维护前缀、纯空白、极短 `.md` 勘误）由 [heatmap-filter.ts](../src/config/heatmap-filter.ts) 统一过滤，详见 [热力图过滤规则](heatmap-filter.md)。

> 注：历史手工文件 [src/data/activities.ts](../src/data/activities.ts) 不再参与构建聚合，保留仅供历史追溯。

---

## 2. 浅克隆保护与 CI 部署要求

【已核实】[deploy.yml](../.github/workflows/deploy.yml) 中的 `actions/checkout@v4` **必须配置 `fetch-depth: 0`**，确保 GitHub Actions 能拉取完整提交历史：

- [`assertFullGitHistory`](../src/lib/activity-git.ts) 会在构建期执行 `git rev-parse --is-shallow-repository`；若返回 `true`，构建立即抛错中止，防止静默生成残缺热力图。

---

## 3. 类型枚举与双页展示形式

1. **枚举保留与扩展**：
   - [activity.ts](../src/lib/activity.ts) 保留全部现有枚举 `coding`、`writing`、`research`、`learning`、`site`，并新增 `revision`（修订）。
   - 展示分类通过独立 `category` 字段标识：
     - `paper`（论文笔记，`--heat-cat-paper`）
     - `study`（学习笔记，`--heat-cat-study`）
     - `tech`（技术笔记，`--heat-cat-tech`）
     - `revision`（修订，`--heat-cat-revision`）
     - `site`（功能更新，`--heat-cat-site`）
   - 颜色单一定义在 [tokens.css](../src/styles/tokens.css)，同时修正了 `home.css` 与 `tokens.css` 间类别对应关系（`论文=蓝 #224bbf/#3b76f6`、`技术=粉红 #cc3568/#ff6296`、`学习=绿 #16a38f/#80f2d2`、`修订=金 #eab02a/#ebb038`、`功能更新=紫 #45188a/#6c2bd9`）；`/about/` 五类热力图颜色按亮/暗两套主题的去饱和灰度明度（`L*` 相邻阶差 ≥ 11）校准，确保灰度下也可辨。
2. **首页（[ActivityHeatmap.island.tsx](../src/components/islands/ActivityHeatmap.island.tsx)）**：
   - 保持 React 岛（`client:visible`）、单行统计栏与旁侧明细卡片结构；格子按热力图容器可用宽度自适应整数正方形边长（`< 340px` 时 `12px`，`< 450px` 时 `15px`，`< 580px` 时 `16px`，`>= 580px` 时 `18px`；间距 `3px`，`2–3px` 圆角），显示周数完全由容器可用宽度反算，统计口径跟随实际显示周数实时计算，窗口高度随内容自然适配。
   - **颜色跟随当前预设主色**：从 `.stage` 的 `--preset-accent` 派生 4 档浅到深色阶（图例同步跟随），主题或预设切换时仅重绘一次。
   - **首页仅展示内容 4 类**（论文笔记、技术笔记、学习笔记、修订），**不再传入 `site`（功能更新）且图例移除“功能更新”灰块**；首页不新增来自 `/about/` 的客户端 JS 逻辑。
3. **`/about/` 完整热力图（[AboutHeatmap.astro](../src/components/AboutHeatmap.astro) + [about-heatmap.ts](../src/scripts/about-heatmap.ts)）**：
   - 采用**零 React（Astro 服务端格子 + 原生 TS）**方案，不扩展非首页 React 白名单。
   - 格子与图例色块均为纯色正方格（`3px` 圆角，无内部几何标记）；时间轴直接覆盖全量有记录历史（从最早记录日至构建日连续展示，支持横向滑动且初始滚动至最右侧最新记录；在 `.about-heat-calendar` 自身盒模型上保留 `padding: 5px 7px 6px 5px`，保证各浏览器滚到最右时选中外框完整不裁切）；旁侧明细栏保持固定高度并内部滚动。**一天多类型时主色判定采用固定优先级：`论文 > 学习 > 技术 > 修订 > 功能更新`**（`paper > study > tech > revision > site`），其余类型仍全部保留在旁侧明细列表与格子 `aria-label` 中。
   - 上方展示总活跃天数、最长连续天数、总活动数；五色图例统计与单选筛选栏置于热力图网格列正下方，支持悬停预览、点击固定及完整键盘方向键导航（已移除副标题、年份切换按钮与过滤统计说明行）。

---

## 4. 验证要求

【已核实】[activity.test.mjs](../tests/activity.test.mjs) 覆盖 `Asia/Shanghai` 归日（含 UTC `16:30` 跨日测试）、过滤命中与大提交封顶、新增笔记去重、真假 `git clone --depth=1` 浅克隆报错保护，以及 `/about/` 零 React、全量横向时间轴与 `53w`/年份模型、`data-*` 绑定、防裁切内边距和 `aria-label` 检查。每次改动仍须按 `npm run build` → `npm test` → `git diff --check` 与浏览器明暗主题多视口检查。
