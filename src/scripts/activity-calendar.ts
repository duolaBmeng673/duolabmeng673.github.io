import { activityLevel, createActivityCalendar, localDateKey, type ActivityRecord } from '../lib/activity';

const names = { coding: 'Coding', writing: 'Writing', research: 'Research', learning: 'Learning' } as const;
const dateLabel = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

document.querySelectorAll<HTMLElement>('[data-activity-calendar]').forEach((root) => {
  const grid = root.querySelector<HTMLElement>('.activity-grid');
  const calendar = root.querySelector<HTMLElement>('.activity-calendar');
  const months = root.querySelector<HTMLElement>('.activity-months');
  const summary = root.querySelector<HTMLElement>('[data-activity-summary]');
  const detail = root.querySelector<HTMLOutputElement>('.activity-detail');
  if (!grid || !calendar || !months || !summary || !detail) return;

  let records: ActivityRecord[];
  try {
    const data = JSON.parse(root.dataset.activityData ?? '{}') as { activities?: ActivityRecord[]; writing?: ActivityRecord[] };
    records = [...(data.activities ?? []), ...(data.writing ?? [])];
  } catch {
    detail.value = '活动记录暂时无法读取';
    return;
  }

  const data = createActivityCalendar(records, new Date());
  calendar.dataset.start = data.start;
  calendar.dataset.end = data.end;
  calendar.setAttribute('aria-colcount', String(data.columns.length));
  const monthTrack = document.createElement('span');
  monthTrack.className = 'activity-month-spacer';
  months.style.setProperty('--week-count', String(data.columns.length));
  months.replaceChildren(monthTrack);
  data.columns.forEach((column, index) => {
    const label = document.createElement('span');
    label.className = 'activity-month';
    label.dataset.column = String(index);
    const first = column.find((day) => day?.date.endsWith('-01'))?.date;
    label.textContent = first ? `${Number(first.slice(5, 7))}月` : '';
    months.append(label);
  });

  const weekDays = document.createElement('div');
  weekDays.className = 'activity-weekdays';
  weekDays.setAttribute('aria-hidden', 'true');
  ['日', '一', '二', '三', '四', '五', '六'].forEach((day, index) => {
    const label = document.createElement('span');
    label.textContent = index % 2 ? day : '';
    weekDays.append(label);
  });
  const weeks = document.createElement('div');
  weeks.className = 'activity-weeks';
  const buttons: HTMLButtonElement[] = [];
  const describe = (day: NonNullable<typeof data.columns[number][number]>) => {
    const counts = Object.entries(day.types).filter(([, count]) => count > 0) as Array<[keyof typeof names, number]>;
    const total = counts.reduce((sum, [, count]) => sum + count, 0);
    const items = counts.flatMap(([type, count]) => [`${names[type]}: ${count}`, ...(day.descriptions[type] ?? [])]);
    const label = `${dateLabel(day.date)}，${total} 次活动${items.length ? `：${items.join('；')}` : ''}`;
    return { total, items, label };
  };

  data.columns.forEach((column, columnIndex) => {
    const week = document.createElement('div');
    week.className = 'activity-week';
    week.setAttribute('role', 'presentation');
    column.forEach((day, rowIndex) => {
      const cell = document.createElement('button');
      cell.className = 'activity-cell';
      cell.type = 'button';
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-rowindex', String(rowIndex + 1));
      cell.setAttribute('aria-colindex', String(columnIndex + 1));
      if (day) {
        const { total, items, label } = describe(day);
        cell.dataset.date = day.date;
        cell.dataset.level = String(activityLevel(day));
        cell.dataset.total = String(total);
        cell.dataset.details = JSON.stringify(items);
        cell.setAttribute('aria-label', label);
        cell.title = label;
        cell.disabled = false;
      } else {
        cell.disabled = true;
        cell.setAttribute('aria-label', '日期范围外');
      }
      buttons.push(cell);
      week.append(cell);
    });
    weeks.append(week);
  });
  grid.replaceChildren(weekDays, weeks);
  summary.textContent = `${data.activityDays} 个活跃日 · ${data.totalActivities} 次活动`;

  const select = (button: HTMLButtonElement, moveFocus = false) => {
    buttons.forEach((cell) => {
      const selected = cell === button;
      cell.tabIndex = selected ? 0 : -1;
      cell.setAttribute('aria-selected', String(selected));
    });
    const date = button.dataset.date;
    const total = Number(button.dataset.total ?? 0);
    const items = JSON.parse(button.dataset.details ?? '[]') as string[];
    detail.value = `${date ? dateLabel(date) : ''} · ${total} 次活动${items.length ? ` · ${items.join(' · ')}` : ' · 无活动'}`;
    if (moveFocus) button.focus();
  };
  const current = buttons.find((button) => button.dataset.date === localDateKey(new Date()))
    ?? buttons.find((button) => !button.disabled);
  if (current) select(current);
  root.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-date]');
    if (button && root.contains(button)) select(button);
  });
  grid.addEventListener('keydown', (event) => {
    const currentButton = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-date]');
    if (!currentButton) return;
    const offset = event.key === 'ArrowRight' ? 7 : event.key === 'ArrowLeft' ? -7 : event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (!offset) return;
    event.preventDefault();
    const index = buttons.indexOf(currentButton);
    let next = index + offset;
    while (next >= 0 && next < buttons.length && buttons[next].disabled) next += Math.sign(offset);
    if (buttons[next] && !buttons[next].disabled) select(buttons[next], true);
  });
});
