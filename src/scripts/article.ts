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
const tocPane = document.querySelector<HTMLElement>('[data-toc-pane="toc"]');
const tocList = tocPane?.querySelector<HTMLOListElement>('ol') ?? null;
let tocIndicator: HTMLSpanElement | null = null;
let lastScrolledTocId: string | undefined;
if (tocList && links.length) {
  tocIndicator = document.createElement('span');
  tocIndicator.className = 'toc-slide-indicator';
  tocIndicator.setAttribute('aria-hidden', 'true');
  tocList.prepend(tocIndicator);
  tocList.classList.add('has-toc-indicator');
}
const ensureTocItemInView = (item: HTMLElement) => {
  if (!tocPane || tocPane.clientHeight <= 0 || tocPane.scrollHeight <= tocPane.clientHeight + 2) return;
  const edgePad = 10;
  const paneRect = tocPane.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  if (paneRect.height <= 0 || itemRect.height <= 0) return;

  const minTop = paneRect.top + edgePad;
  const maxBottom = paneRect.bottom - edgePad;
  let nextTop: number | null = null;

  if (itemRect.bottom > maxBottom) {
    nextTop = tocPane.scrollTop + (itemRect.bottom - maxBottom);
  } else if (itemRect.top < minTop) {
    nextTop = tocPane.scrollTop - (minTop - itemRect.top);
  }
  if (nextTop === null) return;

  const maxScroll = Math.max(0, tocPane.scrollHeight - tocPane.clientHeight);
  tocPane.scrollTop = Math.max(0, Math.min(maxScroll, nextTop));
};
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
const setCurrentById = (activeId?: string) => {
  const changed = activeId !== lastScrolledTocId;
  lastScrolledTocId = activeId;
  let activeItem: HTMLElement | null = null;
  links.forEach((link) => {
    const active = Boolean(activeId) && activeId === decodeURIComponent(link.hash.slice(1));
    link.classList.toggle('is-current', active);
    if (active) {
      link.setAttribute('aria-current', 'location');
      activeItem = link.closest<HTMLElement>('li');
    } else {
      link.removeAttribute('aria-current');
    }
  });
  if (changed && activeItem) ensureTocItemInView(activeItem);
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
if (tocList && 'ResizeObserver' in window) {
  new ResizeObserver(syncTocIndicator).observe(tocList);
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
  type TocView = 'toc' | 'modules' | 'tree';
  const tocHeading = tocPanel.querySelector<HTMLElement>('[data-toc-heading]');
  const tocHeadingModule = tocPanel.querySelector<HTMLElement>('[data-toc-heading-module]');
  const noteTitle = tocHeading?.dataset.noteTitle || tocHeading?.textContent?.trim() || '';
  const jumpToggle = tocPanel.querySelector<HTMLButtonElement>('[data-toc-jump-toggle]');
  const jumpToggleLabel = jumpToggle?.querySelector<HTMLElement>('[data-toc-jump-label]');
  const panes = [...tocPanel.querySelectorAll<HTMLElement>('[data-toc-pane]')];
  const paneByView = new Map<TocView, HTMLElement>();
  panes.forEach((pane) => {
    const key = pane.dataset.tocPane as TocView | undefined;
    if (key) paneByView.set(key, pane);
  });
  const treeScroll = tocPanel.querySelector<HTMLElement>('.toc-tree-scroll');
  const modulePanels = [...tocPanel.querySelectorAll<HTMLElement>('[data-toc-module-panel]')];
  const moduleButtons = [...tocPanel.querySelectorAll<HTMLButtonElement>('[data-toc-select-module]')];
  const backModulesBtn = tocPanel.querySelector<HTMLButtonElement>('[data-toc-back-modules]');
  const openBtn = document.querySelector<HTMLButtonElement>('[data-toc-drawer-open]');
  const closeBtn = tocPanel.querySelector<HTMLButtonElement>('[data-toc-drawer-close]');
  const backdrop = document.querySelector<HTMLElement>('[data-toc-backdrop]');
  const navMobile = document.querySelector<HTMLDetailsElement>('.article-nav-mobile');
  const articleJumpBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-article-jump-open]')];
  const mobileMq = window.matchMedia?.('(max-width: 639px)');
  const currentModuleSlug = tocPanel.dataset.currentModule || modulePanels[0]?.dataset.tocModulePanel || '';
  const ANIMATE_CLASSES = ['is-enter-from-right', 'is-enter-from-left', 'is-leave-to-left', 'is-leave-to-right', 'is-leaving'];
  let activeModuleSlug = currentModuleSlug;
  let view: TocView = 'toc';
  let drawerOpen = false;
  let transitionSeq = 0;
  let phaseTimer = 0;
  let lastJumpTrigger: HTMLElement | null = null;

  const installScrollContain = (container: HTMLElement) => {
    container.addEventListener('wheel', (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const maxScroll = container.scrollHeight - container.clientHeight;
      if (maxScroll <= 1) return;
      const dy = event.deltaMode === 1
        ? event.deltaY * 16
        : event.deltaMode === 2
          ? event.deltaY * container.clientHeight
          : event.deltaY;
      if (dy === 0) return;
      const next = container.scrollTop + dy;
      if (dy < 0 && next <= 0) {
        event.preventDefault();
        container.scrollTop = 0;
      } else if (dy > 0 && next >= maxScroll) {
        event.preventDefault();
        container.scrollTop = maxScroll;
      }
    }, { passive: false });
  };
  tocPanel.querySelectorAll<HTMLElement>('[data-toc-scroll]').forEach(installScrollContain);

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

  const scrollToActiveChapterItem = (instant = false) => {
    if (!treeScroll) return;
    const visibleMod = modulePanels.find((p) => !p.hidden);
    const activeItem = visibleMod?.querySelector<HTMLElement>('a.is-active, a[aria-current="page"]');
    const activeGroup = activeItem?.closest<HTMLDetailsElement>('[data-toc-chapter-group]');
    if (activeGroup) activeGroup.open = true;
    requestAnimationFrame(() => {
      if (activeItem) {
        const containerRect = treeScroll.getBoundingClientRect();
        const itemRect = activeItem.getBoundingClientRect();
        const targetTop = treeScroll.scrollTop + (itemRect.top - containerRect.top) - treeScroll.clientHeight / 2 + itemRect.height / 2;
        treeScroll.scrollTo({ top: Math.max(0, targetTop), behavior: instant || reducedMotion() ? 'auto' : 'smooth' });
      } else {
        treeScroll.scrollTop = 0;
      }
    });
  };

  const getModuleLabel = (slug: string) =>
    modulePanels.find((panel) => panel.dataset.tocModulePanel === slug)?.dataset.moduleLabel
    || moduleButtons.find((btn) => btn.dataset.tocSelectModule === slug)?.dataset.moduleLabel
    || '';

  const applyViewState = (nextView: TocView) => {
    view = nextView;
    tocPanel.dataset.tocView = nextView;
    panes.forEach((pane) => {
      const visible = pane.dataset.tocPane === nextView;
      pane.setAttribute('aria-hidden', String(!visible));
    });
    if (jumpToggle) {
      const inJump = nextView !== 'toc';
      (jumpToggleLabel ?? jumpToggle).textContent = inJump ? '返回目录' : '笔记直达';
      jumpToggle.setAttribute('aria-expanded', String(inJump));
      jumpToggle.classList.toggle('is-active', inJump);
    }
    if (tocHeading) {
      tocHeading.textContent = nextView === 'toc' ? noteTitle : nextView === 'modules' ? '笔记直达 · 选择模块' : '笔记直达';
    }
    if (tocHeadingModule) {
      const modTitle = nextView === 'tree' ? getModuleLabel(activeModuleSlug) : '';
      tocHeadingModule.textContent = modTitle;
      tocHeadingModule.hidden = !modTitle;
    }
  };

  const focusFirstInView = (targetView: TocView, preferSelectedModule = false) => {
    requestAnimationFrame(() => {
      if (targetView === 'modules') {
        const target = preferSelectedModule
          ? (moduleButtons.find((b) => b.dataset.tocSelectModule === activeModuleSlug) ?? moduleButtons[0])
          : moduleButtons[0];
        target?.focus({ preventScroll: true });
      } else if (targetView === 'tree') {
        backModulesBtn?.focus({ preventScroll: true });
      }
    });
  };

  const clearTransitionState = () => {
    if (phaseTimer) {
      window.clearTimeout(phaseTimer);
      phaseTimer = 0;
    }
    tocPanel.style.height = '';
    tocPanel.style.maxHeight = '';
    panes.forEach((pane) => pane.classList.remove(...ANIMATE_CLASSES));
  };

  const runSlide = (
    fromView: TocView,
    toView: TocView,
    direction: 'forward' | 'backward',
    seq: number,
    onFrame?: () => void,
    onDone?: () => void,
  ) => {
    const fromPane = paneByView.get(fromView);
    const toPane = paneByView.get(toView);
    applyViewState(toView);
    if (toView === 'tree') scrollToActiveChapterItem(true);

    if (reducedMotion() || !fromPane || !toPane) {
      clearTransitionState();
      onFrame?.();
      onDone?.();
      return;
    }

    fromPane.classList.add('is-leaving');
    toPane.classList.add(direction === 'forward' ? 'is-enter-from-right' : 'is-enter-from-left');
    void tocPanel.offsetHeight;

    requestAnimationFrame(() => {
      if (seq !== transitionSeq) return;
      fromPane.classList.add(direction === 'forward' ? 'is-leave-to-left' : 'is-leave-to-right');
      toPane.classList.remove('is-enter-from-right', 'is-enter-from-left');
      onFrame?.();
      phaseTimer = window.setTimeout(() => {
        if (seq !== transitionSeq) return;
        clearTransitionState();
        onDone?.();
      }, 240);
    });
  };

  const transitionToView = (
    nextView: TocView,
    options: { direction?: 'forward' | 'backward'; focusFirst?: boolean; preferSelectedModule?: boolean; restoreTrigger?: boolean } = {},
  ) => {
    const { direction = 'forward', focusFirst = false, preferSelectedModule = false, restoreTrigger = false } = options;
    if (view === nextView) {
      applyViewState(nextView);
      if (nextView === 'tree') scrollToActiveChapterItem(false);
      if (focusFirst) focusFirstInView(nextView, preferSelectedModule);
      return;
    }

    const seq = ++transitionSeq;
    clearTransitionState();
    const prevView = view;

    const afterSlide = () => {
      if (focusFirst) focusFirstInView(nextView, preferSelectedModule);
      else if (restoreTrigger && nextView === 'toc') {
        const trigger = lastJumpTrigger && document.contains(lastJumpTrigger) ? lastJumpTrigger : jumpToggle;
        trigger?.focus({ preventScroll: true });
      }
    };

    if (reducedMotion() || mobileMq?.matches) {
      applyViewState(nextView);
      if (nextView === 'tree') scrollToActiveChapterItem(true);
      afterSlide();
      return;
    }

    const startH = Math.round(tocPanel.getBoundingClientRect().height);
    tocPanel.style.transition = 'none';
    tocPanel.style.height = '';
    tocPanel.style.maxHeight = '';
    tocPanel.dataset.tocView = nextView;
    const endH = Math.round(tocPanel.getBoundingClientRect().height);
    tocPanel.dataset.tocView = prevView;
    const heightDiff = Math.abs(endH - startH);
    if (heightDiff > 2) {
      tocPanel.style.height = `${startH}px`;
      tocPanel.style.maxHeight = `${Math.max(startH, endH)}px`;
    }
    void tocPanel.offsetHeight;
    tocPanel.style.transition = '';

    runSlide(
      prevView,
      nextView,
      direction,
      seq,
      () => {
        if (heightDiff > 2) {
          tocPanel.style.height = `${endH}px`;
        }
        afterSlide();
      },
    );
  };

  const activateModule = (slug: string, focusFirst = false) => {
    const targetSlug = slug || modulePanels[0]?.dataset.tocModulePanel || '';
    if (!targetSlug) return;
    activeModuleSlug = targetSlug;
    modulePanels.forEach((panel) => {
      panel.hidden = panel.dataset.tocModulePanel !== targetSlug;
      if (!panel.hidden) {
        panel.querySelectorAll<HTMLDetailsElement>('[data-toc-chapter-group]').forEach((group) => {
          group.open = true;
        });
      }
    });
    moduleButtons.forEach((btn) => {
      btn.classList.toggle('is-current', btn.dataset.tocSelectModule === targetSlug);
    });
    transitionToView('tree', { direction: 'forward', focusFirst });
  };

  const openJumpPanel = (trigger?: HTMLElement | null, focusFirst = true) => {
    lastJumpTrigger = trigger ?? jumpToggle;
    if (mobileMq?.matches) {
      syncDrawer(true);
      transitionToView('modules', { direction: 'forward', focusFirst });
      return;
    }
    if (getComputedStyle(tocPanel).display === 'none' && navMobile) {
      navMobile.open = true;
      navMobile.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
      navMobile.querySelector<HTMLElement>('summary')?.focus();
      return;
    }
    transitionToView('modules', { direction: 'forward', focusFirst });
  };

  jumpToggle?.addEventListener('click', (event) => {
    const fromKeyboard = event.detail === 0;
    if (view === 'toc') {
      openJumpPanel(jumpToggle, fromKeyboard);
    } else {
      transitionToView('toc', { direction: 'backward', restoreTrigger: false });
      if (fromKeyboard) jumpToggle.focus({ preventScroll: true });
    }
  });

  articleJumpBtns.forEach((btn) => btn.addEventListener('click', (event) => openJumpPanel(btn, event.detail === 0)));

  document.addEventListener('keydown', (event) => {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.code !== 'KeyJ') return;
    const target = event.target as HTMLElement | null;
    if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;
    event.preventDefault();
    if (view !== 'toc' && (!mobileMq?.matches || drawerOpen)) {
      if (mobileMq?.matches) closeDrawer(true);
      else transitionToView('toc', { direction: 'backward', restoreTrigger: true });
    } else {
      openJumpPanel(document.activeElement instanceof HTMLElement ? document.activeElement : jumpToggle);
    }
  });

  moduleButtons.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const slug = btn.dataset.tocSelectModule;
      if (slug) activateModule(slug, event.detail === 0);
    });
  });

  backModulesBtn?.addEventListener('click', (event) => {
    transitionToView('modules', { direction: 'backward', focusFirst: event.detail === 0, preferSelectedModule: true });
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
    if (e.key !== 'Escape') return;
    if (drawerOpen) {
      e.preventDefault();
      closeDrawer(true);
      return;
    }
    if (view !== 'toc') {
      e.preventDefault();
      transitionToView('toc', { direction: 'backward', restoreTrigger: true });
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
