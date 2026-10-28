# Study Notes 维护说明

## 内容与路由

Study Notes 沿用 Astro Content Collections 与全站文章模板、TOC、代码高亮、KaTeX、主题和搜索，没有新增依赖。

- `/study-notes/`：已有公开学习系列。
- `/study-notes/837/`：哈工大 837 模块选择页，保留旧链接，不再混排全部文章。
- `/study-notes/837/information-security/`：信息安全，当前 8 篇，按考纲分为 01、04、05、06 章。
- `/study-notes/837/network-security/`：网络安全，当前 4 篇，属于 01 网络攻击。
- 模块依据明确的 `subject` 及实际内容区分，使用公开集合动态计数；总入口直接提供两条模块链接。
- 信息安全导论：`/study-notes/837/chapter/01/`、`04/`、`05/`、`06/`。
- 网络安全基础：`/study-notes/837/chapter/network-security-01/`。模块分别分组，不合并同号章节；只列出已有内容，不代表完整考纲。
- `/study-notes/837/security-basics/`、`ipsec/`、`ssl/`、`set/`、`risk-management/`、`firewall-netfilter/`、`intrusion-detection-snort/`：7 篇既有笔记。
- 新增 `traditional-computer-viruses/`、`network-protocol-vulnerabilities/`、`dos-ddos-attacks/`、`format-string-buffer-overflow/`，另接入 `web-attack-techniques/`，共 12 篇公开学习笔记。

原文件保留在 `src/content/837考研/`，图片继续使用原相对路径，由 Astro 打包。本轮 Web 文章仅增加 Front Matter，原正文和资源未改动。发布状态不等于学习完成状态。此前经作者确认的 5 篇初始笔记保持公开，第 6 章原有待复习说明保留。

## 新增或更新笔记

现有集合递归读取 `src/content/837考研/**/*.md`。先写完整元数据，`published` 默认为 `false`；只有显式设为 `true`，且 `draft` 不为真、没有 `publicationHoldReason`，才会进入公开路由、首页、归档筛选、系列目录、全文索引、RSS 和 sitemap。新文章没有元数据或字段不合法时构建会失败，不会静默公开。不要把私密资料或凭据提交到公开 Git 仓库；此字段只控制网站展示，不控制 GitHub 源码的可见性。

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
order: 504
published: false
tags: [信息安全, SSL, TLS]
questions:
  - id: ssl-tls
    heading: "什么是 SSL 和 TLS？"
---
```

- `studySlug` 是稳定 URL 的最后一段；发布后保持不变。原始本地目录不参与公开 URL。
- `category`、`subcategory` 使用 schema 字面量约束，`series` 使用显式枚举。系列在 `src/lib/study.ts` 注册标题、短路由与说明；新系列需要在此登记，并同步扩展 schema 的系列枚举。
- `subject` 受 schema 枚举约束，只能为 `信息安全导论` 或 `网络安全基础`，两者是 HIT 837 的并列模块。`syllabusChapter` 为两位考纲章节编号，`chapterTitle` 为真实章节名称。两者仅作分组，章节按编号数值排列。
- `order` 是同一系列、同一模块内笔记的唯一排序字段，必须为非负整数；模块内重复值会使构建失败。信息安全导论当前为 100、401、501–505、600；网络安全基础为 101–104。不同模块可重用排序值。每个独立模块页按考纲章节分组；上下篇只在同一模块内跳转，文章返回链接与章节上级导航也指向所属模块。不要按文件名或日期推导顺序。
- `syllabusSection` 为可选考点编号；合并多个知识点时可以省略，不强迫拆分文章。
- `pubDate` 表示公开发布日期。首页各近期分组、普通归档列表和时间线按它降序排序；搜索列表按相关度、同分日期排序，搜索时间线仍按日期分组。系列目录和上下篇使用 `order`。不要修改旧文章日期来调整学习顺序。
- `shortTitle`、`subtitle` 可选，不提供就不渲染占位。

## 按标题层级背诵

12 篇学习笔记统一支持阅读模式与背诵模式，不要求正文写成一问一答。阅读模式默认完整展开。进入背诵模式后，H2–H6 标题成为嵌套折叠入口；独占一个段落、内容完全由一个 `strong` 元素组成的加粗小标题也作为下一级折叠入口。行内强调、列表中的加粗词语、代码块不会被误作标题。

例如以下原文无需改写：

```markdown
# 各层网络协议缺陷及攻击
## 一、应用层
### DNS（域名系统）⭐
**基本作用/功能**
- 域名解析等内容
**脆弱性来源**
- 协议与实现缺陷
**攻击方式**
- 对应内容
```

背诵时可以先展开“应用层”，再展开“DNS”，按需独立展开“基本作用/功能”“脆弱性来源”“攻击方式”，也可以同时展开多个。收起父标题时保留子标题的展开状态，再展开父标题即可继续阅读；“展开全部内容”“收起全部内容”控制全部层级。切回阅读模式后恢复全文。刷新回到阅读模式，不持久化展开状态。

客户端用原生 `details` / `summary` 移动同一批已渲染的 DOM 节点，不复制或重写答案，不重新解析 Markdown、不注入 HTML。保留原有标题 ID 与代码、图片、表格、公式、链接。折叠入口可用 Tab 聚焦、Enter/Space 切换；原生展开状态供辅助技术读取。点击 TOC 或打开带标题锚点的 URL，会展开目标的祖先层级，不需要切回阅读模式。

旧 `questions: [{ id, heading, depth }]` 元数据保留，用于原有搜索与构建校验；标题文本必须唯一匹配一个渲染后的标题。保留历史 `depth` 字段，但渲染时 H1 章节可能降级，不再要求深度完全一致。新笔记不必填写 `questions`，只要存在 H2 或更深标题即可启用按层级背诵。没有可折叠标题的文章不显示背诵入口。没有 JavaScript 时仍保留完整静态正文，隐藏不可用的模式控件。

## SVG 插图

在 Markdown 中使用原相对路径，例如 `![栈结构](<./format_string_attack_stack_compare.svg>)`。SVG 通过 Astro 现有图片管线打包到 `/_astro/`，从 viewBox 得到宽高；不转成低清位图、不修改源 SVG。文章内保持比例、适应正文宽度，并保留白色底板，确保深色主题下原图的深色文字仍清晰。启用 JavaScript 后可点击图或“查看 SVG 原图”在新标签页查看原始尺寸图；无 JavaScript 时图片仍正常渲染。

## 搜索、排序与公开边界

全站复用 `/search-index.json` 和 Header 常驻搜索。本轮已支持正文全文检索，同时索引完整标题、可选展示标题、描述、标签、分类、系列、课程、章节、考点编号和明确的问题标题。采用连续中文子串、大小写归一化与空白分词 AND 匹配；标题命中优先，其次标签、分类、描述和正文，同分按日期与 URL。索引延迟加载，首页不内嵌全部正文。没有新增独立搜索框或外部服务。

所有公开学习内容均从 `getPublicStudyNotes()` 获取；归档与时间线复用统一文章源。技术归档默认只展示常规技术／论文，显式分类、系列、标签筛选和搜索可查到学习笔记，课程入口继续按考纲浏览。列表内部键加入集合名称，避免跨集合同名 ID 冲突。

`/sitemap.xml` 与 `/rss.xml` 在构建时生成，仅包含公开内容；共享布局提供完整文章 OG／Twitter、canonical、发布日期及可选 `updatedDate`。网站公开字段不会隐藏 Git 源码或历史。

## 验证

执行 `npm run build` 和 `git diff --check`，执行 `npm test`。当前应生成 30 条公开文章搜索记录、12 个学习笔记页、5 个真实章节页、2 个模块页和 2 个学习入口；18 个既有博客 URL 都恢复完整正文。新增内容后以实际集合数据更新数量，不把本文快照作为代码常量。

浏览器核对 Notes 分类／系列／标签／搜索和 Timeline 的真实可见行；系列与上下篇排序；嵌套标题和全部展开／收起、阅读恢复、键盘与 ARIA、无 JavaScript 阅读。检查 1440、1024、768、390、320px 的明暗主题、长标题、长目录、图片、公式、表格与代码。编辑元数据前后逐字节比较正文和图片，包含文件结尾与空白。必要的标题、错字或内部链接修复应单独记录；技术实质修改须有明确依据。本轮自动化结果与尚未完成的真实浏览器检查见 [定向优化记录](REFINEMENT.md)。

## Web 攻击技术接入记录

- 源文件：`src/content/837考研/网络安全基础考点笔记总结/1 网络攻击/d web 攻击技术/web 攻击技术.md`。
- 只有一篇真实 Markdown，无本地图片或附件，保留原始正文、代码、表格与引用。
- 发布日期：2026-10-28，`published: true`。
- 网络安全基础 → 01 网络攻击 → `1.d`，`order: 104`。
- URL：`/study-notes/837/web-attack-techniques/`；上一篇 `format-string-buffer-overflow`，当前无下一篇。
- 共享渲染层处理标题层级，保持源文件不变；同一机制也用于其他博客。TOC 与按标题背诵使用渲染后的标题。
