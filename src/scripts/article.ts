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
document.querySelectorAll<HTMLImageElement>('.article-body img').forEach((image) => {
  const src = image.getAttribute('src');
  if (!src?.endsWith('.svg') || image.closest('a')) return;
  const link = document.createElement('a');
  link.href = src; link.target = '_blank'; link.rel = 'noopener';
  link.className = 'article-svg-link';
  link.title = '在新标签页查看 SVG 原图';
  image.replaceWith(link); link.append(image);
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
const updateCurrent = () => {
  const visible = headings.filter((heading) => heading.getClientRects().length > 0);
  const current = [...visible].reverse().find((heading) => heading.getBoundingClientRect().top <= 150) ?? visible[0];
  links.forEach((link) => {
    const active = current?.id === decodeURIComponent(link.hash.slice(1));
    link.classList.toggle('is-current', active);
    if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
  });
};
const scrollToHeadingLink = (link: HTMLAnchorElement, event: MouseEvent) => {
  if (!link.hash) return;
  const id = decodeURIComponent(link.hash.slice(1));
  const target = document.getElementById(id);
  if (!target) return;
  event.preventDefault();
  revealInsideFold(target);
  target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  if (typeof history !== 'undefined') {
    history.replaceState(null, '', `${location.pathname}${location.search}${link.hash}`);
  }
  updateCurrent();
};
links.forEach((link) => link.addEventListener('click', (event) => scrollToHeadingLink(link, event)));
let framePending = false;
document.addEventListener('study-mode-change', updateCurrent);
if (headings.length) {
  window.addEventListener('scroll', () => {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(() => { updateCurrent(); framePending = false; });
  }, { passive: true });
  updateCurrent();
}
document.querySelectorAll<HTMLAnchorElement>('.article-toc-mobile a').forEach((link) => link.addEventListener('click', (event) => {
  scrollToHeadingLink(link, event);
  const details = link.closest('details'); if (details) details.open = false;
}));

const tocPanel = document.querySelector<HTMLElement>('[data-toc-panel]');
if (tocPanel) {
  const tocHeading = tocPanel.querySelector<HTMLElement>('[data-toc-heading]');
  const jumpToggle = tocPanel.querySelector<HTMLButtonElement>('[data-toc-jump-toggle]');
  const panes = [...tocPanel.querySelectorAll<HTMLElement>('[data-toc-pane]')];
  const modulePanels = [...tocPanel.querySelectorAll<HTMLElement>('[data-toc-module-panel]')];
  const openBtn = document.querySelector<HTMLButtonElement>('[data-toc-drawer-open]');
  const closeBtn = tocPanel.querySelector<HTMLButtonElement>('[data-toc-drawer-close]');
  const backdrop = document.querySelector<HTMLElement>('[data-toc-backdrop]');
  const mobileMq = window.matchMedia?.('(max-width: 639px)');
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
        activeItem.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
      });
    } else {
      pane.scrollTop = 0;
    }
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

  jumpToggle?.addEventListener('click', () => {
    setView(view === 'toc' ? 'modules' : 'toc');
  });

  tocPanel.querySelectorAll<HTMLButtonElement>('[data-toc-select-module]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const slug = btn.dataset.tocSelectModule;
      if (!slug) return;
      modulePanels.forEach((panel) => {
        panel.hidden = panel.dataset.tocModulePanel !== slug;
      });
      const label = btn.querySelector('strong')?.textContent?.trim() || '笔记直达';
      setView('chapters', label);
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
