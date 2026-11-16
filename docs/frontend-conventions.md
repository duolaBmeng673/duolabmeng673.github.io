# 前端开发与架构规范

【用户决定】2026-11-16 确立并启用；适用于本仓库 Astro 静态站点中「Astro 零 JS 组件 + 原生 TS 脚本 + 局部 React 岛」的混合渲染架构。任何跨层改动须遵循本文件并与 [仓库联动规则](../AGENTS.md) 一并验收。

---

## 1. 分工边界

- **React 岛适用范围**：只用于「有内部状态、需要持续重绘」的局部交互岛，目前仅限于首页的 **`GradientWaves`**（WebGL2 着色器画布）、**`ActivityHeatmap`**（交互式活动热力图画布与当日明细）与 **`CardSwap`**（专题传送门立体叠卡交互，纯 React + CSS 动效，不引入 `gsap`）。
- **零 JS / 原生 TS 默认原则**：页面骨架、静态展示、文章、目录、导航与工具入口一律使用 `.astro` 组件（零 JS）或原生 TypeScript 模块（`src/scripts/*.ts`）。
- **图标与动效**：图标一律使用内联 SVG；**不得安装** `gsap`、`motion`、`lucide-react` 等第三方动效或图标库。
- **新增 React 组件审批门槛**：新增交互默认采用原生 TS。若确需使用 React 实现新组件，必须在 PR / 提交说明中明确写出不得不引入 React 的理由，经用户确认后方可实施。

---

## 2. 互不越界（边界与通信协议）

### 2.1 写权限与读权限分离

- React 岛 **不得读写** `document.documentElement` / `document.body` 上由原生脚本或首屏内联脚本管理的站点级属性与变量，包括但不限于：
  - 主题状态：`data-theme`、`data-theme-mode`
  - 字号／字重：`--font-scale`、`data-font-bold`
  - 顶栏实测高度／显隐：`--header-h`、`--header-offset`、`data-header-hidden`
  - 舞台 Preset 选择：`data-preset`
- 上述全局状态统一由 [BaseLayout.astro](../src/layouts/BaseLayout.astro) `<head>` 内联脚本（首屏前同步恢复）与 `src/scripts/*.ts` 负责写入；React 岛仅可通过 `getComputedStyle`、CSS 变量、`MutationObserver`（监听 `data-theme` / `data-preset` 等属性只读变化）进行**只读读取**。

### 2.2 DOM 所有权与通信通道

- 原生脚本（`src/scripts/*.ts`）**不得查询或修改** React 岛内部渲染出的子节点（岛内部 DOM 由 React 全权管理）；只允许通过外层容器元素或标准化协议通信。
- Astro / 原生脚本 与 React 岛之间的全部通信只允许通过以下三种通道：
  1. **CSS 变量**（如 `--tx`、`--ac`、`--h0`..`--h4`、`--h-site` 等令牌）；
  2. **宿主 / 文档 `data-*` 属性**（如 `data-theme`、`data-preset`）；
  3. **自定义事件 `CustomEvent`**，事件名统一使用 `duolabmeng673:*` 前缀（例如 `duolabmeng673:preset-change`、`duolabmeng673:theme-change`）。

### 2.3 存储键单一来源

- 全局 `localStorage` 键名只能在 [src/lib/storage-keys.ts](../src/lib/storage-keys.ts) 唯一定义并导出 `STORAGE_KEYS`。
- 所有原生脚本须从 `src/lib/storage-keys.ts` 导入；[BaseLayout.astro](../src/layouts/BaseLayout.astro) 中的 `<script is:inline>` 须通过 Astro `define:vars` 注入键值，不得在多处重复硬编码键名字符串。

### 2.4 桌面顶栏全站统一行为（[site-header.ts](../src/scripts/site-header.ts)）

- **桌面端**（`(min-width: 1024px) and (hover: hover) and (pointer: fine)`）：全站所有页面（首页、归档、837 目录与文章页等）顶栏均常驻显示、**永不因下滑而隐藏**；`.site-header` 固定在 `top: 12px`（并在上方 `0..12px` 加同页背景色 `var(--bg)` 遮罩带防止正文透出）；`scrollY < 8` 时平铺无边框无背景，`scrollY >= 8` 后过渡为 `14px` 圆角矩形、带边框与毛玻璃背景。
- **手机端 / 触屏端**（`< 1024px` 或粗指针）：保持下滑隐藏、上滑显示与胶囊外观逻辑不变。

---

## 3. React 岛的写法规范

1. **目录与命名**：全部 React 岛文件只允许存放在 `src/components/islands/` 目录下，文件名强制采用 `*.island.tsx`（辅以同目录局部样式或工具模块，严禁把无关 React 代码散落到其他目录）。
2. **水合指令**：
   - `ActivityHeatmap`（首屏舞台核心交互）与 `CardSwap`（底部专题叠卡交互）使用 `client:visible`；
   - `GradientWaves`（顶部装饰着色器背景，且已配备同等尺寸静态渐变占位）允许使用 `client:idle` 推迟 React 运行时加载，避免阻塞首屏；
   - **禁止使用 `client:load`**（除非事前报告理由并获得用户明确批准）。
3. **数据流**：全部业务数据（活动记录、写作日期、预设色板等）只能在 `.astro` 页面于构建期准备好，并通过**可序列化的 `props`** 传入岛内；**严禁**在岛内 `fetch` 站内数据、导入大型内容集合或硬编码快照。
4. **副作用与资源清理**：岛内每个 `useEffect` / `useLayoutEffect` **必须返回清理函数**，确保卸载或重跑时完整清理：
   - 取消 `requestAnimationFrame`（`cancelAnimationFrame`）与定时器（`clearTimeout` / `clearInterval`）；
   - 断开 `ResizeObserver`、`IntersectionObserver`、`MutationObserver`（`.disconnect()`）；
   - 移除注册的 `window` / `document` / `MediaQueryList` 事件监听（`removeEventListener`）；
   - 若使用了 WebGL / WebGL2 上下文（如 `GradientWaves`），清理时应释放在该节点上创建的缓冲、着色器程序并调用 `WEBGL_lose_context`（如可用）及清空画布。
5. **无障碍与功耗节制（含波浪与合成层约束）**：
   - 必须响应 `prefers-reduced-motion: reduce`（停止连续动画并回落到静态首帧）；
   - 必须响应页面可见性变化（`document.visibilityState === 'hidden'` / `visibilitychange` 事件）以及组件不可见状态（`IntersectionObserver`），在隐藏或滚出视口时立即停止 `requestAnimationFrame` 循环；
   - `GradientWaves` 须限制内部画布 `dpr <= 1.5` 与渲染帧率上限 `30 fps`；
   - 收敛 `backdrop-filter`：只保留在悬浮于波浪或正文之上的半透明层（顶栏胶囊、舞台 4 窗口、热力图悬停浮层、CardSwap 控制栏），普通静止卡片不再使用 `backdrop-filter`。
6. **无 JS 与水合前占位（零布局跳动）**：
   - 每个 React 岛在未水合或用户禁用 JS 时，必须有由 Astro 服务端同步渲染出的静态占位内容（如 `GradientWaves` 的固定高度静态渐变背景、`ActivityHeatmap` 的活动汇总与近期真实活动列表）。
   - 静态占位与岛水合完成后的外框尺寸（高度、宽高比、边距与流式断点）必须保持一致，**不得发生任何可见布局跳动（CLS）**；水合后不得改变服务端已渲染的外框尺寸。

---

## 4. 原生脚本写法规范（`src/scripts/*.ts`）

- 沿用现有站点的一次性模块加载模式，保持原生 MPA 多页跳转；**不启用 Astro View Transitions（`<ClientRouter />`）**，不引入 `astro:page-load` / `astro:after-swap` 等整站切换生命周期补丁。
- 涉及 DOM 绑定的初始化逻辑必须**幂等**（例如通过容器上的初始化标记 `dataset.initialized` 或事件委托防护），防止脚本或热重载场景下对同一元素重复绑定监听。

---

## 5. 明确禁止引入的内容

- **禁止**引入全局 React Context 管理站点级状态（主题、字号、导航、Preset 等）；
- **禁止**引入第二套前端路由（如 `react-router-dom`）或第二套全局状态库（如 Redux、Zustand、Jotai）；
- **禁止**在任何 React 岛内部直接读写 `localStorage` 中的主题、字号、Preset 等站点偏好键。

---

## 6. 体积预算与隔离红线

- **首页 JS 预算（提醒线）**：首页全部客户端脚本（Astro 脚本 + React 岛及其按需运行时）**总计 gzip 预估不超过 `90 KB`**。若构建后超出该提醒线，必须停止并逐文件列出原始大小与 gzip 大小向用户汇报，由用户决定取舍。
- **非首页零 React 隔离（硬红线）**：React 运行时与任何 React 岛脚本 **只能出现在首页**（`dist/index.html`）。文章页、学习笔记目录页、技术笔记归档页、工具页、关于页等全部非首页产物的 JS 体积与脚本列表均**不得引入 React 运行时**，且每次构建须通过自动化静态检查验证。

> 真机 CPU／GPU 实测方法与 Chrome CDP 采集脚本见 [performance-benchmark.md](performance-benchmark.md)。
