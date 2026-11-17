# 真机性能与功耗自测指南

本页提供在真实桌面 Chrome / macOS 环境下复测首页空闲、滚出波浪与切后台标签页 CPU／GPU 占用的可复现方法与测试脚本（不以无头 Chrome 虚拟 GPU 采样当作真机体感结论）。

---

## 一、真机目视与系统监视器测试步骤

1. 先构建并启动本地预览服务器（使用 Node 22）：

   ```sh
   npm run build
   npm run preview
   ```

2. 在真机桌面 **Google Chrome** 打开 `http://localhost:4321/`（窗口宽 `1920`、缩放 DPR `2`）。
3. 打开 **Chrome DevTools → More tools → Performance monitor**（或 macOS **活动监视器 → 能耗 / CPU / GPU 历史**），分别观察三个 30 秒窗口：
   - **窗口 1（空闲 30s，位于页面顶部 `y = 0`）**：鼠标静止不动，观察 `GradientWaves`（上限 `30 fps`、`dpr <= 1.5`）与静止点阵画布在 Chrome GPU Helper 与渲染进程中的稳定占用；
   - **窗口 2（滚出波浪 30s，向下滚动约 `1200px`）**：`GradientWaves` 离开视口后通过 `IntersectionObserver` 立即停止 `requestAnimationFrame`；进入视口的 837 知识点弹幕仅由 GPU 合成器运行纯 CSS `transform`（主线程 JS 为 `0`）；
   - **窗口 3（切后台标签页 30s）**：新建并切换到空白标签页，使博客首页触发 `visibilitychange`（`document.hidden === true`），所有 `rAF` 与定时器彻底停摆，CPU / GPU 应回落至 ~`0%`。

---

## 二、可复现的 Chrome CDP 指标采集脚本

如需自动记录主线程 `TaskDuration` / `ScriptDuration` / `RecalcStyleDuration` 及渲染器／GPU 进程 CPU 均值，可保存以下脚本为 `scripts/perf-bench.mjs`（或在临时目录运行）并与任意对照组比较：

```js
import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9233);
const DURATION_MS = Number(process.env.DURATION_MS || 30000);
const URL_ARG = process.argv[2] || 'http://127.0.0.1:4321/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.ready = new Promise((res, rej) => {
      this.ws.addEventListener('open', res);
      this.ws.addEventListener('error', rej);
    });
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }
  async call(method, params = {}) {
    await this.ready;
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    try { this.ws.close(); } catch {}
  }
}

function sampleChromeProcessCpu(rootPid) {
  const out = execSync('ps -ax -o pid=,ppid=,pcpu=,args=', { encoding: 'utf8' });
  const rows = out.trim().split('\n').map((line) => {
    const m = line.trim().match(/^(\d+)\s+(\d+)\s+([\d.]+)\s+(.+)$/);
    return m ? { pid: Number(m[1]), ppid: Number(m[2]), cpu: Number(m[3]), args: m[4] } : null;
  }).filter(Boolean);
  const pids = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of rows) {
      if (pids.has(r.ppid) && !pids.has(r.pid)) { pids.add(r.pid); changed = true; }
    }
  }
  let totalCpu = 0, rendererCpu = 0, gpuCpu = 0;
  for (const r of rows) {
    if (!pids.has(r.pid)) continue;
    totalCpu += r.cpu;
    if (r.args.includes('--type=renderer')) rendererCpu += r.cpu;
    else if (r.args.includes('--type=gpu-process')) gpuCpu += r.cpu;
  }
  return { totalCpu, rendererCpu, gpuCpu };
}

const toMap = (list) => Object.fromEntries(list.map((m) => [m.name, m.value]));

async function measureWindow(cdp, rootPid, ms) {
  const start = toMap((await cdp.call('Performance.getMetrics')).metrics);
  const samples = [];
  const steps = Math.max(1, Math.round(ms / 2000));
  for (let i = 0; i < steps; i++) {
    await sleep(2000);
    samples.push(sampleChromeProcessCpu(rootPid));
  }
  const end = toMap((await cdp.call('Performance.getMetrics')).metrics);
  const avg = (k) => Number((samples.reduce((s, x) => s + x[k], 0) / samples.length).toFixed(2));
  return {
    cdpTaskMs: Number(((end.TaskDuration - start.TaskDuration) * 1000).toFixed(1)),
    cdpScriptMs: Number(((end.ScriptDuration - start.ScriptDuration) * 1000).toFixed(1)),
    cdpRecalcMs: Number(((end.RecalcStyleDuration - start.RecalcStyleDuration) * 1000).toFixed(1)),
    osTotalCpuAvgPct: avg('totalCpu'),
    osRendererCpuAvgPct: avg('rendererCpu'),
    osGpuCpuAvgPct: avg('gpuCpu'),
  };
}

const userDataDir = mkdtempSync(join(tmpdir(), 'cdp-bench-'));
// 如需测真实桌面窗口渲染，去掉 '--headless=new' 即可
const proc = spawn(CHROME, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${userDataDir}`,
  '--window-size=1920,1080',
  '--force-device-scale-factor=2',
  '--no-first-run',
  '--no-default-browser-check',
], { stdio: 'ignore' });

try {
  let target = null;
  for (let i = 0; i < 40; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
      target = list.find((t) => t.type === 'page');
      if (target) break;
    } catch {}
    await sleep(250);
  }
  const cdp = new CDPClient(target.webSocketDebuggerUrl);
  await cdp.call('Page.enable');
  await cdp.call('Runtime.enable');
  await cdp.call('Performance.enable');
  await cdp.call('Page.navigate', { url: URL_ARG });
  await sleep(3000);

  const idle30 = await measureWindow(cdp, proc.pid, DURATION_MS);
  await cdp.call('Runtime.evaluate', { expression: 'window.scrollTo(0, 1200)' });
  await sleep(800);
  const scrolled30 = await measureWindow(cdp, proc.pid, DURATION_MS);
  await cdp.call('Runtime.evaluate', { expression: 'window.scrollTo(0, 0)' });
  const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json());
  await fetch(`http://127.0.0.1:${PORT}/json/activate/${tab.id}`);
  await sleep(500);
  const hidden30 = await measureWindow(cdp, proc.pid, DURATION_MS);

  console.log(JSON.stringify({ url: URL_ARG, idle30, scrolled30, hidden30 }, null, 2));
  cdp.close();
} finally {
  proc.kill('SIGTERM');
  rmSync(userDataDir, { recursive: true, force: true });
}
```

### 运行命令示例

```sh
# 测有头真机窗口（去掉 --headless=new 后）30 秒各场景占用
DURATION_MS=30000 node perf-bench.mjs http://127.0.0.1:4321/
```
