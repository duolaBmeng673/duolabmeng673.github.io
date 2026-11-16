import { readKnowledgeFilter, matchesKnowledgeTags, writeKnowledgeFilter } from '../lib/knowledge-filter';

document.querySelectorAll<HTMLElement>('[data-knowledge-directory]').forEach((root) => {
  const rows = [...root.querySelectorAll<HTMLElement>('[data-knowledge-entry]')].map((element) => ({
    element, tags: JSON.parse(element.dataset.knowledgeTags ?? '[]') as string[],
  }));
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-t]')];
  const legends = [...root.querySelectorAll<HTMLButtonElement>('[data-knowledge-category]')];
  const allCategoryBtn = root.querySelector<HTMLButtonElement>('[data-knowledge-category-all]');
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
    allCategoryBtn?.setAttribute('aria-pressed', String(!category));
    allCategoryBtn?.classList.toggle('is-active', !category);
    legends.forEach((button) => {
      const active = button.dataset.knowledgeCategory === category;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('is-active', active);
    });
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
  allCategoryBtn?.addEventListener('click', () => {
    category = '';
    apply(false);
  });
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
    // Desktop sticky horizontal legend bar activates at >= 1024px (matches /blog/ archive-tools).
    const wide = window.matchMedia('(min-width: 1024px)');
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
  const chapterNavLinks = [...root.querySelectorAll<HTMLAnchorElement>('[data-chapter-nav-link]')];
  const chapterSections = chapterNavLinks
    .map((link) => root.querySelector<HTMLElement>(`#${link.dataset.chapterNavLink}`))
    .filter((el): el is HTMLElement => Boolean(el));
  const setNavActive = (id: string) => {
    chapterNavLinks.forEach((link) => {
      link.classList.toggle('is-active', link.dataset.chapterNavLink === id);
    });
  };
  const scrollToChapter = (id: string, push = true) => {
    const target = root.querySelector<HTMLElement>(`#${id}`);
    if (!target) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setNavActive(id);
    if (push && typeof history !== 'undefined') {
      history.pushState(null, '', `${location.pathname}${location.search}#${id}`);
    }
  };
  chapterNavLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      const id = link.dataset.chapterNavLink;
      if (!id) return;
      event.preventDefault();
      scrollToChapter(id, true);
    });
  });
  if (location.hash && chapterNavLinks.some((link) => `#${link.dataset.chapterNavLink}` === location.hash)) {
    requestAnimationFrame(() => scrollToChapter(location.hash.slice(1), false));
  }
  if (chapterNavLinks.length && chapterSections.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setNavActive(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: 0.01 },
    );
    chapterSections.forEach((sec) => io.observe(sec));
  }
  apply(false);
});
