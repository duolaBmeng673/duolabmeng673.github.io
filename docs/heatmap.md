# 更新记录热力图

【用户决定】2026-11-14 确认启用；本规范记录当前数据机制与维护规则，不推断或补造历史活动，不因编写或启用规则而添加一条博客功能活动。确认记录见 [rules-review.md](rules-review.md)。

## 已核实的数据流

【已核实】[首页](../src/pages/index.astro) 将 `getAllPosts()` 的公开文章与 [src/data/activities.ts](../src/data/activities.ts) 一并传给 [ActivityCalendar](../src/components/ActivityCalendar.astro)。数据来源分两路：

1. 自动首发：每篇公开文章生成一条 `type: 'writing'`、`count: 1`，描述取完整 `title`，日期取 `pubDate.toISOString().slice(0, 10)`。
2. 手工记录：`activities.ts` 中明确维护的活动，和自动首发合并后交给 [createActivityCalendar](../src/lib/activity.ts) 聚合。

【已核实】当前代码不读取 Git commit、文件 mtime、`updatedDate` 或正文 diff，也不根据学科把论文首发改成 Research、算法首发改成 Learning。依据：[ActivityCalendar](../src/components/ActivityCalendar.astro)、[activity.ts](../src/lib/activity.ts)、[activities.ts](../src/data/activities.ts)。

【已核实】组件在构建时输出格子、统计、初始详情与内嵌 JSON；[activity-calendar.ts](../src/scripts/activity-calendar.ts) 在浏览器按当天日期重算窗口并处理点击／键盘详情，不向网络请求新活动。刷新只会重读已生成页面，不能获得尚未重新构建／部署的数据。

## 已核实的数据结构

【已核实】[src/lib/activity.ts](../src/lib/activity.ts) 定义 `ActivityRecord`：

```ts
interface ActivityRecord {
  date: string;        // YYYY-MM-DD，真实日历日期
  type: ActivityType;
  count: number;       // 正整数
  description?: string;
}
```

【已核实】当前支持五类，不是最初方案中的四类：`coding`（代码开发）、`writing`（写作）、`research`（研究）、`learning`（学习）、`site`（博客功能）。类型、中文名称与详情分组顺序在 [activity.ts](../src/lib/activity.ts)，手工记录入口只有 [activities.ts](../src/data/activities.ts)。

【已核实】核实日为 2026-11-14；手工文件现有 2026-11-11 工具栏目、2026-11-13 知识点标签两条 `site/count: 1` 记录。这是当日快照，不是固定数量要求；本轮保留原数据不动。依据：[activities.ts](../src/data/activities.ts)。

## 已核实的统计与日期口径

- 【已核实】有效记录必须有合法日期、已知类型和正整数 `count`，不合法时抛错；日期范围外／未来的有效记录不计入当前窗口，但不会从数据文件删除。依据：[activity.ts](../src/lib/activity.ts)。
- 【已核实】同一天可有多种类型，同日同类型 `count` 累加，多条描述均保留；活跃天数是范围内至少有一条有效活动的日期数，活动次数是全部有效 `count` 之和。三条 `count=2、1、3` 的记录同日会得到 1 个活跃日、6 次活动。没有按文章／描述自动去重。依据：[activity.ts](../src/lib/activity.ts)、[activity.test.mjs](../tests/activity.test.mjs)。
- 【已核实】窗口包含今天共 365 天，即今天向前 364 天；使用运行环境的本地年月日与 `setDate` 跨月、跨年、闰日递增，补齐周边界的范围外格子为 `null`。记录用 `YYYY-MM-DDT00:00:00` 按本地日期校验；显示标签直接拆日期字符串，不再做 UTC 转换。依据：[activity.ts](../src/lib/activity.ts)。
- 【已核实】自动首发仍用 `pubDate` 的 UTC 日期字符串，而“今天”和窗口按构建／浏览器环境本地日期计算。仓库中未发现统一固定统计时区配置；不能写成全链路都固定北京／新加坡时间。依据：[ActivityCalendar](../src/components/ActivityCalendar.astro)、[activity.ts](../src/lib/activity.ts)、[部署工作流](../.github/workflows/deploy.yml)。
- 【已核实】强度等级：0 次→0、1 次→1、2–3 次→2、4–6 次→3、≥7 次→4；单独 `site` 日用暖陶色，同日兼有内容活动时保留内容强度与暖陶小圆点，统计不互相覆盖。依据：[activity.ts](../src/lib/activity.ts)、[ActivityCalendar](../src/components/ActivityCalendar.astro)、[global.css](../src/styles/global.css)。

## 已核实的记入规则与更新方式

【已核实】以下规则已经写在 [activities.ts](../src/data/activities.ts) 的注释中，本稿没有新增自动推断：

| 实际改动 | 当前处理方式 |
|---|---|
| 新增公开文章 | 随公开集合自动产生一次 Writing，保留真实 `pubDate`；不要再手写一条相同首发 |
| 实质性修改既有文章 | 可以显式维护 `writing/count: 1`；不会由 `updatedDate` 自动产生 |
| 仅 Front Matter／格式／空白变化 | 不追加更新活动；首发自动记录仍保留 |
| 同日修改多篇文章 | 确认各篇均为实质更新后分别维护记录；聚合会相加 |
| 同篇反复保存／多次 commit | 不自动多记；再次实质更新必须有明确记录和依据 |
| 已完成博客功能调整 | 用现有 `site` 类型按一次已完成改动记，不按文件或 commit 计数 |

【用户决定】不得随机填充活动或虚构历史。来源不足时保留空日期，不把“这天有 Git 提交”当成上述实质活动的充分证据；不要为刷新热力图改写文章发布日期。

【已核实】目前真正的更新路径是：

1. 内容变更维护内容集合所需源文件；只有确认需要额外活动时，编辑 [activities.ts](../src/data/activities.ts)。
2. 执行 `npm run build`，重新生成首页内嵌数据；再执行 `npm test` 与 `git diff --check`。命令依据：[package.json](../package.json)。
3. 用 `npm run preview -- --host 127.0.0.1` 预览本地 `dist`，核对对应日期、描述、按类型计数与年度合计。访问地址以终端实际输出为准；预览命令依据：[package.json](../package.json)、[README](../README.md)。
4. 只有另获 Git／发布授权后才进入原有发布流程：[deploy.yml](../.github/workflows/deploy.yml) 在推送 `main` 或手动 workflow_dispatch 后依次安装、构建、测试、部署 `dist`。本地构建或本地 commit 均不更新线上页面；本稿不授权执行提交／推送／部署。

【已核实】仓库中未发现独立的“更新热力图”npm 命令、Git hook、GitHub Contributions 导入脚本或定时采集任务。依据：[package.json](../package.json)、[活动数据与聚合代码](../src/lib/activity.ts)、[部署工作流](../.github/workflows/deploy.yml)。`ActivityRecord[]` 可供未来数据导入复用，但现有类型接口不等于已实现导入功能。

## 验证与联动

【用户决定】每次涉及活动的改动，都先区分自动首发和手工更新，核对是否重复、是否改变历史，再验证范围内日期的活跃天数与 `count` 之和；仅文档维护不添加活动。工作流变化在同一次提交中同步本文件与 [AGENTS.md](../AGENTS.md)，但是否提交仍须用户授权。

【已核实】[activity.test.mjs](../tests/activity.test.mjs) 覆盖有效性、聚合、范围、闰年、跨年、时区／夏令时、静态首发映射、活动／空日期详情及键盘交互等；测试需先构建。实际主题色来自 [global.css](../src/styles/global.css)，选中／焦点用中性描边，组件无需 JS 也有初始格子与详情；无 JS 时不具备动态切换日期能力，不能声称全部交互均可用。

【用户决定】涉及渲染或交互时，另看浅／深色及系统主题、移动端点击／横向滚动、键盘焦点与详情换行。没做真实浏览器验收就明确标注；代码／数据测试不能代替这一步。
