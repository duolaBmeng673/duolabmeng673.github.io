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
  const chapterNavContainer = chapterNavLinks[0]?.closest<HTMLElement>('nav') ?? null;
  let slideIndicator: HTMLSpanElement | null = null;
  if (chapterNavContainer && typeof document.createElement === 'function') {
    slideIndicator = document.createElement('span');
    slideIndicator.className = 'nav-slide-indicator';
    slideIndicator.setAttribute('aria-hidden', 'true');
    chapterNavContainer.prepend(slideIndicator);
    chapterNavContainer.classList.add('has-slide-indicator');
  }
  const syncSlideIndicator = () => {
    if (!slideIndicator || !chapterNavContainer) return;
    const activeLink = chapterNavLinks.find((link) => link.classList.contains('is-active'));
    if (!activeLink || activeLink.offsetHeight === 0) {
      slideIndicator.classList.remove('is-ready');
      return;
    }
    slideIndicator.style.transform = `translateY(${activeLink.offsetTop}px)`;
    slideIndicator.style.height = `${activeLink.offsetHeight}px`;
    slideIndicator.classList.add('is-ready');
  };
  let activeChapterId = chapterNavLinks.find((link) => link.classList.contains('is-active'))?.dataset.chapterNavLink ?? '';
  const setNavActive = (id: string) => {
    activeChapterId = id;
    chapterNavLinks.forEach((link) => {
      link.classList.toggle('is-active', link.dataset.chapterNavLink === id);
    });
    syncSlideIndicator();
  };
  let scrollLock = false;
  let scrollLockTimer = 0;
  let scrollEndHandler: (() => void) | null = null;
  const triggerArriveFlash = (id: string) => {
    const sec = root.querySelector<HTMLElement>(`#${id}`);
    const header = sec?.querySelector<HTMLElement>(':scope > header') ?? sec;
    if (!header) return;
    header.classList.remove('is-arrived');
    void header.offsetWidth;
    header.classList.add('is-arrived');
    window.setTimeout(() => header.classList.remove('is-arrived'), 680);
  };
  const clearScrollLock = () => {
    scrollLock = false;
    if (scrollLockTimer) {
      window.clearTimeout(scrollLockTimer);
      scrollLockTimer = 0;
    }
    if (scrollEndHandler) {
      window.removeEventListener('scrollend', scrollEndHandler);
      scrollEndHandler = null;
    }
  };
  const scrollToChapter = (id: string, push = true) => {
    const target = root.querySelector<HTMLElement>(`#${id}`);
    if (!target) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    clearScrollLock();
    scrollLock = !reduce;
    setNavActive(id);
    if (reduce) {
      target.scrollIntoView({ behavior: 'auto', block: 'start' });
    } else {
      let arrived = false;
      const finishArrival = () => {
        if (arrived) return;
        arrived = true;
        clearScrollLock();
        setNavActive(id);
        triggerArriveFlash(id);
      };
      scrollEndHandler = finishArrival;
      window.addEventListener('scrollend', finishArrival, { once: true });
      scrollLockTimer = window.setTimeout(finishArrival, 1400);
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
        if (scrollLock) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setNavActive(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: 0.01 },
    );
    chapterSections.forEach((sec) => io.observe(sec));
  }
  if (chapterNavContainer && 'ResizeObserver' in window) {
    new ResizeObserver(syncSlideIndicator).observe(chapterNavContainer);
  }
  if (activeChapterId) requestAnimationFrame(syncSlideIndicator);
  apply(false);
});

const studyJumpDialog = document.querySelector?.<HTMLElement>('[data-study-jump-dialog]');
const studyJumpOpeners = [...(document.querySelectorAll?.<HTMLButtonElement>('[data-study-jump-open]') ?? [])];
if (studyJumpDialog && studyJumpOpeners.length) {
  const tabs = [...studyJumpDialog.querySelectorAll<HTMLButtonElement>('[data-study-jump-tab]')];
  const groups = [...studyJumpDialog.querySelectorAll<HTMLElement>('[data-study-jump-group]')];
  const items = [...studyJumpDialog.querySelectorAll<HTMLElement>('[data-study-jump-item]')];
  const filterInput = studyJumpDialog.querySelector<HTMLInputElement>('[data-study-jump-filter]');
  const emptyState = studyJumpDialog.querySelector<HTMLElement>('[data-study-jump-empty]');
  const closers = [...studyJumpDialog.querySelectorAll<HTMLElement>('[data-study-jump-close]')];
  const defaultModule = studyJumpDialog.dataset.defaultModule || 'all';
  let activeModule = defaultModule;
  let lastTrigger: HTMLElement | null = null;

  const applyJumpFilter = () => {
    const query = (filterInput?.value ?? '').trim().toLowerCase();
    let visibleItems = 0;
    for (const group of groups) {
      const mod = group.dataset.studyJumpGroup;
      const inModule = activeModule === 'all' || mod === activeModule;
      if (!inModule) {
        group.hidden = true;
        continue;
      }
      let groupMatches = 0;
      for (const item of group.querySelectorAll<HTMLElement>('[data-study-jump-item]')) {
        const text = item.dataset.searchText ?? '';
        const matched = !query || text.includes(query);
        item.hidden = !matched;
        if (matched) {
          groupMatches += 1;
          visibleItems += 1;
        }
      }
      group.hidden = groupMatches === 0;
    }
    if (emptyState) emptyState.hidden = visibleItems > 0;
  };

  const selectJumpTab = (slug: string) => {
    activeModule = slug || 'all';
    tabs.forEach((tab) => {
      const selected = tab.dataset.studyJumpTab === activeModule;
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-selected', String(selected));
    });
    applyJumpFilter();
  };

  const openStudyJump = (trigger?: HTMLElement | null) => {
    lastTrigger = trigger ?? studyJumpOpeners[0] ?? null;
    if (filterInput) filterInput.value = '';
    selectJumpTab(defaultModule);
    studyJumpDialog.hidden = false;
    studyJumpOpeners.forEach((btn) => btn.setAttribute('aria-expanded', 'true'));
    requestAnimationFrame(() => filterInput?.focus());
  };

  const closeStudyJump = (restoreFocus = true) => {
    if (studyJumpDialog.hidden) return;
    studyJumpDialog.hidden = true;
    studyJumpOpeners.forEach((btn) => btn.setAttribute('aria-expanded', 'false'));
    if (restoreFocus) (lastTrigger ?? studyJumpOpeners[0])?.focus();
  };

  studyJumpOpeners.forEach((btn) => btn.addEventListener('click', () => openStudyJump(btn)));
  closers.forEach((el) => el.addEventListener('click', () => closeStudyJump(true)));
  tabs.forEach((tab) => tab.addEventListener('click', () => selectJumpTab(tab.dataset.studyJumpTab ?? 'all')));
  filterInput?.addEventListener('input', applyJumpFilter);
  items.forEach((item) => item.querySelector('a')?.addEventListener('click', () => closeStudyJump(false)));

  document.addEventListener?.('keydown', (event) => {
    if (event.key === 'Escape' && !studyJumpDialog.hidden) {
      event.preventDefault();
      closeStudyJump(true);
      return;
    }
    if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.code === 'KeyJ') {
      const active = document.activeElement as HTMLElement | null;
      const inInput = active && (['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) || active.isContentEditable);
      if (inInput && studyJumpDialog.hidden) return;
      event.preventDefault();
      if (studyJumpDialog.hidden) openStudyJump(studyJumpOpeners[0]);
      else closeStudyJump(true);
    }
  });
}
