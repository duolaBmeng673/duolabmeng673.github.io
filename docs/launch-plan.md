# 上线与合并方案（`redesign` → 原站仓库）

本文档说明如何将当前工作副本（`/Users/a/Public/课程/duolabmeng673.github.io`）中的 `redesign` 分支安全带回真正的原站仓库（`/Users/a/duolabmeng673.github.io`）、通过 CI 验证后合入 `main` 发布，以及上线后的回滚与验收清单。

> **重要**：所有以下命令仅在用户确认并准备执行上线时运行；本方案默认**不强制覆盖写改历史**，且原站操作前务必确认 `git status` 干净。

---

## 一、把 `redesign` 分支带回原站仓库（推荐 `git fetch`）

强烈建议使用 Git 对象传输（`git fetch`）将已分阶段验证过的提交历史完整引入原站仓库，**不要**手动整目录复制文件（避免漏文件、带入 `dist/` 或破坏 `.git` 与提交历史）。

```sh
# 1. 进入真正的原站仓库并确认工作区干净、当前分支为 main
cd /Users/a/duolabmeng673.github.io
git status
git branch --show-current

# 2. 从工作副本拉取 redesign 分支为本地同名分支（不会修改 main，也不会写入工作副本）
git fetch /Users/a/Public/课程/duolabmeng673.github.io redesign:redesign

# 3. 检查引入的提交历史与差异范围（预期从原 main 基线分叉出的 阶段 0+1 ~ 阶段 4 提交）
git log --oneline main..redesign
git diff --stat main..redesign
```

---

## 二、推送分支、开 PR 验证并合并上线

### 推荐路线：先推 `redesign` 开 PR 验收，再合入 `main`

1. 将 `redesign` 分支推送到 GitHub 远端（此时不会触发生产环境 Pages 部署，因为 [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) 仅监听 `push: branches: [main]`）：

   ```sh
   cd /Users/a/duolabmeng673.github.io
   git push -u origin redesign
   ```

2. 在 GitHub 上创建 `redesign` → `main` 的 Pull Request，确认变更文件范围与提交说明（无 `dist/`、无截图、无临时脚本进入仓库）。
3. **CI 验证说明**：当前 `.github/workflows/deploy.yml` 仅在 `push` 到 `main` 与 `workflow_dispatch` 时运行 `npm ci` → `npm run build` → `npm test`。如需在 PR 合并前先让 GitHub Actions 跑通一次，可在本地切换至 `redesign` 做一次干净验证，或（如仓库设置允许）临时为 `deploy.yml` 的 `build` job 触发前做最终本地门禁：

   ```sh
   git checkout redesign
   rm -rf node_modules
   npm ci
   npm run build
   npm test
   git diff --check
   ```

4. 确认 PR 审查通过后，在 GitHub 网页端执行 **Create a merge commit**（推荐保留阶段提交或生成单个合并提交，方便日后一步 `git revert -m 1` 回滚）合入 `main`；或本地执行：

   ```sh
   git checkout main
   git pull --ff-only origin main
   git merge --no-ff redesign -m "Merge redesign: 全站新皮肤与双 React 岛架构上线"
   git push origin main
   ```

5. 推送至 `main` 后，GitHub Actions（Node 22）自动执行 `npm ci` → `npm run build` → `npm test` → 上传 `dist/` 并部署至 GitHub Pages。

---

## 三、上线后回滚方案

若上线后发现阻断性问题，可根据是否需要保留提交记录选择以下任一步骤回滚 `main` 并自动重新部署：

### 方案 A（推荐，安全不改历史）：用 `git revert` 撤销合并

```sh
cd /Users/a/duolabmeng673.github.io
git checkout main
git pull --ff-only origin main

# 1. 找到合入 redesign 的 merge commit（或最近一次上线提交）
git log --oneline -n 5

# 2. 如果是 --no-ff 合并提交，用 -m 1 保留原 main 父节点方向
git revert -m 1 <merge_commit_sha>

# 3. 推送后 GitHub Actions 将自动按旧版重新构建并发布
git push origin main
```

### 方案 B（紧急回退到旧基线提交，仅在确认无协作者拉取时使用）

```sh
cd /Users/a/duolabmeng673.github.io
git checkout main
git reset --hard <pre_redesign_main_sha>
git push --force-with-lease origin main
```

---

## 四、上线后检查清单

部署工作流显示绿色成功后，依次核查线上地址 `https://duolabmeng673.github.io`：

1. **首页**：
   - `GradientWaves` 与 `ActivityHeatmap` 正常交互，桌面滚动顶栏变为 `14px` 圆角矩形且不隐藏，浅色／深色切换无闪烁，顶部与底部回弹不露白，无控制台报错。
2. **文章页与学习笔记**：
   - 抽检技术笔记（如 `/blog/acm_io/`）、论文笔记（如 `/blog/tablesense/`）、含 KaTeX 与多表格章节（如 `/study-notes/837/naive-bayes-classification/`、`/study-notes/837/decision-tree-c45/`）、KMP 交互演示（`/study-notes/837/kmp-algorithm/`）与 837 目录页（`/study-notes/837/information-security/`）；确认 `1500px` 侧边图例、TOC sticky 与滚动隐藏胶囊顶栏正常。
3. **工具、关于与 404 回退**：
   - 打开 `/tools/`、`/about/` 验证外链与统计分布；访问任意不存在路径（如 `/not-exists-check/`）确认展示自定义 `404.html` 与返回首页入口。
4. **检索、主题与订阅**：
   - 桌面 `Cmd K` / 手机端搜索框可即时命中中文与英文标题及正文关键词；主题（跟随系统／浅色／深色）与字号设置刷新后持久化；`/rss.xml` 与 `/sitemap.xml` 可正常抓取且内容与基线一致。
5. **搜索引擎收录与旧链接验证**：
   - 在 Google Search Console / Bing Webmaster Tools 提交或复核 `https://duolabmeng673.github.io/sitemap.xml`；使用 `curl -I` 抽查原站核心旧 URL（含尾斜杠及中文 slug `/blog/%E6%8E%A8%E7%90%86%E8%AE%BE%E5%A4%87%E8%A6%86%E7%9B%96/`）均返回 HTTP `200`，且 `/404.html` 含 `noindex, nofollow`。
