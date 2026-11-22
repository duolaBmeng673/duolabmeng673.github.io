const body = document.querySelector<HTMLElement>('[data-study-body]');
const tools = document.querySelector<HTMLElement>('[data-recall-tools]');
if (body && tools) {
  const nodes = [...body.childNodes];
  const entries: HTMLDetailsElement[] = [];
  const stack: { depth: number; content: HTMLElement }[] = [];
  let headingDepth = 1;
  let mode = 'read';
  const showAllBtn = tools.querySelector<HTMLButtonElement>('[data-recall-all="show"]');
  const hideAllBtn = tools.querySelector<HTMLButtonElement>('[data-recall-all="hide"]');
  const notify = (reason: 'mode' | 'toggle' = 'toggle') =>
    document.dispatchEvent(new CustomEvent('study-mode-change', { detail: { reason } }));
  const syncActions = () => {
    const active = mode === 'recall';
    const allOpen = active && entries.length > 0 && entries.every((entry) => entry.open);
    const allClosed = active && entries.length > 0 && entries.every((entry) => !entry.open);
    if (showAllBtn) {
      showAllBtn.disabled = allOpen;
      showAllBtn.setAttribute('aria-disabled', String(allOpen));
    }
    if (hideAllBtn) {
      hideAllBtn.disabled = allClosed;
      hideAllBtn.setAttribute('aria-disabled', String(allClosed));
    }
  };
  // Build a hierarchy from rendered nodes. Source Markdown, images, and code stay intact.
  for (const node of nodes) {
    const heading = node instanceof HTMLElement && /^H[1-6]$/.test(node.tagName);
    const label = node instanceof HTMLElement && node.tagName === 'P'
      && node.children.length === 1 && node.firstElementChild?.tagName === 'STRONG'
      && node.textContent?.trim() === node.firstElementChild.textContent?.trim();
    if (heading) headingDepth = Number(node.tagName.slice(1));
    const depth = heading ? headingDepth : label ? headingDepth + 1 : 0;
    if (depth > 1) {
      while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
      const details = document.createElement('details');
      details.className = 'study-fold'; details.open = true;
      const summary = document.createElement('summary');
      if (label) node.classList.add('study-fold-label');
      summary.append(node);
      const content = document.createElement('div'); content.className = 'study-fold-content';
      details.append(summary, content);
      (stack.at(-1)?.content ?? body).append(details);
      details.addEventListener('toggle', () => {
        syncActions();
        notify();
      });
      entries.push(details); stack.push({ depth, content });
    } else {
      if (heading) stack.length = 0;
      (stack.at(-1)?.content ?? body).append(node);
    }
  }
  const buttons = [...tools.querySelectorAll<HTMLButtonElement>('[data-study-mode]')];
  const changeMode = (next: string) => {
    mode = next;
    body.classList.toggle('is-recalling', mode === 'recall');
    entries.forEach((entry) => { entry.open = mode === 'read'; });
    tools.querySelectorAll<HTMLElement>('[data-recall-actions]').forEach((node) => { node.hidden = mode !== 'recall'; });
    buttons.forEach((button) => {
      const active = button.dataset.studyMode === mode;
      button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
    });
    entries.forEach((entry) => {
      const summary = entry.querySelector('summary');
      if (mode === 'read') {
        summary?.setAttribute('tabindex', '-1');
        summary?.setAttribute('aria-disabled', 'true');
      } else {
        summary?.removeAttribute('tabindex');
        summary?.removeAttribute('aria-disabled');
      }
    });
    syncActions();
    notify('mode');
  };
  buttons.forEach((button) => button.addEventListener('click', () => changeMode(button.dataset.studyMode ?? 'read')));
  tools.querySelectorAll<HTMLButtonElement>('[data-recall-all]').forEach((button) => button.addEventListener('click', () => {
    const show = button.dataset.recallAll === 'show';
    const wasFocused = document.activeElement === button;
    entries.forEach((entry) => { entry.open = show; });
    syncActions();
    if (wasFocused && button.disabled) {
      const counterpart = show ? hideAllBtn : showAllBtn;
      if (counterpart && !counterpart.disabled) counterpart.focus({ preventScroll: true });
    }
    notify();
  }));
  const revealTarget = (hash: string, shouldScroll = true) => {
    let id: string;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target || !body.contains(target)) return;
    let changed = false;
    let ancestor = target.parentElement;
    while (ancestor && ancestor !== body) {
      if (ancestor instanceof HTMLDetailsElement && !ancestor.open) {
        ancestor.open = true;
        changed = true;
      }
      ancestor = ancestor.parentElement;
    }
    if (changed) syncActions();
    if (!shouldScroll) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      if (changed) notify('toggle');
    });
  };
  document.querySelectorAll<HTMLAnchorElement>('.article-toc a, .article-toc-mobile a').forEach((link) => link.addEventListener('click', () => revealTarget(link.hash, false)));
  window.addEventListener('hashchange', () => revealTarget(location.hash));
  // Read mode is complete and expanded. The fold controls are only active in recall mode.
  entries.forEach((entry) => entry.querySelector('summary')?.addEventListener('click', (event) => {
    if (mode === 'read') event.preventDefault();
  }));
  if (entries.length) tools.hidden = false;
  changeMode('read');
  if (location.hash) revealTarget(location.hash);
}
export {};
