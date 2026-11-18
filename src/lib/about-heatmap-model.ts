import {
  localDateKey,
  type HeatmapCategory,
} from './activity.ts';

export const heatmapCategories = ['paper', 'study', 'tech', 'revision', 'site'] as const;

export interface HeatmapCategoryMeta {
  key: HeatmapCategory;
  label: string;
  colorVar: string;
}

export const heatmapCategoryMeta: Record<HeatmapCategory, HeatmapCategoryMeta> = {
  paper: { key: 'paper', label: '论文笔记', colorVar: '--heat-cat-paper' },
  study: { key: 'study', label: '学习笔记', colorVar: '--heat-cat-study' },
  tech: { key: 'tech', label: '技术笔记', colorVar: '--heat-cat-tech' },
  revision: { key: 'revision', label: '修订', colorVar: '--heat-cat-revision' },
  site: { key: 'site', label: '功能更新', colorVar: '--heat-cat-site' },
};

export interface AboutHeatmapEntry {
  date: string;
  category: HeatmapCategory;
  categoryLabel: string;
  description: string;
  href: string;
  shortHash?: string;
}

export interface AboutDayAggregate {
  date: string;
  counts: Record<HeatmapCategory, number>;
  entries: AboutHeatmapEntry[];
}

export interface AboutHeatmapCell {
  c: number;
  r: number;
  date: string;
  total: number;
  rawTotal: number;
  level: 0 | 1 | 2 | 3 | 4;
  primaryCategory: HeatmapCategory | 'none';
  secondaryCategory: HeatmapCategory | 'none';
  categories: HeatmapCategory[];
  mixed: boolean;
  ariaLabel: string;
  entries: AboutHeatmapEntry[];
}

export interface AboutHeatmapModel {
  rangeKey: string;
  start: string;
  end: string;
  columns: Array<Array<AboutHeatmapCell | null>>;
  monthLabels: Array<{ col: number; label: string }>;
  activeDays: number;
  totalActivities: number;
  rawTotalActivities: number;
  longestStreak: number;
  categoryCounts: Record<HeatmapCategory, number>;
  rawCategoryCounts: Record<HeatmapCategory, number>;
  defaultSelectedDate: string;
}

export function formatChineseDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${y} 年 ${Number(m)} 月 ${Number(d)} 日`;
}

export function formatWeekdayDateLabel(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return dateStr;
  const [y, m, d] = parts;
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;
  return `${dateStr} · ${names[new Date(y, m - 1, d).getDay()]}`;
}

export function resolveRangeBounds(
  rangeKey: string,
  buildDate: string,
  earliestDate?: string,
): { start: Date; end: Date } {
  const buildAnchor = new Date(`${buildDate}T00:00:00`);
  if (rangeKey === 'all') {
    const end = new Date(buildAnchor);
    if (earliestDate && /^\d{4}-\d{2}-\d{2}$/.test(earliestDate)) {
      const start = new Date(`${earliestDate}T00:00:00`);
      if (start <= end) return { start, end };
    }
    const fallbackStart = new Date(end);
    fallbackStart.setDate(fallbackStart.getDate() - 370);
    return { start: fallbackStart, end };
  }
  if (/^\d{4}$/.test(rangeKey)) {
    const year = Number(rangeKey);
    const start = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);
    const end = yearEnd > buildAnchor ? buildAnchor : yearEnd;
    return { start, end };
  }
  const end = new Date(buildAnchor);
  const start = new Date(end);
  start.setDate(start.getDate() - 370);
  return { start, end };
}

function emptyCategoryCounts(): Record<HeatmapCategory, number> {
  return { paper: 0, tech: 0, study: 0, revision: 0, site: 0 };
}

function toLevel(total: number): 0 | 1 | 2 | 3 | 4 {
  return total <= 0 ? 0 : total === 1 ? 1 : total <= 3 ? 2 : total <= 6 ? 3 : 4;
}

export function buildAboutHeatmapModel(
  items: AboutHeatmapEntry[],
  buildDate: string,
  rangeKey = '53w',
  activeFilter: HeatmapCategory | 'all' = 'all',
): AboutHeatmapModel {
  let earliestDate = '';
  for (const item of items) {
    if (!earliestDate || item.date < earliestDate) earliestDate = item.date;
  }
  const { start, end } = resolveRangeBounds(rangeKey, buildDate, earliestDate);
  const startKey = localDateKey(start);
  const endKey = localDateKey(end);

  const dayMap = new Map<string, AboutDayAggregate>();
  const categoryCounts = emptyCategoryCounts();
  const rawCategoryCounts = emptyCategoryCounts();

  for (const item of items) {
    if (item.date < startKey || item.date > endKey) continue;
    rawCategoryCounts[item.category] += 1;
    let agg = dayMap.get(item.date);
    if (!agg) {
      agg = { date: item.date, counts: emptyCategoryCounts(), entries: [] };
      dayMap.set(item.date, agg);
    }
    agg.counts[item.category] += 1;
    agg.entries.push(item);
  }

  for (const agg of dayMap.values()) {
    for (const cat of heatmapCategories) {
      categoryCounts[cat] += cat === 'site' ? Math.min(1, agg.counts.site) : agg.counts[cat];
    }
  }

  const calStart = new Date(start);
  calStart.setDate(calStart.getDate() - calStart.getDay());
  const calEnd = new Date(end);
  calEnd.setDate(calEnd.getDate() + (6 - calEnd.getDay()));

  const flatDays: Array<Date | null> = [];
  for (const d = new Date(calStart); d <= calEnd; d.setDate(d.getDate() + 1)) {
    flatDays.push(d < start || d > end ? null : new Date(d));
  }

  const colCount = Math.ceil(flatDays.length / 7);
  const columns: Array<Array<AboutHeatmapCell | null>> = [];

  let activeDays = 0;
  let totalActivities = 0;
  let rawTotalActivities = 0;
  let longestStreak = 0;
  let runningStreak = 0;
  let latestActiveDate = '';

  const cappedCount = (agg: AboutDayAggregate | undefined, cat: HeatmapCategory) => {
    if (!agg) return 0;
    return cat === 'site' ? Math.min(1, agg.counts.site) : agg.counts[cat];
  };

  for (let c = 0; c < colCount; c++) {
    const col: Array<AboutHeatmapCell | null> = [];
    for (let r = 0; r < 7; r++) {
      const dateObj = flatDays[c * 7 + r];
      if (!dateObj) {
        col.push(null);
        continue;
      }
      const date = localDateKey(dateObj);
      const agg = dayMap.get(date);
      const visibleEntries = agg
        ? activeFilter === 'all'
          ? agg.entries
          : agg.entries.filter((entry) => entry.category === activeFilter)
        : [];
      const presentCategories = agg
        ? heatmapCategories.filter((cat) =>
            activeFilter === 'all' ? agg.counts[cat] > 0 : cat === activeFilter && agg.counts[cat] > 0,
          )
        : [];

      const rawTotal = visibleEntries.length;
      const total = presentCategories.reduce((sum, cat) => sum + cappedCount(agg, cat), 0);
      if (rawTotal > 0) {
        activeDays += 1;
        totalActivities += total;
        rawTotalActivities += rawTotal;
        runningStreak += 1;
        if (runningStreak > longestStreak) longestStreak = runningStreak;
        latestActiveDate = date;
      } else {
        runningStreak = 0;
      }

      // Fixed multi-category priority: paper > study > tech > revision > site.
      const sortedCats = [...presentCategories].sort(
        (a, b) => heatmapCategories.indexOf(a) - heatmapCategories.indexOf(b),
      );

      const primary = sortedCats[0];
      const primaryCategory = primary ?? 'none';
      const secondaryCategory = sortedCats[1] ?? 'none';
      const parts = sortedCats.map((cat) => {
        const rawN = agg?.counts[cat] ?? 0;
        const capN = cappedCount(agg, cat);
        if (cat === 'site' && rawN > capN) {
          return `${heatmapCategoryMeta[cat].label} ${capN} 次（${rawN} 条提交）`;
        }
        return `${heatmapCategoryMeta[cat].label} ${rawN} 次`;
      });
      const dateCn = formatChineseDateLabel(date);
      const ariaLabel =
        rawTotal > 0 && primary
          ? `${dateCn}，主要类型：${heatmapCategoryMeta[primary].label}，共 ${total} 次有效活动（${rawTotal} 条记录）：${parts.join('；')}`
          : `${dateCn}，当天没有活动`;

      col.push({
        c,
        r,
        date,
        total,
        rawTotal,
        level: toLevel(total),
        primaryCategory,
        secondaryCategory,
        categories: sortedCats,
        mixed: sortedCats.length > 1,
        ariaLabel,
        entries: visibleEntries,
      });
    }
    columns.push(col);
  }

  const monthLabels: Array<{ col: number; label: string }> = [];
  let prevYm = '';
  let prevYear = '';
  for (let c = 0; c < columns.length; c++) {
    const firstValid = columns[c].find((cell) => cell !== null);
    if (!firstValid) continue;
    const ym = firstValid.date.slice(0, 7);
    if (ym !== prevYm) {
      prevYm = ym;
      if (c === 0) {
        const probe = columns[c + 1]?.find((cell) => cell !== null);
        if (probe && probe.date.slice(0, 7) !== ym) continue;
      }
      const year = firstValid.date.slice(0, 4);
      const monthNum = Number(firstValid.date.slice(5, 7));
      const showYear = rangeKey === 'all' && (year !== prevYear || monthNum === 1);
      prevYear = year;
      monthLabels.push({
        col: c,
        label: showYear ? `${year.slice(2)}年${monthNum}月` : `${monthNum}月`,
      });
    }
  }

  return {
    rangeKey,
    start: startKey,
    end: endKey,
    columns,
    monthLabels,
    activeDays,
    totalActivities,
    rawTotalActivities,
    longestStreak,
    categoryCounts,
    rawCategoryCounts,
    defaultSelectedDate: latestActiveDate || endKey,
  };
}
