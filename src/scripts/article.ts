const copyText = async (text: string) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  const focus = document.activeElement;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.className = 'clipboard-fallback';
  document.body.append(area);
  area.select();
  try {
    // Local fallback for browsers without Clipboard API permission.
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
    if (focus instanceof HTMLElement) focus.focus({ preventScroll: true });
  }
};
document.querySelectorAll<HTMLElement>('.article-body pre').forEach((pre) => {
  const code = pre.querySelector('code');
  if (!code) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'article-code';
  pre.parentNode?.insertBefore(wrapper, pre);
  wrapper.append(pre);
  const tools = document.createElement('div');
  tools.className = 'article-code-tools';
  const language = document.createElement('span');
  language.className = 'code-language';
  language.textContent = pre.dataset.language ?? [...code.classList].find((name) => name.startsWith('language-'))?.slice(9) ?? '代码';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'code-copy';
  button.textContent = '复制';
  const feedback = document.createElement('span');
  feedback.className = 'code-copy-feedback';
  feedback.setAttribute('aria-live', 'polite');
  let reset: ReturnType<typeof setTimeout> | undefined;
  button.addEventListener('click', async () => {
    clearTimeout(reset);
    if (await copyText(code.textContent ?? '')) {
      button.textContent = '已复制';
      feedback.textContent = '代码已复制';
      reset = setTimeout(() => { button.textContent = '复制'; feedback.textContent = ''; }, 2000);
    } else {
      button.textContent = '复制';
      const range = document.createRange();
      range.selectNodeContents(code);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      feedback.textContent = '代码已选中，请手动复制';
    }
  });
  tools.append(language, feedback, button);
  wrapper.insertBefore(tools, pre);
});
let svgZoomDialog: HTMLDialogElement | null = null;
let svgZoomStage: HTMLDivElement | null = null;
let svgZoomTrigger: HTMLImageElement | SVGSVGElement | null = null;

const ensureSvgZoomDialog = () => {
  if (svgZoomDialog) return { dialog: svgZoomDialog, stage: svgZoomStage! };
  const dialog = document.createElement('dialog');
  dialog.className = 'svg-zoom-dialog';
  dialog.setAttribute('aria-label', 'SVG 放大视图');
  const surface = document.createElement('div');
  surface.className = 'svg-zoom-surface';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'svg-zoom-close';
  closeBtn.setAttribute('aria-label', '关闭放大视图');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => dialog.close());
  const stage = document.createElement('div');
  stage.className = 'svg-zoom-stage';
  surface.append(closeBtn, stage);
  dialog.append(surface);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    stage.replaceChildren();
    svgZoomTrigger?.focus();
    svgZoomTrigger = null;
  });
  document.body.append(dialog);
  svgZoomDialog = dialog;
  svgZoomStage = stage;
  return { dialog, stage };
};

const openSvgZoom = (diagram: HTMLImageElement | SVGSVGElement) => {
  const { dialog, stage } = ensureSvgZoomDialog();
  const clone = diagram.cloneNode(true) as HTMLElement;
  clone.removeAttribute('tabindex');
  clone.removeAttribute('role');
  clone.removeAttribute('style');
  stage.replaceChildren(clone);
  svgZoomTrigger = diagram;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
};

document.querySelectorAll<HTMLImageElement | SVGSVGElement>('.article-body [data-svg-diagram="true"]').forEach((diagram) => {
  let card = diagram.closest<HTMLElement>('.article-svg-card');
  if (!card) {
    card = document.createElement('span');
    card.className = 'article-svg-card';
    diagram.replaceWith(card);
    card.append(diagram);
  }
  if (diagram.tagName === 'IMG') {
    const attrW = diagram.getAttribute('width');
    if (attrW && /^\d+(?:\.\d+)?$/.test(attrW) && !diagram.style.width) {
      diagram.style.width = `${attrW}px`;
    }
  }
  diagram.setAttribute('tabindex', '0');
  diagram.setAttribute('role', 'button');
  const alt = diagram.getAttribute('alt') || diagram.querySelector('title')?.textContent?.trim() || '图表';
  diagram.setAttribute('aria-label', `放大查看 SVG：${alt}`);
  diagram.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openSvgZoom(diagram);
  });
  diagram.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      openSvgZoom(diagram);
    }
  });
  if (diagram.tagName !== 'IMG' || diagram.closest('a')) return;
  const src = diagram.getAttribute('src');
  if (!src?.endsWith('.svg')) return;
  const link = document.createElement('a');
  link.href = src; link.target = '_blank'; link.rel = 'noopener';
  link.className = 'article-svg-link';
  link.title = '在新标签页查看 SVG 原图';
  card.replaceWith(link); link.append(card);
  const hint = document.createElement('span');
  hint.className = 'svg-hint'; hint.textContent = '查看 SVG 原图 →';
  link.append(hint);
});
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const revealInsideFold = (element: HTMLElement) => {
  let fold = element.closest<HTMLDetailsElement>('details.study-fold');
  while (fold) {
    fold.open = true;
    fold = fold.parentElement?.closest<HTMLDetailsElement>('details.study-fold') ?? null;
  }
};
const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-toc-link]')];
const headings = links.map((link) => document.getElementById(decodeURIComponent(link.hash.slice(1)))).filter((heading): heading is HTMLElement => Boolean(heading));
const tocList = document.querySelector<HTMLOListElement>('[data-toc-pane="toc"] ol');
const parentH2ById = new Map<string, string>();
const groupByH2 = new Map<string, HTMLLIElement>();
if (tocList && links.length) {
  const items = [...tocList.children].filter((el): el is HTMLLIElement => el.tagName === 'LI');
  let currentH2Id = '';
  let currentSubList: HTMLOListElement | null = null;
  for (const li of items) {
    const a = li.querySelector<HTMLAnchorElement>('a[data-toc-link]');
    const slug = a?.hash ? decodeURIComponent(a.hash.slice(1)) : '';
    if (li.classList.contains('toc-level-2')) {
      currentH2Id = slug;
      currentSubList = null;
    } else if (li.classList.contains('toc-level-3') && currentH2Id) {
      if (slug) parentH2ById.set(slug, currentH2Id);
      if (!currentSubList) {
        const groupLi = document.createElement('li');
        groupLi.className = 'toc-sub-group';
        groupLi.dataset.tocGroup = currentH2Id;
        currentSubList = document.createElement('ol');
        currentSubList.className = 'toc-sub-list';
        groupLi.append(currentSubList);
        li.before(groupLi);
        groupByH2.set(currentH2Id, groupLi);
      }
      currentSubList.append(li);
    }
  }
  if (groupByH2.size > 0) tocList.classList.add('has-toc-collapse');
}
let tocIndicator: HTMLSpanElement | null = null;
if (tocList && links.length) {
  tocIndicator = document.createElement('span');
  tocIndicator.className = 'toc-slide-indicator';
  tocIndicator.setAttribute('aria-hidden', 'true');
  tocList.prepend(tocIndicator);
  tocList.classList.add('has-toc-indicator');
}
const syncTocIndicator = () => {
  if (!tocIndicator || !tocList) return;
  const active = links.find((link) => link.classList.contains('is-current'));
  const item = active?.closest<HTMLElement>('li');
  if (!item || item.offsetHeight === 0 || tocList.offsetHeight === 0) {
    tocIndicator.classList.remove('is-ready');
    return;
  }
  const top = item.getBoundingClientRect().top - tocList.getBoundingClientRect().top + 2;
  const height = Math.max(12, item.getBoundingClientRect().height - 4);
  tocIndicator.style.transform = `translateY(${Math.round(top)}px)`;
  tocIndicator.style.height = `${Math.round(height)}px`;
  tocIndicator.classList.add('is-ready');
};
const syncExpandedGroups = (activeId?: string) => {
  if (!groupByH2.size) return;
  const activeH2 = activeId
    ? (parentH2ById.get(activeId) ?? (groupByH2.has(activeId) ? activeId : ''))
    : '';
  for (const [h2Id, group] of groupByH2) {
    const expanded = h2Id === activeH2;
    group.classList.toggle('is-expanded', expanded);
    group.querySelectorAll<HTMLAnchorElement>('a[data-toc-link]').forEach((a) => {
      if (expanded) a.removeAttribute('tabindex');
      else a.setAttribute('tabindex', '-1');
    });
  }
};
const setCurrentById = (activeId?: string) => {
  links.forEach((link) => {
    const active = Boolean(activeId) && activeId === decodeURIComponent(link.hash.slice(1));
    link.classList.toggle('is-current', active);
    if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
  });
  syncExpandedGroups(activeId);
  syncTocIndicator();
};
let tocScrollLock = false;
let tocScrollLockTimer = 0;
let tocScrollEndHandler: (() => void) | null = null;
const clearTocScrollLock = () => {
  tocScrollLock = false;
  if (tocScrollLockTimer) {
    window.clearTimeout(tocScrollLockTimer);
    tocScrollLockTimer = 0;
  }
  if (tocScrollEndHandler) {
    window.removeEventListener('scrollend', tocScrollEndHandler);
    tocScrollEndHandler = null;
  }
};
const flashArrivedHeading = (target: HTMLElement) => {
  target.classList.remove('is-arrived');
  void target.offsetWidth;
  target.classList.add('is-arrived');
  window.setTimeout(() => target.classList.remove('is-arrived'), 680);
};
const updateCurrent = () => {
  if (tocScrollLock) return;
  const visible = headings.filter((heading) => heading.getClientRects().length > 0);
  const current = [...visible].reverse().find((heading) => heading.getBoundingClientRect().top <= 150) ?? visible[0];
  setCurrentById(current?.id);
};
const scrollToHeadingLink = (link: HTMLAnchorElement, event: MouseEvent) => {
  if (!link.hash) return;
  const id = decodeURIComponent(link.hash.slice(1));
  const target = document.getElementById(id);
  if (!target) return;
  event.preventDefault();
  revealInsideFold(target);
  document.querySelectorAll<HTMLImageElement>('.article-body img[loading="lazy"]').forEach((img) => {
    img.loading = 'eager';
  });
  const reduce = reducedMotion();
  clearTocScrollLock();
  tocScrollLock = !reduce;
  setCurrentById(id);
  if (reduce) {
    target.scrollIntoView({ behavior: 'auto', block: 'start' });
  } else {
    let arrived = false;
    let hops = 0;
    const scrollTarget = () => target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const finishArrival = () => {
      if (arrived) return;
      const expectedTop = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      const delta = target.getBoundingClientRect().top - expectedTop;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (Math.abs(delta) > 96 && !(delta > 0 && atBottom) && hops < 2) {
        hops += 1;
        clearTocScrollLock();
        tocScrollLock = true;
        scheduleArrival();
        scrollTarget();
        return;
      }
      arrived = true;
      clearTocScrollLock();
      setCurrentById(id);
      flashArrivedHeading(target);
    };
    const scheduleArrival = () => {
      tocScrollEndHandler = finishArrival;
      window.addEventListener('scrollend', finishArrival, { once: true });
      tocScrollLockTimer = window.setTimeout(finishArrival, 1400);
    };
    scheduleArrival();
    scrollTarget();
  }
  if (typeof history !== 'undefined') {
    history.replaceState(null, '', `${location.pathname}${location.search}${link.hash}`);
  }
};
links.forEach((link) => link.addEventListener('click', (event) => scrollToHeadingLink(link, event)));
let framePending = false;
document.addEventListener('study-mode-change', (event) => {
  const reason = (event as CustomEvent<{ reason?: string }>).detail?.reason;
  if (tocScrollLock && reason !== 'mode') return;
  clearTocScrollLock();
  updateCurrent();
});
if (tocList) {
  tocList.addEventListener('transitionend', (e) => {
    if ((e.target as HTMLElement)?.classList?.contains('toc-sub-group')) syncTocIndicator();
  });
  if ('ResizeObserver' in window) {
    new ResizeObserver(syncTocIndicator).observe(tocList);
  }
}
if (headings.length) {
  window.addEventListener('scroll', () => {
    if (tocScrollLock || framePending) return;
    framePending = true;
    requestAnimationFrame(() => { updateCurrent(); framePending = false; });
  }, { passive: true });
  updateCurrent();
}
document.querySelectorAll<HTMLAnchorElement>('.article-toc-mobile a').forEach((link) => link.addEventListener('click', (event) => {
  const details = link.closest('details');
  if (details) details.open = false;
  scrollToHeadingLink(link, event);
}));

const chapterSwitchers = [...document.querySelectorAll<HTMLDetailsElement>('[data-chapter-switcher]')];
if (chapterSwitchers.length) {
  document.addEventListener('click', (event) => {
    const target = event.target as Node | null;
    chapterSwitchers.forEach((switcher) => {
      if (switcher.open && target && !switcher.contains(target)) switcher.open = false;
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    chapterSwitchers.forEach((switcher) => {
      if (!switcher.open) return;
      event.preventDefault();
      switcher.open = false;
      switcher.querySelector<HTMLElement>('summary')?.focus();
    });
  });
}

const tocPanel = document.querySelector<HTMLElement>('[data-toc-panel]');
if (tocPanel) {
  const tocHeading = tocPanel.querySelector<HTMLElement>('[data-toc-heading]');
  const jumpToggle = tocPanel.querySelector<HTMLButtonElement>('[data-toc-jump-toggle]');
  const panes = [...tocPanel.querySelectorAll<HTMLElement>('[data-toc-pane]')];
  const modulePanels = [...tocPanel.querySelectorAll<HTMLElement>('[data-toc-module-panel]')];
  const moduleTabs = [...tocPanel.querySelectorAll<HTMLButtonElement>('[data-toc-module-tab]')];
  const jumpFilter = tocPanel.querySelector<HTMLInputElement>('[data-toc-jump-filter]');
  const jumpEmpty = tocPanel.querySelector<HTMLElement>('[data-toc-jump-empty]');
  const openBtn = document.querySelector<HTMLButtonElement>('[data-toc-drawer-open]');
  const closeBtn = tocPanel.querySelector<HTMLButtonElement>('[data-toc-drawer-close]');
  const backdrop = document.querySelector<HTMLElement>('[data-toc-backdrop]');
  const navMobile = document.querySelector<HTMLDetailsElement>('.article-nav-mobile');
  const articleJumpBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-article-jump-open]')];
  const mobileMq = window.matchMedia?.('(max-width: 639px)');
  const currentModuleSlug = tocPanel.dataset.currentModule || modulePanels[0]?.dataset.tocModulePanel || '';
  let activeModuleSlug = currentModuleSlug;
  let view: 'toc' | 'modules' | 'chapters' = 'toc';
  let activeModuleLabel = '笔记直达';
  let drawerOpen = false;

  const syncDrawer = (nextOpen = drawerOpen) => {
    const isMobile = Boolean(mobileMq?.matches);
    drawerOpen = isMobile ? nextOpen : false;
    if (openBtn) {
      openBtn.hidden = !isMobile;
      openBtn.setAttribute('aria-expanded', String(drawerOpen));
    }
    if (closeBtn) closeBtn.hidden = !isMobile;
    if (backdrop) backdrop.hidden = !drawerOpen;
    tocPanel.classList.toggle('is-open', drawerOpen);
    tocPanel.inert = isMobile && !drawerOpen;
  };

  const scrollToActiveChapterItem = (pane: HTMLElement) => {
    const visibleMod = modulePanels.find((p) => !p.hidden);
    const activeItem = visibleMod?.querySelector<HTMLElement>('a.is-active, a[aria-current="page"]');
    if (activeItem) {
      requestAnimationFrame(() => {
        const paneRect = pane.getBoundingClientRect();
        const itemRect = activeItem.getBoundingClientRect();
        const targetTop = pane.scrollTop + (itemRect.top - paneRect.top) - pane.clientHeight / 2 + itemRect.height / 2;
        pane.scrollTo({ top: Math.max(0, targetTop), behavior: reducedMotion() ? 'auto' : 'smooth' });
      });
    } else {
      pane.scrollTop = 0;
    }
  };

  const applyJumpFilter = (rawQuery: string) => {
    const query = rawQuery.trim().toLowerCase();
    let visibleCount = 0;
    modulePanels.forEach((panel) => {
      let panelCount = 0;
      panel.querySelectorAll<HTMLElement>('.toc-jump-group').forEach((group) => {
        let groupCount = 0;
        group.querySelectorAll<HTMLElement>('[data-toc-jump-item]').forEach((item) => {
          const text = item.dataset.searchText ?? item.textContent?.toLowerCase() ?? '';
          const hit = !query || text.includes(query);
          item.hidden = !hit;
          if (hit) groupCount += 1;
        });
        group.hidden = groupCount === 0;
        panelCount += groupCount;
      });
      if (!panel.hidden) visibleCount = panelCount;
    });
    if (jumpEmpty) jumpEmpty.hidden = visibleCount > 0;
  };

  const setView = (nextView: 'toc' | 'modules' | 'chapters', label?: string) => {
    view = nextView;
    if (label) activeModuleLabel = label;
    tocPanel.dataset.tocView = nextView;
    panes.forEach((pane) => {
      const visible = pane.dataset.tocPane === nextView;
      pane.setAttribute('aria-hidden', String(!visible));
      if (visible && nextView === 'chapters') scrollToActiveChapterItem(pane);
    });
    if (jumpToggle) {
      const inJump = nextView !== 'toc';
      jumpToggle.textContent = inJump ? '返回目录' : '笔记直达';
      jumpToggle.setAttribute('aria-expanded', String(inJump));
      jumpToggle.classList.toggle('is-active', inJump);
    }
    if (tocHeading) {
      tocHeading.textContent = nextView === 'toc' ? '目录' : nextView === 'modules' ? '笔记直达' : activeModuleLabel;
    }
  };

  const activateModule = (slug: string, focusFilter = false) => {
    const targetSlug = slug || modulePanels[0]?.dataset.tocModulePanel || '';
    if (!targetSlug) return;
    activeModuleSlug = targetSlug;
    modulePanels.forEach((panel) => {
      panel.hidden = panel.dataset.tocModulePanel !== targetSlug;
    });
    let resolvedLabel = '笔记直达';
    moduleTabs.forEach((tab) => {
      const active = tab.dataset.tocModuleTab === targetSlug;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      if (active) resolvedLabel = tab.dataset.moduleLabel || tab.textContent?.trim() || resolvedLabel;
    });
    if (!moduleTabs.length) {
      const fallbackBtn = tocPanel.querySelector<HTMLElement>(`[data-toc-select-module="${targetSlug}"] strong`);
      if (fallbackBtn?.textContent) resolvedLabel = fallbackBtn.textContent.trim();
    }
    setView('chapters', resolvedLabel);
    applyJumpFilter(jumpFilter?.value ?? '');
    if (focusFilter && jumpFilter) {
      requestAnimationFrame(() => jumpFilter.focus({ preventScroll: true }));
    }
  };

  const openJumpPanel = () => {
    if (mobileMq?.matches) {
      syncDrawer(true);
      activateModule(activeModuleSlug || currentModuleSlug, true);
      return;
    }
    if (getComputedStyle(tocPanel).display === 'none' && navMobile) {
      navMobile.open = true;
      navMobile.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
      navMobile.querySelector<HTMLElement>('summary')?.focus();
      return;
    }
    activateModule(activeModuleSlug || currentModuleSlug, true);
  };

  jumpToggle?.addEventListener('click', () => {
    if (view === 'toc') {
      activateModule(activeModuleSlug || currentModuleSlug, true);
    } else {
      setView('toc');
    }
  });

  moduleTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const slug = tab.dataset.tocModuleTab;
      if (slug) activateModule(slug, true);
    });
  });

  jumpFilter?.addEventListener('input', () => {
    applyJumpFilter(jumpFilter.value);
  });

  jumpFilter?.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    if (jumpFilter.value) {
      jumpFilter.value = '';
      applyJumpFilter('');
      return;
    }
    if (mobileMq?.matches && drawerOpen) closeDrawer(true);
    else setView('toc');
  });

  articleJumpBtns.forEach((btn) => btn.addEventListener('click', openJumpPanel));

  document.addEventListener('keydown', (event) => {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.code !== 'KeyJ') return;
    const target = event.target as HTMLElement | null;
    if (target && target !== jumpFilter && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;
    event.preventDefault();
    if (view === 'chapters' && (!mobileMq?.matches || drawerOpen)) {
      if (mobileMq?.matches) closeDrawer(true);
      else setView('toc');
    } else {
      openJumpPanel();
    }
  });

  tocPanel.querySelectorAll<HTMLButtonElement>('[data-toc-select-module]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const slug = btn.dataset.tocSelectModule;
      if (slug) activateModule(slug, true);
    });
  });

  tocPanel.querySelector('[data-toc-back-modules]')?.addEventListener('click', () => {
    setView('modules');
  });

  openBtn?.addEventListener('click', () => {
    syncDrawer(true);
    (closeBtn ?? jumpToggle)?.focus();
  });

  const closeDrawer = (restoreFocus = true) => {
    if (!drawerOpen) return;
    syncDrawer(false);
    if (restoreFocus) openBtn?.focus();
  };

  closeBtn?.addEventListener('click', () => closeDrawer(true));
  backdrop?.addEventListener('click', () => closeDrawer(true));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawerOpen) {
      e.preventDefault();
      closeDrawer(true);
    }
  });
  links.forEach((link) => link.addEventListener('click', () => {
    if (mobileMq?.matches && drawerOpen) closeDrawer(false);
  }));
  mobileMq?.addEventListener('change', () => syncDrawer(false));
  syncDrawer(false);
}

// Sandboxed local demos have opaque origins; trust only their Window and build key.
const demos = [...document.querySelectorAll<HTMLIFrameElement>('iframe[data-demo-key]')];
const sendDemoTheme = (frame: HTMLIFrameElement) => frame.contentWindow?.postMessage({
  type: 'blog-demo:theme', key: frame.dataset.demoKey, theme: document.documentElement.dataset.theme ?? 'light',
}, '*');
if (demos.length) {
  window.addEventListener('message', (event: MessageEvent) => {
    const frame = demos.find((demo) => demo.contentWindow === event.source);
    if (!frame || !event.data || event.data.key !== frame.dataset.demoKey) return;
    if (event.data.type === 'blog-demo:ready') sendDemoTheme(frame);
    if (event.data.type === 'blog-demo:size' && typeof event.data.height === 'number' && Number.isFinite(event.data.height)) {
      frame.style.height = `${Math.max(360, Math.min(12000, Math.ceil(event.data.height)))}px`;
    }
  });
  demos.forEach((frame) => { frame.addEventListener('load', () => sendDemoTheme(frame)); sendDemoTheme(frame); });
  new MutationObserver(() => demos.forEach(sendDemoTheme)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
