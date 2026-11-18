import { useEffect, useMemo, useRef, useState } from 'react';
import {
  activityKind,
  activityLevel,
  activityTypes,
  createActivityCalendar,
  getVisibleCalendarStats,
  type ActivityRecord,
} from '../../lib/activity';

export interface HeatmapItemPayload {
  date: string;
  type: ActivityRecord['type'];
  label: string;
  count: number;
  description: string;
  href?: string;
}

export interface ActivityHeatmapIslandProps {
  buildDate: string;
  writingItems: HeatmapItemPayload[];
  activityItems: HeatmapItemPayload[];
  recentFallbackItems: HeatmapItemPayload[];
  initialActiveDays: number;
  initialTotalActivities: number;
  initialLongestStreak: number;
  initialMonthActivities: number;
  initialWindowLabel?: string;
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

const DESKTOP_COLS = 34;
const PHONE_COLS = 22;
const PAD = 2;
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

function formatDateWithWeekday(dateStr?: string | null) {
  if (!dateStr) return '—';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return dateStr;
  const [y, m, d] = parts;
  const dow = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${dateStr} · ${dow}`;
}

function buildHeatmapMap(writingItems: HeatmapItemPayload[], activityItems: HeatmapItemPayload[]) {
  const map: Record<string, HeatmapItemPayload[]> = {};
  for (const item of [...writingItems, ...activityItems]) {
    (map[item.date] ??= []).push(item);
  }
  return map;
}

function buildCalendar(
  writingItems: HeatmapItemPayload[],
  activityItems: HeatmapItemPayload[],
  actMap: Record<string, HeatmapItemPayload[]>,
  anchorDateStr: string,
) {
  const today = new Date(`${anchorDateStr}T00:00:00`);
  today.setHours(0, 0, 0, 0);
  const records: ActivityRecord[] = [...writingItems, ...activityItems].map((item) => ({
    date: item.date,
    type: item.type,
    count: item.count,
    description: item.description,
  }));

  const calendar = createActivityCalendar(records, today, 365);
  const totalCols = calendar.columns.length;
  const cells: CalendarCell[] = [];

  for (let c = 0; c < totalCols; c++) {
    const col = calendar.columns[c];
    for (let r = 0; r < 7; r++) {
      const day = col[r];
      if (!day) {
        cells.push({
          c,
          r,
          key: '',
          count: 0,
          lv: 0,
          future: true,
          entries: [],
          onlySite: false,
        });
        continue;
      }
      const count = activityTypes.reduce((sum, type) => sum + day.types[type], 0);
      const entries = actMap[day.date] ?? [];
      cells.push({
        c,
        r,
        key: day.date,
        count,
        lv: activityLevel(day),
        future: false,
        entries,
        onlySite: activityKind(day) === 'site',
      });
    }
  }

  const defaultSelected =
    cells.slice().reverse().find((q) => !q.future && q.count > 0) ||
    cells.find((q) => q.key === anchorDateStr) ||
    null;

  return {
    calendar,
    totalCols,
    cells,
    defaultSelected,
  };
}

export default function ActivityHeatmapIsland({
  buildDate,
  writingItems,
  activityItems,
  recentFallbackItems,
  initialActiveDays,
  initialTotalActivities,
  initialLongestStreak,
  initialMonthActivities,
  initialWindowLabel = `近 ${DESKTOP_COLS} 周`,
}: ActivityHeatmapIslandProps) {
  const [hydrated, setHydrated] = useState(false);
  const [themeAttr, setThemeAttr] = useState<string>(() =>
    typeof document !== 'undefined' ? document.documentElement.dataset.theme || 'light' : 'light',
  );
  const [visibleCols, setVisibleCols] = useState<number>(DESKTOP_COLS);

  const actMap = useMemo(() => buildHeatmapMap(writingItems, activityItems), [writingItems, activityItems]);
  const { calendar, totalCols, cells, defaultSelected } = useMemo(
    () => buildCalendar(writingItems, activityItems, actMap, buildDate),
    [writingItems, activityItems, actMap, buildDate],
  );
  const visibleStats = useMemo(
    () => getVisibleCalendarStats(calendar, buildDate, visibleCols),
    [calendar, buildDate, visibleCols],
  );

  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<CalendarCell | null>(null);
  const [focusedCell, setFocusedCell] = useState<CalendarCell | null>(null);
  const [hasBottomOverflow, setHasBottomOverflow] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const sidebarBodyRef = useRef<HTMLDivElement | null>(null);
  const metricsRef = useRef({
    cellW: 10,
    cellH: 13,
    gap: 2.5,
    offsetX: PAD,
    offsetY: PAD + 20,
    colCount: Math.min(totalCols, DESKTOP_COLS),
    width: 560,
    height: 120,
  });
  const pinnedKeyRef = useRef<string | null>(null);
  const hoveredKeyRef = useRef<string | null>(null);
  const focusedKeyRef = useRef<string | null>(null);
  pinnedKeyRef.current = pinnedKey;

  const pinnedCell = useMemo(
    () => (pinnedKey ? cells.find((c) => !c.future && c.key === pinnedKey) || null : null),
    [cells, pinnedKey],
  );
  const activeCell = hoveredCell || focusedCell || pinnedCell || defaultSelected;
  const activeEntries = activeCell?.entries ?? [];

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
    const el = sidebarBodyRef.current;
    if (!el) return undefined;
    const updateOverflow = () => {
      const overflowing = el.scrollHeight > el.clientHeight + 2 && el.scrollTop + el.clientHeight < el.scrollHeight - 2;
      setHasBottomOverflow(overflowing);
    };
    el.scrollTop = 0;
    const raf = requestAnimationFrame(updateOverflow);
    el.addEventListener('scroll', updateOverflow, { passive: true });
    const ro = 'ResizeObserver' in window ? new ResizeObserver(updateOverflow) : null;
    ro?.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('scroll', updateOverflow);
      ro?.disconnect();
    };
  }, [hydrated, activeCell?.key, activeEntries.length]);

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
      const x = m.offsetX + vc * (m.cellW + m.gap);
      const y = m.offsetY + q.r * (m.cellH + m.gap);
      const pop = isHovered ? 1.5 : 0;
      const rx = x - pop;
      const ry = y - pop;
      const w = m.cellW + pop * 2;
      const h = m.cellH + pop * 2;
      const radius = isHovered ? Math.max(2.5, Math.round(m.cellW * 0.28)) : Math.max(2, Math.round(m.cellW * 0.22));

      ctx.save();
      if (isHovered) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetY = 1.5;
      }
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(rx, ry, w, h, radius);
      else ctx.rect(rx, ry, w, h);
      ctx.fillStyle = q.onlySite ? siteCol : colors[q.lv];
      ctx.fill();
      ctx.restore();

      const isPinned = Boolean(pinnedKeyRef.current && q.key === pinnedKeyRef.current);
      const isFocused = Boolean(focusedKeyRef.current && q.key === focusedKeyRef.current);
      if (isHovered) {
        ctx.strokeStyle = elevCol;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = txCol;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (isPinned) {
        ctx.strokeStyle = elevCol;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = txCol;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      } else if (isFocused) {
        ctx.strokeStyle = txCol;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    };

    const draw = () => {
      const m = metricsRef.current;
      const startCol = totalCols - m.colCount;
      ctx.clearRect(0, 0, m.width, m.height);

      ctx.save();
      ctx.fillStyle = tsCol;
      const labelFontSize = Math.max(12, Math.min(18, m.cellW >= 14 ? 13 : 12));
      ctx.font = `500 ${labelFontSize}px "Noto Sans SC", system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      let prevMonth = '';
      let lastLabelRight = -100;
      for (let vc = 0; vc < m.colCount; vc++) {
        const c = startCol + vc;
        let colFirstDay: CalendarCell | null = null;
        for (let r = 0; r < 7; r++) {
          const cand = cells[c * 7 + r];
          if (cand && !cand.future && cand.key) {
            colFirstDay = cand;
            break;
          }
        }
        if (!colFirstDay) continue;
        const ym = colFirstDay.key.slice(0, 7);
        if (ym !== prevMonth) {
          prevMonth = ym;
          const nextProbe = cells[(c + 2) * 7] ?? cells[(c + 2) * 7 + 6];
          if (vc === 0 && nextProbe && !nextProbe.future && nextProbe.key.slice(0, 7) !== ym) {
            continue;
          }
          const monthNum = Number(colFirstDay.key.slice(5, 7));
          const labelText = `${monthNum}月`;
          const textW = ctx.measureText(labelText).width;
          const x = m.offsetX + vc * (m.cellW + m.gap);
          if (x >= lastLabelRight + 8 && x + textW <= m.width - m.offsetX) {
            ctx.fillText(labelText, x, PAD);
            lastLabelRight = x + textW;
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

    const layout = () => {
      const containerW = Math.max(220, box.clientWidth || box.getBoundingClientRect().width || 420);
      const isPhone = typeof window !== 'undefined' && window.innerWidth < 640;
      const colCount = Math.min(totalCols, isPhone ? PHONE_COLS : DESKTOP_COLS);
      setVisibleCols((prev) => (prev === colCount ? prev : colCount));

      const gap = isPhone ? 3 : containerW >= 540 ? 3 : 2.5;
      const availW = Math.max(120, containerW - PAD * 2);
      const cellW = (availW - (colCount - 1) * gap) / colCount;
      const cellH = isPhone ? cellW : Math.min(28, Math.round(cellW * 1.35 * 10) / 10);
      const labelH = cellW >= 11 ? 20 : 18;
      const W = containerW;
      const gridH = 7 * cellH + 6 * gap;
      const offsetY = PAD + labelH;
      const H = Math.ceil(offsetY + gridH + PAD);
      const offsetX = PAD;

      const dpr = window.devicePixelRatio || 1;
      cv.style.width = `${W}px`;
      cv.style.height = `${H}px`;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      metricsRef.current = { cellW, cellH, gap, offsetX, offsetY, colCount, width: W, height: H };
      colors = [0, 1, 2, 3, 4].map((i) => cssVar(`--heat-${i}`, cssVar(`--h${i}`, '#e5e7eb')));
      siteCol = cssVar('--heat-site', cssVar('--h-site', '#52525b'));
      txCol = cssVar('--tx', '#121217');
      tsCol = cssVar('--ts', cssVar('--tm', '#6b7280'));
      elevCol = cssVar('--bg-elev', '#ffffff');
      draw();
    };

    const hitCell = (clientX: number, clientY: number): CalendarCell | null => {
      const r = cv.getBoundingClientRect();
      const px = clientX - r.left;
      const py = clientY - r.top;
      const { cellW, cellH, gap, offsetX, offsetY, colCount } = metricsRef.current;
      const startCol = totalCols - colCount;
      const stepX = cellW + gap;
      const stepY = cellH + gap;
      if (px < offsetX || py < offsetY) return null;
      const vc = Math.floor((px - offsetX) / stepX);
      const rr = Math.floor((py - offsetY) / stepY);
      const c = vc + startCol;
      if (vc >= 0 && vc < colCount && rr >= 0 && rr < 7) {
        const cell = cells[c * 7 + rr];
        if (cell && !cell.future && cell.key) return cell;
      }
      return null;
    };

    const onMove = (e: PointerEvent) => {
      const hit = hitCell(e.clientX, e.clientY);
      const nextKey = hit?.key || null;
      if (hoveredKeyRef.current !== nextKey) {
        hoveredKeyRef.current = nextKey;
        setHoveredCell(hit);
        draw();
      }
    };

    const onClick = (e: MouseEvent) => {
      const hit = hitCell(e.clientX, e.clientY);
      if (hit) {
        pinnedKeyRef.current = hit.key;
        setPinnedKey(hit.key);
        draw();
      }
    };

    const onLeave = () => {
      if (hoveredKeyRef.current !== null) {
        hoveredKeyRef.current = null;
        setHoveredCell(null);
        draw();
      }
    };

    const onBlur = () => {
      if (focusedKeyRef.current !== null) {
        focusedKeyRef.current = null;
        setFocusedCell(null);
        draw();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const startCol = totalCols - metricsRef.current.colCount;
      const validCells = cells.filter((c) => !c.future && c.key && c.c >= startCol);
      if (!validCells.length) return;
      const currentKey = focusedKeyRef.current || pinnedKeyRef.current || defaultSelected?.key;
      const curIdx = Math.max(
        0,
        validCells.findIndex((c) => c.key === currentKey),
      );

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const target = validCells[curIdx];
        if (!target) return;
        pinnedKeyRef.current = target.key;
        setPinnedKey(target.key);
        draw();
        return;
      }

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
      focusedKeyRef.current = target.key;
      setFocusedCell(target);
      draw();
    };

    const ro = 'ResizeObserver' in window ? new ResizeObserver(layout) : null;
    ro?.observe(box);

    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('click', onClick);
    cv.addEventListener('pointerleave', onLeave);
    cv.addEventListener('blur', onBlur);
    cv.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onLeave, { passive: true });
    layout();

    return () => {
      ro?.disconnect();
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('click', onClick);
      cv.removeEventListener('pointerleave', onLeave);
      cv.removeEventListener('blur', onBlur);
      cv.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onLeave);
    };
  }, [hydrated, totalCols, cells, themeAttr, defaultSelected?.key]);

  const windowLabel = hydrated ? visibleStats.windowLabel : initialWindowLabel;
  const statDays = hydrated ? visibleStats.activityDays : initialActiveDays;
  const statTotal = hydrated ? visibleStats.totalActivities : initialTotalActivities;
  const statLongestStreak = hydrated ? visibleStats.longestStreak : initialLongestStreak;
  const statMonthActs = hydrated ? visibleStats.monthActivities : initialMonthActivities;

  const legendNode = (
    <span className="heat-legend">
      <span>少</span>
      <i className="heat-swatch" style={{ background: 'var(--heat-0)' }} />
      <i className="heat-swatch" style={{ background: 'var(--heat-1)' }} />
      <i className="heat-swatch" style={{ background: 'var(--heat-2)' }} />
      <i className="heat-swatch" style={{ background: 'var(--heat-3)' }} />
      <i className="heat-swatch" style={{ background: 'var(--heat-4)' }} />
      <span>多</span>
    </span>
  );

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
            {`${windowLabel} ${statDays} 活跃日 · ${statTotal} 次活动`}
          </span>
        </div>
      </div>
      <div className="wb stage-heat-body">
        <div className="heat-main">
          <div className="heat-canvas-wrap" ref={wrapRef}>
            {hydrated ? (
              <canvas
                ref={canvasRef}
                id="heat"
                tabIndex={0}
                role="group"
                aria-controls="activity-detail"
                aria-label={`${windowLabel}真实写作与功能活动热力图（${statDays} 活跃日，${statTotal} 次活动，可用方向键切换日期、Enter 固定）`}
              />
            ) : (
              <div className="heat-static-fallback" data-activity-fallback>
                <p className="heat-fallback-summary">
                  {`${initialWindowLabel} · ${initialActiveDays} 活跃日 · ${initialTotalActivities} 次活动（点击或悬停日期查看当日记录）`}
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
          <div className="heat-stats-bar" data-activity-stats>
            <div className="heat-stats-metrics">
              <span className="heat-stat-item">
                最长连续 <strong>{statLongestStreak} 天</strong>
              </span>
              <span className="heat-stat-sep" aria-hidden="true">·</span>
              <span className="heat-stat-item" data-activity-stat="month" data-activity-month={statMonthActs}>
                本月 <strong>{statMonthActs} 次</strong>
              </span>
            </div>
            {legendNode}
          </div>
        </div>
        <aside className="heat-sidebar" id="activity-detail" aria-live="polite" aria-label="当日活动详情">
          <div className="heat-sidebar-head">
            <span className="heat-sidebar-date">{formatDateWithWeekday(activeCell?.key)}</span>
            <span className="heat-sidebar-count">
              {activeEntries.length > 0 ? `${activeCell?.count ?? activeEntries.length} 次` : '0 次'}
            </span>
          </div>
          <div
            ref={sidebarBodyRef}
            className={`heat-sidebar-body${hasBottomOverflow ? ' has-overflow' : ''}`}
            data-activity-detail-items
          >
            {activeEntries.length > 0 ? (
              <ul className="heat-sidebar-list">
                {activeEntries.map((e, i) => (
                  <li key={`${activeCell?.key ?? 'day'}-${i}`}>
                    <a className="heat-sidebar-card" href={e.href || '/blog/'} title={e.description || e.label}>
                      <span className="heat-sidebar-cat">
                        <i className="heat-cat-dot" data-type={e.type} aria-hidden="true" />
                        <span>{e.label}</span>
                      </span>
                      <span className="heat-sidebar-title">{e.description || e.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="heat-sidebar-empty">当天暂无公开记录</p>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
