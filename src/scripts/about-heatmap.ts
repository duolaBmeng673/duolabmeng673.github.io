import type { HeatmapCategory } from '../lib/activity.ts';
import {
  buildAboutHeatmapModel,
  formatWeekdayDateLabel,
  heatmapCategories,
  type AboutHeatmapCell,
  type AboutHeatmapEntry,
} from '../lib/about-heatmap-model.ts';

interface AboutPayload {
  buildDate: string;
  yearsWithData: number[];
  entries: AboutHeatmapEntry[];
}

function initAboutHeatmap(root: HTMLElement) {
  if (root.dataset.initialized === 'true') return;
  const raw = root.dataset.aboutHeatmapPayload;
  if (!raw) return;

  let payload: AboutPayload;
  try {
    payload = JSON.parse(raw) as AboutPayload;
  } catch {
    return;
  }

  root.dataset.initialized = 'true';

  const bodyEl = root.querySelector<HTMLElement>('[data-about-body]');
  const gridColEl = root.querySelector<HTMLElement>('[data-about-grid-col]');
  const calendarEl = root.querySelector<HTMLElement>('[data-about-calendar]');
  const monthsEl = root.querySelector<HTMLElement>('[data-about-months]');
  const monthTrackEl = root.querySelector<HTMLElement>('[data-about-month-track]');
  const weeksEl = root.querySelector<HTMLElement>('[data-about-weeks]');
  const rangeBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-heatmap-range]')];
  const filterBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-filter-cat]')];

  const daysSummaryEl = root.querySelector<HTMLElement>('[data-about-summary-metric="days"]');
  const streakSummaryEl = root.querySelector<HTMLElement>('[data-about-summary-metric="streak"]');
  const totalSummaryEl = root.querySelector<HTMLElement>('[data-about-summary-metric="total"]');

  const detailDateEl = root.querySelector<HTMLElement>('[data-about-detail-date]');
  const detailModeEl = root.querySelector<HTMLElement>('[data-about-detail-mode]');
  const detailTotalEl = root.querySelector<HTMLElement>('[data-about-detail-total]');
  const detailBodyEl = root.querySelector<HTMLElement>('[data-about-detail-body]');

  if (!calendarEl || !monthsEl || !weeksEl || !detailDateEl || !detailModeEl || !detailTotalEl || !detailBodyEl) {
    return;
  }

  const syncGridMetrics = () => {
    if (!bodyEl || !gridColEl) return;
    const bodyW = bodyEl.clientWidth;
    if (!bodyW) return;
    const weekCount = Math.max(1, Number(calendarEl.getAttribute('aria-colcount')) || 53);
    const twoCol = !window.matchMedia('(max-width: 1179px)').matches;
    const colCs = getComputedStyle(gridColEl);
    const padLeft = parseFloat(colCs.paddingLeft) || 0;
    const padRight = parseFloat(colCs.paddingRight) || 0;
    const reservedRight = twoCol ? Math.min(330, Math.max(260, bodyW * 0.28)) + 16 : 0;
    const maxColW = Math.max(200, bodyW - reservedRight);
    const availWeeksW = Math.max(0, maxColW - padLeft - padRight - 20 - 4);

    let gap = 3;
    const minNeed3 = weekCount * 12 + (weekCount - 1) * 3;
    const minNeed2 = weekCount * 12 + (weekCount - 1) * 2;
    if (availWeeksW < minNeed3 && availWeeksW >= minNeed2) {
      gap = 2;
    }

    const rawSide = Math.floor(availWeeksW / weekCount - gap);
    const side = Math.max(12, Math.min(18, rawSide));
    const gridFits = weekCount * side + (weekCount - 1) * gap <= availWeeksW + 0.5;

    calendarEl.style.setProperty('--about-cell-size', `${side}px`);
    calendarEl.style.setProperty('--about-cell-gap', `${gap}px`);
    calendarEl.dataset.cellSize = String(side);
    calendarEl.dataset.cellGap = String(gap);
    bodyEl.dataset.gridFit = gridFits ? 'fit' : 'scroll';
  };

  let activeRange = root.dataset.activeRange || '53w';
  let activeFilter: HeatmapCategory | 'all' =
    (root.dataset.activeFilter as HeatmapCategory | 'all') || 'all';
  let pinnedDate = root.dataset.pinnedDate || payload.buildDate;
  let previewDate: string | null = null;
  let cellMap = new Map<string, AboutHeatmapCell>();
  let orderedCells: HTMLButtonElement[] = [];

  const renderDetail = (date: string | null, modeLabel: string) => {
    const cell = date ? cellMap.get(date) ?? null : null;
    detailDateEl.textContent = formatWeekdayDateLabel(cell?.date ?? date);
    detailModeEl.textContent = modeLabel;
    const rawTotal = cell?.rawTotal ?? 0;
    detailTotalEl.dataset.rawTotal = String(rawTotal);
    detailTotalEl.textContent = `${rawTotal} 条`;

    if (!cell || cell.entries.length === 0) {
      const p = document.createElement('p');
      p.className = 'about-heat-empty';
      p.dataset.aboutDetailEmpty = '';
      p.textContent = '当天暂无公开记录';
      detailBodyEl.replaceChildren(p);
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'about-heat-entry-list';
    ul.dataset.aboutDetailList = '';

    for (const entry of cell.entries) {
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.className = 'about-heat-entry-card';
      link.href = entry.href || '/';

      const meta = document.createElement('span');
      meta.className = 'about-heat-entry-meta';

      const dot = document.createElement('i');
      dot.className = 'about-heat-entry-dot';
      dot.dataset.category = entry.category;
      dot.setAttribute('aria-hidden', 'true');

      const labelSpan = document.createElement('span');
      labelSpan.textContent = entry.categoryLabel;
      meta.append(dot, labelSpan);

      if (entry.shortHash) {
        const hashSpan = document.createElement('span');
        hashSpan.className = 'about-heat-entry-hash';
        hashSpan.textContent = entry.shortHash;
        meta.append(hashSpan);
      }

      const titleSpan = document.createElement('span');
      titleSpan.className = 'about-heat-entry-title';
      titleSpan.textContent = entry.description;

      link.append(meta, titleSpan);
      li.append(link);
      ul.append(li);
    }

    detailBodyEl.replaceChildren(ul);
  };

  const updateSelectionStates = () => {
    const focusTargetDate = previewDate || pinnedDate;
    for (const btn of orderedCells) {
      const date = btn.dataset.date || '';
      const selected = date === focusTargetDate;
      btn.setAttribute('aria-selected', selected ? 'true' : 'false');
      btn.tabIndex = selected ? 0 : -1;
    }
  };

  const renderAll = () => {
    const model = buildAboutHeatmapModel(payload.entries, payload.buildDate, activeRange, activeFilter);

    root.dataset.activeRange = activeRange;
    root.dataset.activeFilter = activeFilter;

    for (const btn of rangeBtns) {
      btn.setAttribute('aria-pressed', btn.dataset.heatmapRange === activeRange ? 'true' : 'false');
    }

    for (const btn of filterBtns) {
      const cat = btn.dataset.filterCat as HeatmapCategory;
      const pressed = activeFilter === cat;
      btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      btn.classList.toggle('is-dimmed', activeFilter !== 'all' && !pressed);
      const catCount = model.categoryCounts[cat] ?? 0;
      btn.dataset.count = String(catCount);
      if (cat === 'site') {
        const rawCatCount = model.rawCategoryCounts.site ?? 0;
        btn.dataset.cappedCount = String(catCount);
        btn.dataset.rawCount = String(rawCatCount);
        const cappedEl = btn.querySelector<HTMLElement>('[data-about-cat-capped="site"]');
        if (cappedEl) cappedEl.textContent = String(catCount);
        const rawEl = btn.querySelector<HTMLElement>('[data-about-cat-raw="site"]');
        if (rawEl) rawEl.textContent = String(rawCatCount);
      } else {
        const countEl = btn.querySelector<HTMLElement>(`[data-about-cat-count="${cat}"]`);
        if (countEl) countEl.textContent = String(catCount);
      }
    }

    if (daysSummaryEl) {
      daysSummaryEl.dataset.value = String(model.activeDays);
      const strong = daysSummaryEl.querySelector('strong');
      if (strong) strong.textContent = `${model.activeDays} 天`;
    }
    if (streakSummaryEl) {
      streakSummaryEl.dataset.value = String(model.longestStreak);
      const strong = streakSummaryEl.querySelector('strong');
      if (strong) strong.textContent = `${model.longestStreak} 天`;
    }
    if (totalSummaryEl) {
      totalSummaryEl.dataset.value = String(model.totalActivities);
      totalSummaryEl.dataset.rawValue = String(model.rawTotalActivities);
      const strong = totalSummaryEl.querySelector('strong');
      if (strong) strong.textContent = `${model.totalActivities} 次`;
      const tailText = totalSummaryEl.lastChild;
      if (tailText && tailText.nodeType === 3) {
        tailText.textContent = `（明细 ${model.rawTotalActivities} 条）`;
      }
    }

    calendarEl.dataset.start = model.start;
    calendarEl.dataset.end = model.end;
    calendarEl.setAttribute('aria-colcount', String(model.columns.length));
    monthsEl.style.setProperty('--about-week-count', String(model.columns.length));

    const monthNodes: HTMLElement[] = [];
    for (let colIdx = 0; colIdx < model.columns.length; colIdx++) {
      const span = document.createElement('span');
      span.className = 'about-heat-month';
      const label = model.monthLabels.find((m) => m.col === colIdx)?.label ?? '';
      span.textContent = label;
      monthNodes.push(span);
    }
    if (monthTrackEl) monthTrackEl.replaceChildren(...monthNodes);
    else monthsEl.replaceChildren(document.createElement('span'), ...monthNodes);

    cellMap = new Map();
    orderedCells = [];
    const weekNodes: HTMLElement[] = [];

    if (!model.columns.flat().some((c) => c && c.date === pinnedDate)) {
      pinnedDate = model.defaultSelectedDate;
    }
    root.dataset.pinnedDate = pinnedDate;

    model.columns.forEach((col, colIdx) => {
      const weekDiv = document.createElement('div');
      weekDiv.className = 'about-heat-week';
      weekDiv.setAttribute('role', 'presentation');

      col.forEach((cell, rowIdx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('role', 'gridcell');
        btn.setAttribute('aria-rowindex', String(rowIdx + 1));
        btn.setAttribute('aria-colindex', String(colIdx + 1));

        if (!cell) {
          btn.className = 'about-heat-cell is-outside';
          btn.setAttribute('aria-label', '日期范围外');
          btn.tabIndex = -1;
          btn.disabled = true;
        } else {
          cellMap.set(cell.date, cell);
          orderedCells.push(btn);
          btn.className = 'about-heat-cell';
          btn.setAttribute('aria-label', cell.ariaLabel);
          btn.setAttribute('aria-controls', 'about-heatmap-detail');
          btn.setAttribute('title', cell.ariaLabel);
          btn.dataset.date = cell.date;
          btn.dataset.total = String(cell.total);
          btn.dataset.rawTotal = String(cell.rawTotal);
          btn.dataset.level = String(cell.level);
          btn.dataset.primaryCategory = cell.primaryCategory;
          btn.dataset.categories = cell.categories.join(',');
          btn.dataset.mixed = cell.mixed ? 'true' : 'false';
        }
        weekDiv.append(btn);
      });
      weekNodes.push(weekDiv);
    });

    weeksEl.replaceChildren(...weekNodes);
    updateSelectionStates();
    renderDetail(previewDate || pinnedDate, previewDate ? '预览' : '已固定');
    syncGridMetrics();
  };

  for (const btn of rangeBtns) {
    btn.addEventListener('click', () => {
      const next = btn.dataset.heatmapRange;
      if (!next || next === activeRange) return;
      activeRange = next;
      previewDate = null;
      renderAll();
    });
  }

  for (const btn of filterBtns) {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.filterCat as HeatmapCategory;
      if (!heatmapCategories.includes(cat)) return;
      activeFilter = activeFilter === cat ? 'all' : cat;
      previewDate = null;
      renderAll();
    });
  }

  weeksEl.addEventListener('pointerover', (ev) => {
    const target = (ev.target as HTMLElement | null)?.closest<HTMLButtonElement>('button[data-date]');
    if (!target || target.disabled) return;
    const date = target.dataset.date || null;
    if (date && date !== previewDate) {
      previewDate = date;
      updateSelectionStates();
      renderDetail(date, date === pinnedDate ? '已固定' : '预览');
    }
  });

  weeksEl.addEventListener('pointerleave', () => {
    if (previewDate !== null) {
      previewDate = null;
      updateSelectionStates();
      renderDetail(pinnedDate, '已固定');
    }
  });

  weeksEl.addEventListener('click', (ev) => {
    const target = (ev.target as HTMLElement | null)?.closest<HTMLButtonElement>('button[data-date]');
    if (!target || target.disabled) return;
    const date = target.dataset.date;
    if (!date) return;
    pinnedDate = date;
    previewDate = null;
    root.dataset.pinnedDate = pinnedDate;
    updateSelectionStates();
    renderDetail(pinnedDate, '已固定');
  });

  weeksEl.addEventListener('focusin', (ev) => {
    const target = (ev.target as HTMLElement | null)?.closest<HTMLButtonElement>('button[data-date]');
    if (!target || target.disabled) return;
    const date = target.dataset.date || null;
    if (date) {
      previewDate = date;
      updateSelectionStates();
      renderDetail(date, date === pinnedDate ? '已固定' : '预览');
    }
  });

  weeksEl.addEventListener('focusout', (ev) => {
    const next = ev.relatedTarget as Node | null;
    if (next && weeksEl.contains(next)) return;
    if (previewDate !== null) {
      previewDate = null;
      updateSelectionStates();
      renderDetail(pinnedDate, '已固定');
    }
  });

  weeksEl.addEventListener('keydown', (ev) => {
    const current = (ev.target as HTMLElement | null)?.closest<HTMLButtonElement>('button[data-date]');
    if (!current || !orderedCells.length) return;
    const idx = orderedCells.indexOf(current);
    if (idx < 0) return;

    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      const date = current.dataset.date;
      if (date) {
        pinnedDate = date;
        previewDate = null;
        root.dataset.pinnedDate = pinnedDate;
        updateSelectionStates();
        renderDetail(pinnedDate, '已固定');
      }
      return;
    }

    if (ev.key === 'Escape') {
      previewDate = null;
      updateSelectionStates();
      renderDetail(pinnedDate, '已固定');
      return;
    }

    let nextIdx = idx;
    if (ev.key === 'ArrowRight') nextIdx = Math.min(orderedCells.length - 1, idx + 7);
    else if (ev.key === 'ArrowLeft') nextIdx = Math.max(0, idx - 7);
    else if (ev.key === 'ArrowDown') nextIdx = Math.min(orderedCells.length - 1, idx + 1);
    else if (ev.key === 'ArrowUp') nextIdx = Math.max(0, idx - 1);
    else if (ev.key === 'Home') nextIdx = 0;
    else if (ev.key === 'End') nextIdx = orderedCells.length - 1;
    else return;

    ev.preventDefault();
    const targetBtn = orderedCells[nextIdx];
    if (targetBtn) {
      targetBtn.focus();
    }
  });

  // Ensure initial DOM uses identical client hydration state
  renderAll();
  if (bodyEl && 'ResizeObserver' in window) {
    const ro = new ResizeObserver(syncGridMetrics);
    ro.observe(bodyEl);
  } else {
    window.addEventListener('resize', syncGridMetrics);
  }
}

document.querySelectorAll<HTMLElement>('[data-about-heatmap]').forEach(initAboutHeatmap);
