# 设计令牌与布局联动

【用户决定】2026-11-14 确认启用；本规范记录已确认的视觉约定及代码事实，不触发重设计。顶栏保留现行滚动显隐，确认记录见 [rules-review.md](rules-review.md)。

## 用户决定

【用户决定】保留以下视觉规范；顶栏行为以本次确认的“下滑隐藏、上滑显示”替代旧草稿中的“常驻”：

- 标签外观：标签中性底色，类别颜色只出现在 11px 小方块上；标签 12px、字重 400、圆角 6px；色块圆角随标签圆角按 0.6 倍联动；课程目录 `.knowledge-title` 为 `1.04rem`（无衬线、600 字重，保留层级区分且不误用于全站标题）。圆角不超过 8px，文字不小于 12px。
- 色块浅色模式：concept `#E3E1D9`、algorithm `#D1E3F4`、protocol `#C4EBDB`、model `#E0DDF5`、struct `#FADBA8`、threat `#F7D9CD`、defense `#D8E8BC`。
- 顶栏全站采用 sticky 定位，向下阅读时隐藏（桌面端保留常驻 `top: 12px`）、向上回看时显示；各专题模块目录页均启用七类知识点标签图例栏，桌面端（`>= 1024px`）采用顶部吸附全宽图例栏 + 左侧粘性章节目录 + 右侧 2 列等高卡，窄屏（`< 1024px`）降级为右下角「标签筛选」浮钮并互斥显示。

## 学习笔记快速跳转交互

- 【已核实】专题模块目录页与章节页页头（`.study-nav-bar`）提供同系列模块切换胶囊组（`.study-module-switcher`）与全模块「笔记直达」弹窗（`#study-quick-jump-dialog`），支持按模块 Tab 切换、考纲号／标题即时过滤及 `Alt + J` 快捷键唤起。
- 【已核实】学习笔记正文页页头提供同章下拉切换器（`.article-chapter-switcher`）、上下篇／跨模块首尾接力胶囊（`.article-quick-jump`）及「笔记直达 ⌥J」入口；右侧 TOC「笔记直达」点击一次直接进入当前模块面板并支持模块 Tab 与即时过滤，遵循全站非首页零 React 约束。

## 已核实的令牌入口

- 【已核实】[src/styles/tokens.css](../src/styles/tokens.css) 与 [src/styles/global.css](../src/styles/global.css) 定义全站 React Bits 浅／深色基底、正文、交互、辅色、统一无衬线字体角色（`--serif: var(--sans)`，消除跨平台衬线回退差异）、7 级字号阶梯（`--fs-xs: max(12px, 0.75rem)`、`--fs-sm: max(12px, 0.8125rem)`、`--fs-base: 0.9375rem`、`--fs-md: 1.0625rem`、`--fs-lg: 1.25rem`、`--fs-xl: 1.6rem`、`--fs-display: clamp(2.2rem, 4vw, 3.4rem)`）、3 档动效时长与缓动（`--dur-1: 120ms`、`--dur-2: 220ms`、`--dur-3: 400ms`、`--ease-out: cubic-bezier(.22, 1, .36, 1)`、`--toc-panel-height: min(560px, calc(100vh - var(--header-h, 56px) - 24px))`、`--toc-slide-dur: calc(var(--dur-3) - var(--dur-2))`）、圆角（`--r-nav` 到 `--r-vis`）、首页舞台窗口字号 `--win-fs: clamp(12px, calc(10.85px + 0.302vw), 16px)`、学习笔记正文与目录字号阶梯（`--fs-article-body: 1.02rem`、`--fs-study-h2: 1.46rem`、`--fs-study-h3: 1.22rem`、`--fs-study-label: 1.09rem`、`--fs-toc-2: max(12px, 0.84rem)`、`--fs-toc-3: max(12px, 0.76rem)`）、（`--svg-bg: var(--bg-elev)` 用于 SVG 放大弹窗底色；文章内 `.article-svg-card` 去除边框、圆角、内边距与默认底色，直接贴合页面方格背景，并提供可选羽化衬底开关 `--svg-scrim-opacity`（默认 `0` 关闭；非零时以 `color-mix(in srgb, var(--bg) calc(var(--svg-scrim-opacity) * 100%), transparent)` 与同色大半径 `box-shadow` 柔和羽化边缘，无硬边或边框））与版心变量（`--gutter: clamp(20px, 3vw, 56px)`、`--maxw: 1760px`）；`BaseLayout.astro` 在 `body` 写入 `data-channel`，`/study-notes/**` 频道（`data-channel="study"`）将 `--ac` / `--ac-strong` / `--ac-soft` 映射为学习笔记深绿安全对比度变体（浅色 `#0b6e61` / `#08544a`、深色 `#5fd6b8` / `#86e6cc`），`.site-header` 固定保留全站品牌紫（`--brand-ac`），暗色下学习笔记文章页局部将 `--cat-study` 降明度／降饱和度为 `#46ab91`（不影响浅色 `#0f8a7a` 与热力图色阶）；[BaseLayout](../src/layouts/BaseLayout.astro) 负责首屏主题／字号恢复与共享样式，[typography.ts](../src/scripts/typography.ts) 负责主题／字体设置。没有第二套独立知识点主题状态。
- 【已核实】[src/styles/knowledge-tags.css](../src/styles/knowledge-tags.css) 定义七类 `--knowledge-*`、中性标签与图例样式；条目、文章、搜索候选共用同一组色块变量。

【已核实】以下色值逐项来自上述两个 CSS 文件，十六进制大小写不影响颜色：

| 角色／变量 | 浅色 | 深色 |
|---|---|---|
| `--bg` | `#F7F6F2` | `#08070C` |
| `--text` | `#121217` | `#F3F2F7` |
| `--accent` | `#6D28D9` | `#A78BFA` |
| `--warm` | `#52525B` | `#A1A1AA` |
| `--knowledge-concept` | `#E3E1D9` | `#77756E` |
| `--knowledge-algorithm` | `#D1E3F4` | `#4B83BF` |
| `--knowledge-protocol` | `#C4EBDB` | `#3E9E7E` |
| `--knowledge-model` | `#E0DDF5` | `#7A74C7` |
| `--knowledge-struct` | `#FADBA8` | `#C28A2E` |
| `--knowledge-threat` | `#F7D9CD` | `#CC7655` |
| `--knowledge-defense` | `#D8E8BC` | `#7DA047` |

## 已核实的尺寸与层级

【已核实】以下为 [knowledge-tags.css](../src/styles/knowledge-tags.css) 当前值，不是所有文章标题的统一字号：

- 课程目录 `.knowledge-title`：无衬线 `1.04rem`（约 16.6px）、600 字重、行高 1.4；与标签间距随 `.knowledge-entry-content` 自适应，`margin-top: auto` 贴底对齐；桌面 `>= 1024px` 下 `.study-note-list` 为 2 列等高卡，`/blog/` 列表在 `>= 1100px` 下为 2 列 `subgrid` 四层等高卡，`/study-notes/` 与 `/study-notes/837/` 模块总览在 `>= 1200px` 下为 3 列等高卡，`/tools/` 在 `>= 860px` 下为左侧 `10.5rem` 分组标题 + 右侧自适应卡片网格。
- 序号 `.knowledge-code`：12px 等宽；知识点标签：12px、400、无衬线、行高 1。
- 标签 `--r: 6px`，内边距 `5px 10px 5px 7px`；标签间距 6px；色块 11px、圆角 `calc(var(--r) * .6)`、内描边 `rgba(18, 18, 24, .08)`。
- 标签文字／底／边框：`--ts`／`--bg-elev`／`--bd`。
- 粗指针设备标签 13px、最小高度 32px、内边距 `8px 10px`。图例文字 13px／400、色块与标签相同、条目间距 4px、每项最小高 32px。
- 标签与图例选择态均跟随 `/study-notes/**` 频道强调色 `--ac` / `--ac-strong`（浅色深绿 `#08544a`/`#0b6e61`、深色 `#5fd6b8`/`#86e6cc`）；类别识别色仍只在小方块。图例选择态用描边与柔绿背景，不把整项涂成类别色。

【已核实】文章 H1、正文容器阅读主栏文本约 `44rem`（`--article-text-max`）舒适中文行长（开启 `text-autospace: normal`），主栏容器 `--article-main-max: 50rem`、右侧目录栏 `--article-toc-w: 16.5rem`、栏间距 `--article-toc-gap: 2.25rem`；宽表格、代码块与 SVG 图表不受限于文本窄栏，其中桌面端（`>= 1180px`）`.article-svg-card` 内容最大宽度以正文列中心对称 break-out 至 `min(720px, 不与右侧目录栏重叠的最大宽度)`，窄视口（`< 1180px`）恢复 `max-width: 100%`；文章 TOC 仅在启用 JS 时按当前 H2 章节展开 H3 子项，并与章节目录共用 `220ms cubic-bezier(.22, 1, .36, 1)` 共享滑动指示块与 `scrollend` + 超时兜底锁定。

## 已核实的顶栏行为

- 【已核实】[BaseLayout](../src/layouts/BaseLayout.astro) 将 `.site-header` 放在 body 下；[global.css](../src/styles/global.css) 使用 `position: sticky; top: 0; z-index: 100`，主题不透明背景、两侧同色遮罩和底边线。
- 【已核实】现行 [site-header.ts](../src/scripts/site-header.ts) 向下阅读隐藏、向上回看显示；页顶、顶栏含焦点或文字设置展开时保持可见。使用 12px 累积位移阈值与 rAF；不通过移除元素改变正文流。
- 【已核实】[BaseLayout](../src/layouts/BaseLayout.astro) 同步实际高度到 `--header-h`，用 ResizeObserver 响应字体与断点换行；CSS 中 73／119／120／170px 是不同断点的回退值，不是永久固定高度。
- 【已核实】`html` 的 `scroll-padding-top` 使用完整 `--header-h`；TOC 和图例使用 `--header-offset`，可见时等于实测高度、隐藏时为 0。无 JS 时保持 sticky，不自动隐藏。依据：[global.css](../src/styles/global.css)、[knowledge-tags.css](../src/styles/knowledge-tags.css)。
- 【用户决定】保留上述已实现的滚动显隐、焦点保护与无 JS 回退；本次仅确认规则，不修改顶栏 CSS／脚本。

## 已核实的模块分类栏与断点

- 【已核实】[StudyModule](../src/components/StudyModule.astro) 为「信息安全」与「网络安全」两个模块均启用 `showLegend`；[KnowledgeDirectory](../src/components/KnowledgeDirectory.astro) 复用 `.archive-tools` 毛玻璃样式渲染「全部 + 七类知识点标签」工具条，定位参照包含介绍、全部章节和底部导航。
- 【已核实】桌面端（`>= 1024px`）`.knowledge-aside.archive-tools` 与 `/blog/` `.archive-tools` 均以 `width: 100%` 吸附于可见顶栏正下方（`top: calc(12px + var(--header-h, 56px))`，配合 `::before` `var(--bg)` 向上遮罩消除吸顶缝隙），左侧标签与右侧「N 篇笔记」统一收纳在同一边框内部；下方主体采用左侧粘性章节目录（`220px`，长章名支持最多 2 行展示）+ 右侧 2 列等高笔记卡片流（`minmax(0, 1fr)`）两栏布局。CSS `@media (min-width: 1024px)` 与 [knowledge-directory.ts](../src/scripts/knowledge-directory.ts) 的 `matchMedia` 使用同一数值。
- 【已核实】≥1024px 只显示内联吸附分类栏，CSS `display: none` 和脚本 `hidden` 禁用浮钮；低于 `1024px` 默认只显示右下浮钮（z-index 60），点击展开同一份图例（aside 的 z-index 50），面板高度不超过视口 60%，支持外部点击／Escape／焦点转移。
- 【已核实】`1100 / 1208 / 1280 / 1440px` 均大于等于断点显示内联双栏与顶部吸附七类标签条；`390px` 低于断点默认仅显示浮钮。图例按钮用 `aria-pressed`，只高亮类别，其他类别标签 opacity 0.3；点击「全部」清除类别高亮，筛选摘要仅有选中标签时出现。依据：[knowledge-directory.ts](../src/scripts/knowledge-directory.ts)、[KnowledgeDirectory](../src/components/KnowledgeDirectory.astro)。

## 改动与验收要求

【用户决定】改最大宽度／图例宽度／间距时重算断点，必须同时改 CSS、matchMedia、对应测试与本文件；改顶栏高度时复核实测值、回退值及两种偏移，不直接拿桌面高度覆盖手机。

【用户决定】至少检查四个指定宽度与实际断点两侧；浅／深色、桌面／触屏、Tab／Enter／Escape、锚点遮挡、搜索快捷键、正文宽度及无横向溢出。Safari／Chrome 未实测时明确标注；构建测试不等于视觉验收。保持祖先链无导致 sticky 失效的滚动容器，必要时用 `overflow-x: clip` 取代 `hidden`，但不为凑规则修改无关布局。

【已核实】相关回归覆盖见 [site-header.test.mjs](../tests/site-header.test.mjs)、[knowledge-tags.test.mjs](../tests/knowledge-tags.test.mjs)；热力图颜色职责另外见 [热力图规则](heatmap.md)。
