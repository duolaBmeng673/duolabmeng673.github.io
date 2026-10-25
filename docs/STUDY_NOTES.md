# Study Notes 维护说明

## 内容与路由

Study Notes 沿用 Astro Content Collections 与全站文章模板、TOC、代码高亮、KaTeX、主题和搜索，没有新增依赖。

- `/study-notes/`：已有公开学习系列。
- `/study-notes/837/`：哈工大 837 网络与信息安全系列。
- `/study-notes/837/chapter/01/`、`05/`、`06/`：现有笔记对应的章节，不代表完整考纲。
- `/study-notes/837/security-basics/`、`ipsec/`、`ssl/`、`set/`、`risk-management/`：5 篇独立笔记。

原文件保留在 `src/content/837考研/`，只增加 Front Matter。图片继续使用原相对路径，由 Astro 打包；不移动文件、不改正文。发布状态不等于学习完成状态。本次经作者确认，5 篇全部公开；第 6 章的待复习说明原样保留。

## 新增或更新笔记

现有集合递归读取 `src/content/837考研/**/*.md`。先写完整元数据，`published` 默认为 `false`；只有显式设为 `true` 才会进入公开路由、首页、Notes、时间线、系列目录和搜索索引。新文章没有元数据或字段不合法时构建会失败，不会静默公开。不要把私密资料或凭据提交到公开 Git 仓库；此字段只控制网站展示，不控制 GitHub 源码的可见性。

```yaml
---
title: "SSL协议的组成及工作原理"
description: "SSL/TLS 的分层位置、记录协议与握手过程。"
pubDate: 2026-10-24
category: "Study Notes"
subcategory: "考研复习"
series: "HIT 837"
subject: "信息安全导论"
studySlug: "ssl"
syllabusChapter: "05"
chapterTitle: "防火墙、入侵检测与安全传输协议"
syllabusSection: "5.c.2"
order: 502
published: false
tags: [信息安全, SSL, TLS]
questions:
  - id: ssl-tls
    heading: "什么是 SSL 和 TLS？"
---
```

- `studySlug` 是稳定 URL 的最后一段；发布后保持不变。原始本地目录不参与公开 URL。
- `category`、`subcategory` 使用 schema 字面量约束，`series` 使用显式枚举。系列在 `src/lib/study.ts` 注册标题、短路由与说明；新系列需要在此登记，并同步扩展 schema 的系列枚举。
- `subject` 标记课程，`syllabusChapter` 为两位考纲章节编号，`chapterTitle` 为真实章节名称。两者仅作分组，章节按编号数值排列。
- `order` 是系列内笔记的唯一排序字段，必须为非负整数；系列内重复值会使构建失败。当前为 100、501、502、503、600，新增时选择符合考纲顺序的空余值。不要按文件名或日期推导顺序。
- `syllabusSection` 为可选考点编号；合并多个知识点时可以省略，不强迫拆分文章。
- `pubDate` 表示公开发布日期。全站首页、Notes、Timeline 和搜索仍按它降序排序；系列目录和上下篇使用 `order`。不要修改旧文章日期来调整学习顺序。
- `shortTitle`、`subtitle` 可选，不提供就不渲染占位。

## 问答式背诵

采用**显式标题映射**：`questions` 中每项有稳定的 `id`、原文标题 `heading` 和标题层级 `depth`（`2` 或 `3`，省略时默认为 `2`，H3 问题请填写 `depth: 3`）。问题文字和答案都来自 Markdown；没有第二份答案或自动生成的答案。

```markdown
## 什么是 SSL 和 TLS？

这里是已有答案，可以包含列表、表格、图片、公式或代码。

## 下一个二级标题
```

匹配规则：标题必须与 `heading` 完全一致，并且只匹配一个指定层级的 H2/H3。答案持续到下一个同级或更高层级标题之前，因此 H3 课后习题可以逐题独立展开。背诵时保留问题所在的上级标题，便于区分名词解释、简答题和辨析题；其他非问答正文不强行转换。构建时校验显式映射；不根据问号、普通标题或代码块猜测问题。

新增问题：在正文写真实的 H2/H3 与答案，再在 `questions` 登记一个不重复的英文短 ID、完整标题和 `depth`。修改答案只编辑原文。修改问题标题时同步更新 `heading`，保留 ID。不适合背诵的段落无需登记，仍可正常阅读。省略 `questions` 或设为 `[]` 的文章不显示背诵入口。

当前 5 篇均支持背诵，共 45 个明确选定的问题：基本概念 16（含 8 个课后习题标题）、IPSec 12、SSL 7、SET 5、风险管理 5。未明确标记的普通资料标题没有强行转换。

默认阅读模式完整显示原文。切换背诵模式时，所有答案隐藏，未标记段落也隐藏；点击「查看答案」只展开对应答案，可同时展开多个。支持「展开全部答案」「收起全部答案」，切回阅读恢复全文。刷新后回到阅读模式，不保存题目展开状态。没有 JavaScript 时保留完整阅读，隐藏不可用的背诵控件。

答案直接使用 Astro 安全默认配置下既有的 Markdown/KaTeX 渲染结果，客户端仅移动同一批 DOM 节点，不重新解析 Markdown、不注入答案字符串。按钮提供 `aria-controls`、`aria-expanded` 和明确的文字状态；隐藏答案使用原生 `hidden`，从可访问顺序中移除。背诵时目录只显示已登记的问题，阅读时恢复完整目录。

## 搜索、排序与公开边界

全站复用 `/search-index.json` 和 Header 常驻搜索。原有索引不索引全文；新笔记同样索引标题、描述、标签、分类和系列，额外包括课程、章节、考点编号、明确的问题标题。没有新增独立搜索系统。

所有公开展示均从 `getPublicStudyNotes()` 获取内容；Notes 与 Timeline 复用统一文章源。列表内部键加入集合名称，避免不同内容集合的同名 ID 相互干扰。

当前没有 sitemap 或 RSS 功能，本次不引入新的生成器。新页面继续通过共享布局生成 title、description 和 canonical。

## 验证

执行 `npm run build` 和 `git diff --check`，检查 18 个既有文章 URL、23 条公开文章搜索记录、5 个新笔记页、3 个真实章节页和 2 个入口页。新增内容后以实际集合数据更新数量，不把本文快照作为代码常量。

浏览器核对 Notes 分类／系列／标签／搜索和 Timeline 的真实可见行；系列与上下篇排序；单题和全部展开／收起、阅读恢复、键盘与 ARIA、无 JavaScript 阅读。检查 1440、1024、768、390、320px 的明暗主题、长标题、长目录、图片、公式、表格与代码。编辑元数据前后逐字节比较正文和图片，包含文件结尾与空白。
