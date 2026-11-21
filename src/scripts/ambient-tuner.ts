/**
 * Interactive Chinese-labeled parameter tuner overlay for ambient-grid.ts.
 * Temporary local tuning workbench — zero React, zero localStorage literals (uses sessionStorage).
 */

export interface AmbientTuneConfig {
  // 网格与分辨率
  cellSize: number;
  dprCap: number;
  dotMinR: number;
  dotMaxR: number;
  glyphFontSize: number;
  blockFontSize: number;
  // 全局亮度与透明度
  darkMinAlpha: number;
  darkMaxAlpha: number;
  darkBoostCap: number;
  lightMinAlpha: number;
  lightMaxAlpha: number;
  lightBoostCap: number;
  // 色阶与区域色温
  darkLowSat: number;
  darkLowLit: number;
  darkHighSat: number;
  darkHighLit: number;
  tonePeriod: number;
  toneContrast: number;
  // 背景起伏与空洞
  fieldPeriod: number;
  driftSpeed: number;
  voidRatio: number;
  voidSoftness: number;
  patchStrength: number;
  // 上半区高度与渐隐
  backdropHeightVh: number;
  fadeStartPct: number;
  // 点击波浪与切换波浪
  clickMaxR: number;
  clickDuration: number;
  clickFeather: number;
  clickFadeStart: number;
  waveSpeed: number;
  waveLead: number;
  waveDither: number;
  waveWake: number;
  // 帧率
  idleFps: number;
  activeFps: number;
}

export const DEFAULT_TUNE_CONFIG: AmbientTuneConfig = {
  cellSize: 14,
  dprCap: 2,
  dotMinR: 3.5,
  dotMaxR: 5.6,
  glyphFontSize: 11,
  blockFontSize: 9.5,
  darkMinAlpha: 0.25,
  darkMaxAlpha: 0.52,
  darkBoostCap: 0.95,
  lightMinAlpha: 0.115,
  lightMaxAlpha: 0.135,
  lightBoostCap: 0.85,
  darkLowSat: 0.5,
  darkLowLit: 0.6,
  darkHighSat: 1.04,
  darkHighLit: 1.08,
  tonePeriod: 43,
  toneContrast: 1.45,
  fieldPeriod: 30,
  driftSpeed: 2,
  voidRatio: 0.36,
  voidSoftness: 0.8,
  patchStrength: 1.15,
  backdropHeightVh: 100,
  fadeStartPct: 95,
  clickMaxR: 280,
  clickDuration: 2050,
  clickFeather: 64,
  clickFadeStart: 0.5,
  waveSpeed: 450,
  waveLead: 130,
  waveDither: 230,
  waveWake: 330,
  idleFps: 41,
  activeFps: 39,
};

interface SliderDef {
  key: keyof AmbientTuneConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  rebuild?: 'atlas' | 'grid' | 'backdrop';
}

interface GroupDef {
  title: string;
  open?: boolean;
  items: SliderDef[];
}

const GROUPS: GroupDef[] = [
  {
    title: '一、全局亮度与透明度',
    open: true,
    items: [
      { key: 'darkMinAlpha', label: '深色 · 最暗点格透明度', min: 0.01, max: 0.35, step: 0.005 },
      { key: 'darkMaxAlpha', label: '深色 · 最亮点格透明度', min: 0.08, max: 0.6, step: 0.005 },
      { key: 'darkBoostCap', label: '深色 · 波浪提亮上限', min: 0.2, max: 0.95, step: 0.01 },
      { key: 'lightMinAlpha', label: '浅色 · 最暗点格透明度', min: 0.01, max: 0.3, step: 0.005 },
      { key: 'lightMaxAlpha', label: '浅色 · 最亮点格透明度', min: 0.06, max: 0.5, step: 0.005 },
      { key: 'lightBoostCap', label: '浅色 · 波浪提亮上限', min: 0.15, max: 0.85, step: 0.01 },
    ],
  },
  {
    title: '二、网格密度与分辨率',
    open: true,
    items: [
      { key: 'cellSize', label: '点阵格子步距', min: 9, max: 20, step: 1, unit: 'px', rebuild: 'grid' },
      { key: 'dprCap', label: '画布清晰度上限 (DPR)', min: 1, max: 2, step: 0.5, unit: 'x', rebuild: 'grid' },
      { key: 'dotMinR', label: '蓝圆 · 最小半径', min: 0.5, max: 3.5, step: 0.1, unit: 'px', rebuild: 'atlas' },
      { key: 'dotMaxR', label: '蓝圆 · 最大半径', min: 3.0, max: 7.5, step: 0.1, unit: 'px', rebuild: 'atlas' },
      { key: 'glyphFontSize', label: '粉色 0/1 字号', min: 7, max: 13, step: 0.5, unit: 'px', rebuild: 'atlas' },
      { key: 'blockFontSize', label: '褐色镂空 0/1 字号', min: 6.5, max: 12.5, step: 0.5, unit: 'px', rebuild: 'atlas' },
    ],
  },
  {
    title: '三、深色色阶与区域色温',
    items: [
      { key: 'darkLowSat', label: '深色 · 暗区饱和度倍率', min: 0.1, max: 1.2, step: 0.02, rebuild: 'atlas' },
      { key: 'darkLowLit', label: '深色 · 暗区明度倍率', min: 0.4, max: 1.3, step: 0.02, rebuild: 'atlas' },
      { key: 'darkHighSat', label: '深色 · 亮区饱和度倍率', min: 0.6, max: 1.5, step: 0.02, rebuild: 'atlas' },
      { key: 'darkHighLit', label: '深色 · 亮区明度倍率', min: 0.7, max: 1.5, step: 0.02, rebuild: 'atlas' },
      { key: 'tonePeriod', label: '区域色温起伏尺寸', min: 8, max: 45, step: 1, unit: '格' },
      { key: 'toneContrast', label: '区域色温反差强度', min: 0.3, max: 2.5, step: 0.05 },
    ],
  },
  {
    title: '四、背景起伏与空洞（可选）',
    items: [
      { key: 'fieldPeriod', label: '明暗起伏尺寸', min: 6, max: 36, step: 1, unit: '格' },
      { key: 'driftSpeed', label: '背景流动速度倍率', min: 0, max: 3, step: 0.05, unit: 'x' },
      { key: 'voidRatio', label: '空洞面积占比 (0=无空洞)', min: 0, max: 0.45, step: 0.01 },
      { key: 'voidSoftness', label: '空洞边缘柔和度', min: 0.15, max: 1, step: 0.05 },
      { key: 'patchStrength', label: '微光流动光斑强度', min: 0, max: 1.5, step: 0.05 },
    ],
  },
  {
    title: '五、上半区范围与渐隐',
    items: [
      { key: 'backdropHeightVh', label: '上半区点阵高度', min: 40, max: 100, step: 1, unit: 'vh', rebuild: 'backdrop' },
      { key: 'fadeStartPct', label: '开始渐隐位置', min: 30, max: 95, step: 1, unit: '%', rebuild: 'backdrop' },
    ],
  },
  {
    title: '六、点击波浪与切换波浪',
    items: [
      { key: 'clickMaxR', label: '点击波浪 · 最大半径', min: 80, max: 420, step: 10, unit: 'px' },
      { key: 'clickDuration', label: '点击波浪 · 持续时长', min: 500, max: 2500, step: 50, unit: 'ms' },
      { key: 'clickFeather', label: '点击波浪 · 边缘羽化', min: 16, max: 120, step: 2, unit: 'px' },
      { key: 'clickFadeStart', label: '点击波浪 · 衰减起始比例', min: 0.2, max: 0.85, step: 0.05 },
      { key: 'waveSpeed', label: '切换波浪 · 传播速度', min: 250, max: 1500, step: 20, unit: 'px/s' },
      { key: 'waveLead', label: '切换波浪 · 前导压缩带', min: 20, max: 180, step: 5, unit: 'px' },
      { key: 'waveDither', label: '切换波浪 · 交错翻转带', min: 40, max: 280, step: 10, unit: 'px', rebuild: 'grid' },
      { key: 'waveWake', label: '切换波浪 · 尾迹高亮带', min: 80, max: 420, step: 10, unit: 'px' },
    ],
  },
  {
    title: '七、性能与帧率',
    items: [
      { key: 'idleFps', label: '静息漂移帧率', min: 4, max: 60, step: 1, unit: 'fps' },
      { key: 'activeFps', label: '波浪交互帧率', min: 20, max: 60, step: 1, unit: 'fps' },
    ],
  },
];

const SESSION_KEY = 'ambient-tuner-v2';

export const loadTuneConfig = (): AmbientTuneConfig => {
  const base = { ...DEFAULT_TUNE_CONFIG };
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<AmbientTuneConfig>;
    for (const k of Object.keys(base) as Array<keyof AmbientTuneConfig>) {
      if (typeof parsed[k] === 'number' && Number.isFinite(parsed[k])) {
        base[k] = parsed[k] as number;
      }
    }
  } catch {
    // ignore storage errors
  }
  return base;
};

const saveTuneConfig = (cfg: AmbientTuneConfig) => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(cfg));
  } catch {
    // ignore storage errors
  }
};

export interface TunerCallbacks {
  onChange: (cfg: AmbientTuneConfig, rebuild?: 'atlas' | 'grid' | 'backdrop') => void;
  onTriggerPreset: (slug: 'all' | 'research' | 'cs' | '837') => void;
}

const fmtVal = (v: number, step: number, unit?: string): string => {
  const decimals = step < 0.01 ? 3 : step < 0.1 ? 2 : step < 1 ? 1 : 0;
  return `${v.toFixed(decimals)}${unit ? ` ${unit}` : ''}`;
};

export const mountAmbientTuner = (cfg: AmbientTuneConfig, callbacks: TunerCallbacks) => {
  if (document.querySelector('[data-ambient-tuner-panel]')) return;

  const style = document.createElement('style');
  style.textContent = `
    .ambient-tuner-root {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 90;
      font-family: var(--sans, system-ui, sans-serif);
      font-size: 12px;
      color: var(--tx, #f4f4f5);
      user-select: none;
    }
    .ambient-tuner-toggle {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 999px;
      border: 1px solid var(--bd-strong, rgba(255,255,255,0.24));
      background: var(--bg-elev, #0e0e10);
      color: var(--tx, #f4f4f5);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    }
    .ambient-tuner-panel {
      width: 344px;
      max-width: calc(100vw - 24px);
      max-height: min(72vh, 620px);
      display: flex;
      flex-direction: column;
      border-radius: 10px;
      border: 1px solid var(--bd-strong, rgba(255,255,255,0.22));
      background: color-mix(in srgb, var(--bg-elev, #0e0e10) 92%, transparent);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      box-shadow: 0 16px 42px rgba(0,0,0,0.45);
      overflow: hidden;
    }
    .ambient-tuner-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--bd, rgba(255,255,255,0.12));
    }
    .ambient-tuner-title {
      font-weight: 600;
      font-size: 13px;
    }
    .ambient-tuner-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--bd, rgba(255,255,255,0.1));
    }
    .ambient-tuner-chip {
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid var(--bd-ctl, rgba(255,255,255,0.18));
      background: var(--glass, rgba(255,255,255,0.04));
      color: var(--tx, #f4f4f5);
      font-size: 12px;
      cursor: pointer;
    }
    .ambient-tuner-chip:hover {
      border-color: var(--ac, currentColor);
    }
    .ambient-tuner-body {
      flex: 1 1 auto;
      overflow-y: auto;
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .ambient-tuner-group {
      border: 1px solid var(--bd, rgba(255,255,255,0.1));
      border-radius: 7px;
      padding: 6px 8px;
      background: color-mix(in srgb, var(--bg, #050505) 40%, transparent);
    }
    .ambient-tuner-group > summary {
      cursor: pointer;
      font-weight: 600;
      font-size: 12px;
      padding: 2px 0;
      list-style: none;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .ambient-tuner-group > summary::after {
      content: '▸';
      opacity: 0.65;
    }
    .ambient-tuner-group[open] > summary::after {
      content: '▾';
    }
    .ambient-tuner-items {
      display: grid;
      gap: 7px;
      margin-top: 8px;
    }
    .ambient-tuner-row {
      display: grid;
      gap: 3px;
    }
    .ambient-tuner-row-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .ambient-tuner-row-val {
      font-family: var(--mono, ui-monospace, monospace);
      color: var(--ts, #c8c8cd);
      font-size: 11px;
    }
    .ambient-tuner-row input[type="range"] {
      width: 100%;
      margin: 0;
      accent-color: var(--ac, #f08050);
      cursor: pointer;
    }
    .ambient-tuner-foot {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 9px 12px;
      border-top: 1px solid var(--bd, rgba(255,255,255,0.12));
    }
    .ambient-tuner-btn {
      flex: 1 1 auto;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid var(--bd-ctl, rgba(255,255,255,0.2));
      background: var(--glass, rgba(255,255,255,0.06));
      color: var(--tx, #f4f4f5);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
    }
    .ambient-tuner-btn.is-primary {
      background: var(--btn, #e4e4e7);
      color: var(--btnt, #09090b);
      border-color: transparent;
      font-weight: 600;
    }
    .ambient-tuner-json {
      width: 100%;
      min-height: 84px;
      margin-top: 6px;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid var(--bd-ctl, rgba(255,255,255,0.2));
      background: var(--bg, #050505);
      color: var(--tx, #f4f4f5);
      font-family: var(--mono, ui-monospace, monospace);
      font-size: 11px;
      resize: vertical;
      user-select: text;
    }
  `;
  document.head.append(style);

  const root = document.createElement('div');
  root.className = 'ambient-tuner-root';
  root.dataset.ambientTunerPanel = '1';

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'ambient-tuner-toggle';
  toggleBtn.textContent = '点阵调参面板';

  const panel = document.createElement('div');
  panel.className = 'ambient-tuner-panel';

  const head = document.createElement('div');
  head.className = 'ambient-tuner-head';
  const title = document.createElement('span');
  title.className = 'ambient-tuner-title';
  title.textContent = '背景点阵参数调教面板';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'ambient-tuner-chip';
  closeBtn.textContent = '收起';
  head.append(title, closeBtn);

  const bar = document.createElement('div');
  bar.className = 'ambient-tuner-bar';
  const presetDefs: Array<{ slug: 'all' | 'research' | 'cs' | '837'; label: string }> = [
    { slug: 'all', label: '全部·紫' },
    { slug: 'research', label: '论文·蓝' },
    { slug: 'cs', label: '技术·粉' },
    { slug: '837', label: '837·褐' },
  ];
  for (const p of presetDefs) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ambient-tuner-chip';
    b.textContent = p.label;
    b.addEventListener('click', () => callbacks.onTriggerPreset(p.slug));
    bar.append(b);
  }
  const themeBtn = document.createElement('button');
  themeBtn.type = 'button';
  themeBtn.className = 'ambient-tuner-chip';
  themeBtn.textContent = '切换明/暗';
  themeBtn.addEventListener('click', () => {
    const headerThemeToggle = document.querySelector<HTMLButtonElement>('[data-theme-cycle]');
    if (headerThemeToggle) {
      headerThemeToggle.click();
    } else {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
    }
  });
  bar.append(themeBtn);

  const body = document.createElement('div');
  body.className = 'ambient-tuner-body';

  const sliderMap = new Map<keyof AmbientTuneConfig, { input: HTMLInputElement; valEl: HTMLSpanElement; def: SliderDef }>();

  for (const group of GROUPS) {
    const details = document.createElement('details');
    details.className = 'ambient-tuner-group';
    if (group.open) details.open = true;
    const summary = document.createElement('summary');
    summary.textContent = group.title;
    const itemsWrap = document.createElement('div');
    itemsWrap.className = 'ambient-tuner-items';

    for (const def of group.items) {
      const row = document.createElement('label');
      row.className = 'ambient-tuner-row';
      const top = document.createElement('div');
      top.className = 'ambient-tuner-row-top';
      const lbl = document.createElement('span');
      lbl.textContent = def.label;
      const valEl = document.createElement('span');
      valEl.className = 'ambient-tuner-row-val';
      valEl.textContent = fmtVal(cfg[def.key], def.step, def.unit);
      top.append(lbl, valEl);

      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(def.min);
      input.max = String(def.max);
      input.step = String(def.step);
      input.value = String(cfg[def.key]);

      input.addEventListener('input', () => {
        const nextVal = Number(input.value);
        cfg[def.key] = nextVal;
        valEl.textContent = fmtVal(nextVal, def.step, def.unit);
        saveTuneConfig(cfg);
        syncJsonBox();
        callbacks.onChange(cfg, def.rebuild);
      });

      sliderMap.set(def.key, { input, valEl, def });
      row.append(top, input);
      itemsWrap.append(row);
    }

    details.append(summary, itemsWrap);
    body.append(details);
  }

  const jsonBox = document.createElement('textarea');
  jsonBox.className = 'ambient-tuner-json';
  jsonBox.readOnly = true;
  jsonBox.hidden = true;

  const syncJsonBox = () => {
    jsonBox.value = JSON.stringify(cfg, null, 2);
  };
  syncJsonBox();

  const foot = document.createElement('div');
  foot.className = 'ambient-tuner-foot';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'ambient-tuner-btn is-primary';
  copyBtn.textContent = '复制参数 JSON';
  copyBtn.addEventListener('click', async () => {
    syncJsonBox();
    const text = jsonBox.value;
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = '已复制 ✓';
      setTimeout(() => {
        copyBtn.textContent = '复制参数 JSON';
      }, 1600);
    } catch {
      jsonBox.hidden = false;
      jsonBox.focus();
      jsonBox.select();
      copyBtn.textContent = '请手动复制下方 JSON';
      setTimeout(() => {
        copyBtn.textContent = '复制参数 JSON';
      }, 2000);
    }
  });

  const jsonToggleBtn = document.createElement('button');
  jsonToggleBtn.type = 'button';
  jsonToggleBtn.className = 'ambient-tuner-btn';
  jsonToggleBtn.textContent = '查看 JSON';
  jsonToggleBtn.addEventListener('click', () => {
    syncJsonBox();
    jsonBox.hidden = !jsonBox.hidden;
    jsonToggleBtn.textContent = jsonBox.hidden ? '查看 JSON' : '隐藏 JSON';
  });

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'ambient-tuner-btn';
  resetBtn.textContent = '恢复默认';
  resetBtn.addEventListener('click', () => {
    Object.assign(cfg, DEFAULT_TUNE_CONFIG);
    for (const [k, entry] of sliderMap.entries()) {
      entry.input.value = String(cfg[k]);
      entry.valEl.textContent = fmtVal(cfg[k], entry.def.step, entry.def.unit);
    }
    saveTuneConfig(cfg);
    syncJsonBox();
    callbacks.onChange(cfg, 'grid');
    callbacks.onChange(cfg, 'backdrop');
  });

  foot.append(copyBtn, jsonToggleBtn, resetBtn, jsonBox);
  panel.append(head, bar, body, foot);

  let isEnabled = document.documentElement.dataset.ambientTuner === 'on';
  let isOpen = true;
  const syncVisibility = () => {
    root.hidden = !isEnabled;
    panel.hidden = !isOpen;
    toggleBtn.hidden = isOpen;
  };
  syncVisibility();

  window.addEventListener('duolabmeng673:tuner-toggle', (event) => {
    const enabled = Boolean((event as CustomEvent<{ enabled?: boolean }>).detail?.enabled);
    isEnabled = enabled;
    if (enabled) isOpen = true;
    syncVisibility();
  });

  closeBtn.addEventListener('click', () => {
    isOpen = false;
    syncVisibility();
  });
  toggleBtn.addEventListener('click', () => {
    isOpen = true;
    syncVisibility();
  });

  root.append(panel, toggleBtn);
  document.body.append(root);
};
