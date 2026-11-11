export const activityTypes = ['coding', 'writing', 'research', 'learning', 'site'] as const;
export type ActivityType = typeof activityTypes[number];

export interface ActivityRecord {
  date: string;
  type: ActivityType;
  count: number;
  description?: string;
}

export interface ActivityDay {
  date: string;
  types: Record<ActivityType, number>;
  descriptions: Partial<Record<ActivityType, string[]>>;
}

const activityLabels: Record<ActivityType, string> = {
  coding: '代码开发', writing: '写作', research: '研究', learning: '学习', site: '博客功能',
};

export function getActivityDayDetails(day: ActivityDay) {
  // A calendar date is not an instant: keep its label independent of the viewer's timezone.
  const [year, month, date] = day.date.split('-');
  const dateLabel = `${year} 年 ${Number(month)} 月 ${Number(date)} 日`;
  const groups = activityTypes.filter((type) => day.types[type] > 0).map((type) => ({
    type, label: activityLabels[type], count: day.types[type], descriptions: [...(day.descriptions[type] ?? [])],
  }));
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  const descriptions = groups.map((group) => `${group.label}：${group.count} 次${group.descriptions.length ? `，${group.descriptions.join('；')}` : ''}`);
  const label = `${dateLabel}，${total} 次活动：${descriptions.length ? descriptions.join('；') : '当天没有活动'}`;
  return { dateLabel, total, groups, label };
}

export function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createActivityCalendar(records: ActivityRecord[], today = new Date(), count = 365) {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - count + 1);
  const days = new Map<string, ActivityDay>();
  for (const record of records) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date) || !activityTypes.includes(record.type) || !Number.isInteger(record.count) || record.count < 1) {
      throw new Error(`Invalid activity record: ${JSON.stringify(record)}`);
    }
    const parsed = new Date(`${record.date}T00:00:00`);
    if (localDateKey(parsed) !== record.date) throw new Error(`Invalid activity date: ${record.date}`);
    if (parsed < start || parsed > end) continue;
    let day = days.get(record.date);
    if (!day) {
      day = { date: record.date, types: { coding: 0, writing: 0, research: 0, learning: 0, site: 0 }, descriptions: {} };
      days.set(record.date, day);
    }
    day.types[record.type] += record.count;
    if (record.description) (day.descriptions[record.type] ??= []).push(record.description);
  }
  const calendarStart = new Date(start);
  calendarStart.setDate(calendarStart.getDate() - calendarStart.getDay());
  const calendarEnd = new Date(end);
  calendarEnd.setDate(calendarEnd.getDate() + (6 - calendarEnd.getDay()));
  const cells: Array<ActivityDay | null> = [];
  for (const date = new Date(calendarStart); date <= calendarEnd; date.setDate(date.getDate() + 1)) {
    cells.push(date < start || date > end ? null : days.get(localDateKey(date)) ?? {
      date: localDateKey(date), types: { coding: 0, writing: 0, research: 0, learning: 0, site: 0 }, descriptions: {},
    });
  }
  const columns = Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
  const activityDays = [...days.values()].filter((day) => Object.values(day.types).some((value) => value > 0)).length;
  const totalActivities = [...days.values()].reduce((total, day) => total + Object.values(day.types).reduce((sum, value) => sum + value, 0), 0);
  return { start: localDateKey(start), end: localDateKey(end), columns, activityDays, totalActivities };
}

export function activityLevel(day: ActivityDay | null) {
  const total = day ? Object.values(day.types).reduce((sum, value) => sum + value, 0) : 0;
  return total === 0 ? 0 : total === 1 ? 1 : total <= 3 ? 2 : total <= 6 ? 3 : 4;
}

export function activityKind(day: ActivityDay | null) {
  if (!day?.types.site) return 'content';
  return activityTypes.some((type) => type !== 'site' && day.types[type] > 0) ? 'mixed' : 'site';
}
