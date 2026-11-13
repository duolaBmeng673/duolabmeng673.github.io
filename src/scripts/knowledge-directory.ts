import { readKnowledgeFilter, matchesKnowledgeTags, writeKnowledgeFilter } from '../lib/knowledge-filter';

document.querySelectorAll<HTMLElement>('[data-knowledge-directory]').forEach((root) => {
  const rows = [...root.querySelectorAll<HTMLElement>('[data-knowledge-entry]')].map((element) => ({
    element, tags: JSON.parse(element.dataset.knowledgeTags ?? '[]') as string[],
  }));
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-t]')];
  const legends = [...root.querySelectorAll<HTMLButtonElement>('[data-knowledge-category]')];
  const selection = root.querySelector<HTMLElement>('[data-knowledge-selection]');
  const status = root.querySelector<HTMLElement>('[data-knowledge-status]');
  const empty = root.querySelector<HTMLElement>('[data-knowledge-empty]');
  let selected = readKnowledgeFilter(location.search);
  let category = '';
  const apply = (writeUrl = true) => {
    let matches = 0;
    for (const row of rows) {
      row.element.hidden = !matchesKnowledgeTags(row.tags, selected);
      if (!row.element.hidden) matches++;
    }
    buttons.forEach((button) => {
      button.setAttribute('aria-pressed', String(selected.has(button.dataset.t!)));
      button.classList.toggle('is-muted', Boolean(category && button.dataset.c !== category));
    });
    legends.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.knowledgeCategory === category)));
    root.querySelectorAll<HTMLElement>('[data-knowledge-chapter]').forEach((chapter) => {
      chapter.hidden = !chapter.querySelector('[data-knowledge-entry]:not([hidden])');
    });
    if (selection) selection.hidden = !selected.size;
    if (status) status.textContent = `已选 ${selected.size} 个标签`;
    if (empty) empty.hidden = matches > 0;
    if (writeUrl) {
      const next = writeKnowledgeFilter(location.href, selected);
      if (next !== location.pathname + location.search + location.hash) history.pushState(null, '', next);
    }
  };
  buttons.forEach((button) => button.addEventListener('click', () => {
    const name = button.dataset.t!;
    if (selected.has(name)) selected.delete(name); else selected.add(name);
    apply();
  }));
  legends.forEach((button) => button.addEventListener('click', () => {
    category = category === button.dataset.knowledgeCategory ? '' : button.dataset.knowledgeCategory!;
    apply(false);
  }));
  root.querySelector('[data-knowledge-clear]')?.addEventListener('click', () => {
    selected.clear(); apply();
    // The clear button is now hidden; return focus to a visible control.
    (legends[0] ?? buttons[0])?.focus();
  });
  window.addEventListener('popstate', () => { selected = readKnowledgeFilter(location.search); apply(false); });
  const controls = root.querySelector<HTMLElement>('[data-knowledge-controls]');
  const toggle = root.querySelector<HTMLButtonElement>('[data-knowledge-toggle]');
  if (controls && toggle) {
    // 1120px content + 2 × (150px legend + 24px gap + 16px safety).
    const wide = window.matchMedia('(min-width: 1500px)');
    let open = false;
    const showLegend = () => {
      controls.hidden = !wide.matches && !open;
      controls.dataset.legendMode = wide.matches ? 'sidebar' : 'popover';
      toggle.hidden = wide.matches;
      toggle.setAttribute('aria-expanded', String(!wide.matches && open));
    };
    toggle.addEventListener('click', () => {
      open = !open; showLegend();
      if (open) legends[0]?.focus();
    });
    document.addEventListener('click', (event) => {
      if (!controls.contains(event.target as Node) && !toggle.contains(event.target as Node)) {
        open = false; showLegend();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !wide.matches && open) {
        event.preventDefault(); open = false; showLegend(); toggle.focus();
      }
    });
    wide.addEventListener('change', () => {
      const wasInside = controls.contains(document.activeElement);
      const wasToggle = document.activeElement === toggle;
      open = false; showLegend();
      if (!wide.matches && wasInside) toggle.focus();
      else if (wide.matches && wasToggle) legends[0]?.focus();
    });
    showLegend();
  }
  apply(false);
});
