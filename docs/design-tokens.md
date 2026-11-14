# 设计令牌与布局联动

【用户决定】2026-11-14 确认启用；本规范记录已确认的视觉约定及代码事实，不触发重设计。顶栏保留现行滚动显隐，确认记录见 [rules-review.md](rules-review.md)。

## 用户决定

【用户决定】保留以下视觉规范；顶栏行为以本次确认的“下滑隐藏、上滑显示”替代旧草稿中的“常驻”：

- 标签外观：标签中性底色，类别颜色只出现在 11px 小方块上；标签 12px、字重 400、圆角 6px；色块圆角随标签圆角按 0.6 倍联动；标题 22px。圆角不超过 8px，文字不小于 12px。
- 色块浅色模式：concept `#E3E1D9`、algorithm `#D1E3F4`、protocol `#C4EBDB`、model `#E0DDF5`、struct `#FADBA8`、threat `#F7D9CD`、defense `#D8E8BC`。
- 顶栏全站采用 sticky 定位，向下阅读时隐藏、向上回看时显示；侧边图例只在「学习笔记 → 信息安全」页出现，默认放右侧外边距、不挤占正文；宽屏显示侧边栏，窄屏降级为右下角「图例」浮钮，二者互斥。

## 已核实的令牌入口

- 【已核实】[src/styles/global.css](../src/styles/global.css) 定义全站浅／深色纸张、正文、交互、暖陶色、字体和布局变量；[BaseLayout](../src/layouts/BaseLayout.astro) 负责首屏主题与共享样式，[typography.ts](../src/scripts/typography.ts) 负责主题／字体设置。没有第二套独立知识点主题状态。
- 【已核实】[src/styles/knowledge-tags.css](../src/styles/knowledge-tags.css) 定义七类 `--knowledge-*`、中性标签与图例样式；条目、文章、搜索候选共用同一组色块变量。

【已核实】以下色值逐项来自上述两个 CSS 文件，十六进制大小写不影响颜色：

| 角色／变量 | 浅色 | 深色 |
|---|---|---|
| `--bg` | `#F7F5EF` | `#181614` |
| `--text` | `#2A2622` | `#ECE7DD` |
| `--accent` | `#0E6B5C` | `#4DB6A0` |
| `--warm` | `#B5532F` | `#E08A66` |
| `--knowledge-concept` | `#E3E1D9` | `#77756E` |
| `--knowledge-algorithm` | `#D1E3F4` | `#4B83BF` |
| `--knowledge-protocol` | `#C4EBDB` | `#3E9E7E` |
| `--knowledge-model` | `#E0DDF5` | `#7A74C7` |
| `--knowledge-struct` | `#FADBA8` | `#C28A2E` |
| `--knowledge-threat` | `#F7D9CD` | `#CC7655` |
| `--knowledge-defense` | `#D8E8BC` | `#7DA047` |

## 已核实的尺寸与层级

【已核实】以下为 [knowledge-tags.css](../src/styles/knowledge-tags.css) 当前值，不是所有文章标题的统一字号：

- 课程目录 `.knowledge-title`：22px、500、衬线、行高 1.35；与标签间距 10px；条目上下内边距 18px。
- 序号 `.knowledge-code`：12px 等宽；知识点标签：12px、400、无衬线、行高 1。
- 标签 `--r: 6px`，内边距 `5px 10px 5px 7px`；标签间距 6px；色块 11px、圆角 `calc(var(--r) * .6)`、内描边 `rgba(42,38,34,.06)`。
- 标签浅色文字／底／边框：`#3A352F`／`#FBF9F4`／`#D9D2C3`；深色分别映射 `--text-soft`／`--surface`／`--border-strong`。
- 粗指针设备标签 13px、最小高度 32px、内边距 `8px 10px`。图例文字 13px／400、色块与标签相同、条目间距 4px、每项最小高 32px。
- 标签选择态用深绿底；类别识别色仍只在小方块。图例选择态用描边与主题背景，不把整项涂成类别色。

【已核实】文章 H1、全局列表、时间线仍各有现行字号，未统一为 22px；定义分别在 [global.css](../src/styles/global.css)、[knowledge-tags.css](../src/styles/knowledge-tags.css)。

## 已核实的顶栏行为

- 【已核实】[BaseLayout](../src/layouts/BaseLayout.astro) 将 `.site-header` 放在 body 下；[global.css](../src/styles/global.css) 使用 `position: sticky; top: 0; z-index: 100`，主题不透明背景、两侧同色遮罩和底边线。
- 【已核实】现行 [site-header.ts](../src/scripts/site-header.ts) 向下阅读隐藏、向上回看显示；页顶、顶栏含焦点或文字设置展开时保持可见。使用 12px 累积位移阈值与 rAF；不通过移除元素改变正文流。
- 【已核实】[BaseLayout](../src/layouts/BaseLayout.astro) 同步实际高度到 `--header-h`，用 ResizeObserver 响应字体与断点换行；CSS 中 73／119／120／170px 是不同断点的回退值，不是永久固定高度。
- 【已核实】`html` 的 `scroll-padding-top` 使用完整 `--header-h`；TOC 和图例使用 `--header-offset`，可见时等于实测高度、隐藏时为 0。无 JS 时保持 sticky，不自动隐藏。依据：[global.css](../src/styles/global.css)、[knowledge-tags.css](../src/styles/knowledge-tags.css)。
- 【用户决定】保留上述已实现的滚动显隐、焦点保护与无 JS 回退；本次仅确认规则，不修改顶栏 CSS／脚本。

## 已核实的侧边图例与断点

- 【已核实】[StudyModule](../src/components/StudyModule.astro) 只为信息安全设置 `showLegend`；[KnowledgeDirectory](../src/components/KnowledgeDirectory.astro) 只有一份 aside，定位参照包含介绍、全部章节和底部导航。
- 【已核实】宽屏 aside 在正文外侧：`left: 100%`、`margin-left: 24px`、`top: 0`、`height: 100%`、宽 150px、z-index 50；内部面板 sticky，距当前可见顶栏下方 16px，无卡片阴影。依据：[knowledge-tags.css](../src/styles/knowledge-tags.css)。
- 【已核实】正文最大宽度 `--max-width: 1120px`；断点计算 `1120 + 2 × (150 + 24 + 16) = 1500px`。CSS `@media (min-width: 1500px)` 与 [knowledge-directory.ts](../src/scripts/knowledge-directory.ts) 的 `matchMedia` 使用同一数值。
- 【已核实】≥1500px 只显示侧栏，CSS `display: none` 和脚本 `hidden` 禁用浮钮；低于断点默认只显示右下浮钮（z-index 60），点击展开同一份图例（aside 的 z-index 50），面板高度不超过视口 60%，支持外部点击／Escape／焦点转移。
- 【已核实】1100／1208／1280／1440px 均小于当前断点，默认只应有浮钮。图例按钮用 `aria-pressed`，只高亮类别，其他类别标签 opacity 0.3；筛选摘要仅有选中标签时出现。依据：[knowledge-directory.ts](../src/scripts/knowledge-directory.ts)、[KnowledgeDirectory](../src/components/KnowledgeDirectory.astro)。

## 改动与验收要求

【用户决定】改最大宽度／图例宽度／间距时重算断点，必须同时改 CSS、matchMedia、对应测试与本文件；改顶栏高度时复核实测值、回退值及两种偏移，不直接拿桌面高度覆盖手机。

【用户决定】至少检查四个指定宽度与实际断点两侧；浅／深色、桌面／触屏、Tab／Enter／Escape、锚点遮挡、搜索快捷键、正文宽度及无横向溢出。Safari／Chrome 未实测时明确标注；构建测试不等于视觉验收。保持祖先链无导致 sticky 失效的滚动容器，必要时用 `overflow-x: clip` 取代 `hidden`，但不为凑规则修改无关布局。

【已核实】相关回归覆盖见 [site-header.test.mjs](../tests/site-header.test.mjs)、[knowledge-tags.test.mjs](../tests/knowledge-tags.test.mjs)；热力图颜色职责另外见 [热力图规则](heatmap.md)。
