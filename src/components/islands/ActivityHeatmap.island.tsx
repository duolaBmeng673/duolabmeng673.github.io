import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface HeatmapItemPayload {
  date: string;
  type: 'coding' | 'writing' | 'research' | 'learning' | 'site';
  label: string;
  count: number;
  description: string;
}

export interface ActivityHeatmapIslandProps {
  buildDate: string;
  writingItems: HeatmapItemPayload[];
  activityItems: HeatmapItemPayload[];
  recentFallbackItems: HeatmapItemPayload[];
  initialActiveDays: number;
  initialTotalActivities: number;
}

interface CalendarCell {
  c: number;
  r: number;
  key: string;
  count: number;
  lv: number;
  future: boolean;
  entries: HeatmapItemPayload[];
  onlySite: boolean;
}

interface HoverInfo {
  cell: CalendarCell;
  anchorX: number;
  anchorTop: number;
  anchorBottom: number;
}

const COLS = 53;
const PHONE_COLS = 26;
const PAD = 4;
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildHeatmapMap(writingItems: HeatmapItemPayload[], activityItems: HeatmapItemPayload[]) {
  const map: Record<string, HeatmapItemPayload[]> = {};
  for (const item of [...writingItems, ...activityItems]) {
    (map[item.date] ??= []).push(item);
  }
  return map;
}

function buildCalendar(actMap: Record<string, HeatmapItemPayload[]>, anchorDateStr: string) {
  const today = new Date(`${anchorDateStr}T00:00:00`);
  today.setHours(0, 0, 0, 0);
  const endSun = new Date(today);
  endSun.setDate(today.getDate() - today.getDay());
  const first = new Date(endSun);
  first.setDate(endSun.getDate() - (COLS - 1) * 7);

  const cells: CalendarCell[] = [];
  let totalActs = 0;
  let activeDays = 0;

  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < 7; r++) {
      const d = new Date(first);
      d.setDate(first.getDate() + c * 7 + r);
      const key = ymd(d);
      const future = d > today;
      const entries = !future && Array.isArray(actMap[key]) ? actMap[key] : [];
      const count = entries.reduce((s, e) => s + (e.count || 1), 0);
      const onlySite = entries.length > 0 && entries.every((e) => e.type === 'site');
      if (count > 0) {
        totalActs += count;
        activeDays += 1;
      }
      const lv = count === 0 ? 0 : count === 1 ? 1 : count <= 2 ? 2 : count <= 4 ? 3 : 4;
      cells.push({ c, r, key, count, lv, future, entries, onlySite });
    }
  }

  const defaultSelected =
    cells.slice().reverse().find((q) => !q.future && q.count > 0) ||
    cells.find((q) => q.key === anchorDateStr) ||
    null;

  return { cells, totalActs, activeDays, defaultSelected };
}

export default function ActivityHeatmapIsland({
  buildDate,
  writingItems,
  activityItems,
  recentFallbackItems,
  initialActiveDays,
  initialTotalActivities,
}: ActivityHeatmapIslandProps) {
  const [hydrated, setHydrated] = useState(false);
  const [themeAttr, setThemeAttr] = useState<string>(() =>
    typeof document !== 'undefined' ? document.documentElement.dataset.theme || 'light' : 'light',
  );

  const actMap = useMemo(() => buildHeatmapMap(writingItems, activityItems), [writingItems, activityItems]);
  const { cells, totalActs, activeDays, defaultSelected } = useMemo(
    () => buildCalendar(actMap, buildDate),
    [actMap, buildDate],
  );

  const [selectedKey, setSelectedKey] = useState<string>(defaultSelected?.key || '');
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [popPos, setPopPos] = useState<{ left: number; top: number; placeBelow: boolean } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const metricsRef = useRef({
    size: 13.5,
    gap: 4,
    offsetX: PAD,
    offsetY: PAD + 21,
    colCount: COLS,
    width: 600,
    height: 150,
  });
  const selectedKeyRef = useRef(selectedKey);
  const hoveredKeyRef = useRef<string | null>(null);
  const userScrolledRef = useRef(false);
  const progScrollRef = useRef(false);
  selectedKeyRef.current = selectedKey;

  const activeCell = hoverInfo?.cell || cells.find((c) => c.key === selectedKey) || defaultSelected;

  useEffect(() => {
    setHydrated(true);
    const syncTheme = () => {
      setThemeAttr(document.documentElement.dataset.theme || 'light');
    };
    syncTheme();
    const mo = new MutationObserver(syncTheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    if (!hydrated) return undefined;
    const cv = canvasRef.current;
    const box = wrapRef.current;
    if (!cv || !box) return undefined;
    const ctx = cv.getContext('2d');
    if (!ctx) return undefined;

    const cssVar = (n: string, fallback = '') => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fallback;

    let colors = [0, 1, 2, 3, 4].map((i) => cssVar(`--heat-${i}`, cssVar(`--h${i}`, '#e5e7eb')));
    let siteCol = cssVar('--heat-site', cssVar('--h-site', '#52525b'));
    let txCol = cssVar('--tx', '#121217');
    let tsCol = cssVar('--ts', cssVar('--tm', '#6b7280'));
    let elevCol = cssVar('--bg-elev', '#ffffff');

    const drawCell = (q: CalendarCell, startCol: number, m: typeof metricsRef.current, isHovered: boolean) => {
      const vc = q.c - startCol;
      const x = m.offsetX + vc * (m.size + m.gap);
      const y = m.offsetY + q.r * (m.size + m.gap);
      const pop = isHovered ? 2 : 0;
      const rx = x - pop;
      const ry = y - pop;
      const side = m.size + pop * 2;
      const radius = isHovered ? Math.max(3, Math.round(m.size * 0.28)) : Math.max(2, Math.round(m.size * 0.22));

      ctx.save();
      if (isHovered) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;
      }
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(rx, ry, side, side, radius);
      else ctx.rect(rx, ry, side, side);
      ctx.fillStyle = q.onlySite ? siteCol : colors[q.lv];
      ctx.fill();
      ctx.restore();

      const isSelected = Boolean(selectedKeyRef.current && q.key === selectedKeyRef.current);
      if (isHovered) {
        ctx.strokeStyle = elevCol;
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.strokeStyle = txCol;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (isSelected) {
        ctx.strokeStyle = txCol;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    };

    const draw = () => {
      const m = metricsRef.current;
      const startCol = COLS - m.colCount;
      ctx.clearRect(0, 0, m.width, m.height);

      // Draw top month tick labels aligned to first Sunday column of each month
      ctx.save();
      ctx.fillStyle = tsCol;
      const labelFontSize = m.size >= 14 ? 13 : m.size >= 12 ? 12 : 10.5;
      ctx.font = `500 ${labelFontSize}px Inter, "Noto Sans SC", system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      let prevMonth = '';
      let lastLabelX = -100;
      for (let vc = 0; vc < m.colCount; vc++) {
        const c = startCol + vc;
        const firstDay = cells[c * 7];
        if (!firstDay) continue;
        const ym = firstDay.key.slice(0, 7);
        if (ym !== prevMonth) {
          prevMonth = ym;
          const x = m.offsetX + vc * (m.size + m.gap);
          const probe = cells[(c + 3) * 7];
          const nextColMonth = vc === 0 && probe ? probe.key.slice(0, 7) : ym;
          if (vc === 0 && nextColMonth !== ym) continue;
          if (x - lastLabelX >= 28 && x + 26 <= m.width) {
            const monthNum = Number(firstDay.key.slice(5, 7));
            ctx.fillText(`${monthNum}月`, x, PAD);
            lastLabelX = x;
          }
        }
      }
      ctx.restore();

      let hoveredItem: CalendarCell | null = null;
      for (let i = 0; i < cells.length; i++) {
        const q = cells[i];
        if (q.future || q.c < startCol) continue;
        if (hoveredKeyRef.current && q.key === hoveredKeyRef.current) {
          hoveredItem = q;
          continue;
        }
        drawCell(q, startCol, m, false);
      }

      if (hoveredItem) {
        drawCell(hoveredItem, startCol, m, true);
      }
    };

    let scrollRaf = 0;
    const layout = () => {
      const containerW = Math.max(240, box.clientWidth || box.getBoundingClientRect().width || 560);
      const isPhone = typeof window !== 'undefined' && window.innerWidth < 640;
      const colCount = isPhone ? PHONE_COLS : COLS;
      const gap = containerW >= 780 ? 4.5 : 4;
      const minSize = isPhone ? 10.5 : containerW >= 780 ? 15 : 13.5;
      const fittedSize = (containerW - PAD * 2 - (colCount - 1) * gap) / colCount;
      const size = Math.max(minSize, fittedSize);
      const labelH = size >= 14 ? 23 : 21;
      const W = Math.max(containerW, Math.ceil(PAD * 2 + colCount * size + (colCount - 1) * gap));
      const gridH = 7 * size + 6 * gap;
      const offsetY = PAD + labelH;
      const H = Math.ceil(offsetY + gridH + PAD);
      const offsetX = PAD;

      const dpr = window.devicePixelRatio || 1;
      cv.style.width = `${W}px`;
      cv.style.height = `${H}px`;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      metricsRef.current = { size, gap, offsetX, offsetY, colCount, width: W, height: H };
      colors = [0, 1, 2, 3, 4].map((i) => cssVar(`--heat-${i}`, cssVar(`--h${i}`, '#e5e7eb')));
      siteCol = cssVar('--heat-site', cssVar('--h-site', '#52525b'));
      txCol = cssVar('--tx', '#121217');
      tsCol = cssVar('--ts', cssVar('--tm', '#6b7280'));
      elevCol = cssVar('--bg-elev', '#ffffff');
      draw();

      if (!userScrolledRef.current && box.scrollWidth > box.clientWidth + 1) {
        progScrollRef.current = true;
        box.scrollLeft = box.scrollWidth - box.clientWidth;
        scrollRaf = requestAnimationFrame(() => {
          progScrollRef.current = false;
        });
      }
    };

    const hitCell = (clientX: number, clientY: number): HoverInfo | null => {
      const r = cv.getBoundingClientRect();
      const px = clientX - r.left;
      const py = clientY - r.top;
      const { size, gap, offsetX, offsetY, colCount } = metricsRef.current;
      const startCol = COLS - colCount;
      const step = size + gap;
      if (px < offsetX || py < offsetY) return null;
      const vc = Math.floor((px - offsetX) / step);
      const rr = Math.floor((py - offsetY) / step);
      const c = vc + startCol;
      if (vc >= 0 && vc < colCount && rr >= 0 && rr < 7) {
        const cell = cells[c * 7 + rr];
        if (cell && !cell.future) {
          const cx = offsetX + vc * step;
          const cy = offsetY + rr * step;
          return {
            cell,
            anchorX: r.left + cx + size / 2,
            anchorTop: r.top + cy,
            anchorBottom: r.top + cy + size,
          };
        }
      }
      return null;
    };

    const onMove = (e: PointerEvent) => {
      const hit = hitCell(e.clientX, e.clientY);
      const nextKey = hit?.cell?.key || null;
      if (hoveredKeyRef.current !== nextKey) {
        hoveredKeyRef.current = nextKey;
        setHoverInfo(hit);
        draw();
      }
    };

    const onClick = (e: MouseEvent) => {
      const hit = hitCell(e.clientX, e.clientY);
      if (hit?.cell) {
        selectedKeyRef.current = hit.cell.key;
        setSelectedKey(hit.cell.key);
        draw();
      }
    };

    const onLeave = () => {
      if (hoveredKeyRef.current !== null) {
        hoveredKeyRef.current = null;
        setHoverInfo(null);
        draw();
      }
    };

    const onBoxScroll = () => {
      if (!progScrollRef.current) userScrolledRef.current = true;
      onLeave();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const validCells = cells.filter((c) => !c.future);
      if (!validCells.length) return;
      const curIdx = Math.max(
        0,
        validCells.findIndex((c) => c.key === selectedKeyRef.current),
      );
      let nextIdx = curIdx;
      if (e.key === 'ArrowLeft') nextIdx = Math.max(0, curIdx - 7);
      else if (e.key === 'ArrowRight') nextIdx = Math.min(validCells.length - 1, curIdx + 7);
      else if (e.key === 'ArrowUp') nextIdx = Math.max(0, curIdx - 1);
      else if (e.key === 'ArrowDown') nextIdx = Math.min(validCells.length - 1, curIdx + 1);
      else if (e.key === 'Home') nextIdx = 0;
      else if (e.key === 'End') nextIdx = validCells.length - 1;
      else return;

      e.preventDefault();
      const target = validCells[nextIdx];
      if (!target) return;
      selectedKeyRef.current = target.key;
      setSelectedKey(target.key);
      draw();

      const m = metricsRef.current;
      const startCol = COLS - m.colCount;
      const vc = Math.max(0, target.c - startCol);
      const cellX = m.offsetX + vc * (m.size + m.gap);
      if (box.scrollWidth > box.clientWidth) {
        if (cellX < box.scrollLeft + 24) {
          box.scrollLeft = Math.max(0, cellX - 24);
        } else if (cellX + m.size > box.scrollLeft + box.clientWidth - 24) {
          box.scrollLeft = Math.min(box.scrollWidth - box.clientWidth, cellX + m.size - box.clientWidth + 24);
        }
      }
    };

    const ro = 'ResizeObserver' in window ? new ResizeObserver(layout) : null;
    ro?.observe(box);

    box.addEventListener('scroll', onBoxScroll, { passive: true });
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('click', onClick);
    cv.addEventListener('keydown', onKeyDown);
    cv.addEventListener('pointerleave', onLeave);
    window.addEventListener('scroll', onLeave, { passive: true });
    layout();

    return () => {
      cancelAnimationFrame(scrollRaf);
      ro?.disconnect();
      box.removeEventListener('scroll', onBoxScroll);
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('click', onClick);
      cv.removeEventListener('keydown', onKeyDown);
      cv.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', onLeave);
    };
  }, [hydrated, cells, themeAttr]);

  useLayoutEffect(() => {
    if (!hoverInfo || !popRef.current) {
      setPopPos(null);
      return;
    }
    const pr = popRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const pad = 12;
    const left = Math.min(Math.max(pad, hoverInfo.anchorX - pr.width / 2), vw - pr.width - pad);
    const gap = 10;
    const placeBelow = hoverInfo.anchorTop - pr.height - gap < pad;
    const top = placeBelow ? hoverInfo.anchorBottom + gap : hoverInfo.anchorTop - pr.height - gap;
    setPopPos({ left, top, placeBelow });
  }, [hoverInfo]);

  const statDays = hydrated ? activeDays : initialActiveDays;
  const statTotal = hydrated ? totalActs : initialTotalActivities;

  const legendNode = (
    <span className="heat-legend">
      <span>少</span>
      <i className="heat-swatch" style={{ background: 'var(--heat-0)' }} />
      <i className="heat-swatch" style={{ background: 'var(--heat-1)' }} />
      <i className="heat-swatch" style={{ background: 'var(--heat-2)' }} />
      <i className="heat-swatch" style={{ background: 'var(--heat-3)' }} />
      <i className="heat-swatch" style={{ background: 'var(--heat-4)' }} />
      <span>多</span>
      <span className="heat-legend-site">
        <i className="heat-swatch" style={{ background: 'var(--heat-site)' }} /> 功能更新
      </span>
    </span>
  );

  const popoverNode =
    hydrated && hoverInfo && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={popRef}
            className={`heat-popover ${popPos?.placeBelow ? 'is-below' : 'is-above'}`}
            style={{
              left: `${popPos ? popPos.left : -9999}px`,
              top: `${popPos ? popPos.top : -9999}px`,
              opacity: popPos ? 1 : 0,
            }}
            role="tooltip"
          >
            <div className="heat-popover-head">
              <span className="heat-popover-date">
                {hoverInfo.cell.key} · {WEEKDAYS[hoverInfo.cell.r]}
              </span>
              <span className="heat-popover-count">
                {hoverInfo.cell.entries.length > 0 ? `${hoverInfo.cell.count} 次活动` : '无记录'}
              </span>
            </div>
            {hoverInfo.cell.entries.length > 0 ? (
              <ul className="heat-popover-list">
                {hoverInfo.cell.entries.map((e, i) => (
                  <li key={`${hoverInfo.cell.key}-${i}`}>
                    <span className="heat-popover-tag" data-type={e.type}>
                      {e.label}
                    </span>
                    <span className="heat-popover-desc">{e.description}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="heat-popover-empty">当天暂无公开写作或站点功能记录</p>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="wt">
        <span className="wt-dots">
          <i />
          <i />
          <i />
          <span>activity.heatmap</span>
        </span>
        <div className="wt-right">
          <span id="heatinfo" className="wt-stat">
            {`近一年 ${statDays} 活跃日 · ${statTotal} 次活动`}
          </span>
          {legendNode}
        </div>
      </div>
      <div className="wb stage-heat-body">
        <div className="heat-canvas-wrap" ref={wrapRef}>
          {hydrated ? (
            <canvas
              ref={canvasRef}
              id="heat"
              tabIndex={0}
              role="group"
              aria-controls="activity-detail"
              aria-label={`近一年真实写作与功能活动热力图（${statDays} 活跃日，${statTotal} 次活动，可用方向键切换日期）`}
            />
          ) : (
            <div className="heat-static-fallback" data-activity-fallback>
              <p className="heat-fallback-summary">
                {`过去一年 · ${initialActiveDays} 活跃日 · ${initialTotalActivities} 次活动（点击或悬停日期查看当日记录）`}
              </p>
              <ul className="heat-fallback-list">
                {recentFallbackItems.map((item, idx) => (
                  <li key={`${item.date}-${idx}`}>
                    <span className="heat-fallback-date">{item.date}</span>
                    <span className="heat-popover-tag" data-type={item.type}>
                      {item.label}
                    </span>
                    <span className="heat-fallback-desc">{item.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="heat-detail is-compact" id="activity-detail" aria-live="polite">
          <span className="heat-detail-date">{activeCell?.key || '—'}</span>
          <span className="heat-detail-items" data-activity-detail-items>
            {activeCell?.entries?.length
              ? activeCell.entries.map((e) => `[${e.label}] ${e.description}`).join(' · ')
              : '当天暂无公开记录（悬停小格弹出当日详情）'}
          </span>
        </div>
      </div>
      {popoverNode}
    </>
  );
}
