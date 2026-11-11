import { activityKind, activityLevel, createActivityCalendar, getActivityDayDetails, localDateKey, type ActivityDay, type ActivityRecord } from '../lib/activity';

document.querySelectorAll<HTMLElement>('[data-activity-calendar]').forEach((root) => {
  const grid = root.querySelector<HTMLElement>('.activity-grid');
  const calendar = root.querySelector<HTMLElement>('.activity-calendar');
  const months = root.querySelector<HTMLElement>('.activity-months');
  const summary = root.querySelector<HTMLElement>('[data-activity-summary]');
  const detailDate = root.querySelector<HTMLTimeElement>('[data-activity-detail-date]');
  const detailTotal = root.querySelector<HTMLElement>('[data-activity-detail-total]');
  const detailGroups = root.querySelector<HTMLElement>('[data-activity-detail-groups]');
  const detailEmpty = root.querySelector<HTMLElement>('[data-activity-detail-empty]');
  if (!grid || !calendar || !months || !summary || !detailDate || !detailTotal || !detailGroups || !detailEmpty) return;

  let records: ActivityRecord[];
  let data: ReturnType<typeof createActivityCalendar>;
  try {
    const payload = JSON.parse(root.dataset.activityData ?? '{}') as { activities?: ActivityRecord[]; writing?: ActivityRecord[] };
    records = [...(payload.activities ?? []), ...(payload.writing ?? [])];
    data = createActivityCalendar(records, new Date());
  } catch {
    detailEmpty.textContent = '活动记录暂时无法读取，仍可查看上方日历。';
    detailEmpty.hidden = false;
    return;
  }

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
  const days = new Map<string, ActivityDay>();

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
      cell.setAttribute('aria-controls', 'activity-detail');
      if (day) {
        days.set(day.date, day);
        const { total, label } = getActivityDayDetails(day);
        cell.dataset.date = day.date;
        cell.dataset.level = String(activityLevel(day));
        cell.dataset.kind = activityKind(day);
        cell.dataset.total = String(total);
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
    const day = days.get(button.dataset.date ?? '');
    if (!day) return;
    buttons.forEach((cell) => {
      const selected = cell === button;
      cell.tabIndex = selected ? 0 : -1;
      cell.setAttribute('aria-selected', String(selected));
    });
    const { dateLabel, total, groups } = getActivityDayDetails(day);
    detailDate.dateTime = day.date;
    detailDate.textContent = dateLabel;
    detailTotal.textContent = `${total} 次活动`;
    detailEmpty.hidden = total > 0;
    detailGroups.replaceChildren();
    for (const group of groups) {
      const item = document.createElement('li');
      const heading = document.createElement('p');
      heading.className = 'activity-detail-type';
      heading.dataset.activityType = group.type;
      heading.textContent = `${group.label} · ${group.count} 次`;
      item.append(heading);
      if (group.descriptions.length) {
        const descriptions = document.createElement('ul');
        for (const description of group.descriptions) {
          const entry = document.createElement('li');
          entry.textContent = description;
          descriptions.append(entry);
        }
        item.append(descriptions);
      }
      detailGroups.append(item);
    }
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
