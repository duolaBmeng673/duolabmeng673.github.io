# 工具与资源导航

## 当前入口

- 顶栏保留“工具”，首页保留简短入口，统一进入 `/tools/`。
- 工具页沿用博客卡片、字体和明暗主题，不加载外站脚本、iframe、图标或其他远程资源。
- 点击卡片以 `target="_blank"`、`rel="noopener noreferrer"` 打开外部网站，并提供“新窗口打开”的无障碍说明。
- 内容来自作者提供的链接，不承诺外站一直免费、可用或无需账号。

## 自己添加或修改工具

只需要编辑 **`src/data/tools.json`**。每项必填 `name` 和 `url`：

```json
{
  "name": "我的工具",
  "url": "https://example.com/"
}
```

将该对象加入现有 JSON 数组，相邻对象之间使用逗号。不要在 JSON 中写注释或尾随逗号。数组中的顺序就是页面上的顺序。可以在本地编辑，也可以使用 GitHub 网页编辑器修改这个文件；随后按项目现有构建发布流程更新站点。

如需补充说明，可选填 `description` 与 `category`：

```json
{
  "name": "我的工具",
  "url": "https://example.com/",
  "category": "图片处理",
  "description": "一句简短的用途说明。"
}
```

没有说明时不渲染说明行；没有分类时使用网站域名，不生成空占位。名称和链接不接受 HTML。链接必须是完整的 HTTP / HTTPS 地址，且不得内嵌账号密码；重复地址和无效链接会在构建时报错。

`src/data/tools.ts` 负责类型与构建时校验，`ToolCard.astro` 负责统一渲染。新增链接无需修改导航、页面组件、首页、CSS 或 sitemap，也无需新增客户端脚本或依赖。

这是公开工具列表的源文件接口，不是匿名在线管理后台。GitHub Pages 是静态部署，浏览器里的临时输入不会直接修改仓库或所有访客看到的列表。

## 本次调整（2026-11-11）

收录 Twitter GIF Downloader、docsmall、iLovePDF、哲风壁纸、Konachan、React Bits、AI 中转站评测、React Drops，共 8 个外链。没有将它们写入文章搜索、RSS、文章分类或活动记录；sitemap 只收录本站 `/tools/`，不收录第三方 URL。

按作者要求移除博客的 `/tools/classrooms/` 页面、查询挂载脚本、专用样式及 `public/vendor/hit-classroom/` 引擎副本。旧查询地址不再生成，也不保留查询表单或快照入口。独立的 `hit-classroom-select` 项目不作修改，仍保留原代码。

原查询页曾在浏览器本地保存的缓存不会被本次更新主动读取或删除；如需清除，可以自行通过浏览器站点数据设置处理。

## 验证命令

```sh
npm run build
npm test
git diff --check
npm run preview -- --host 127.0.0.1 --port 4321
```

本地工具页：`http://127.0.0.1:4321/tools/`。第三方工具的登录、下载、计费及各项业务功能不属于本项目测试范围。
