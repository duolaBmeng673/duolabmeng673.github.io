const body = document.querySelector<HTMLElement>('[data-study-body]');
const tools = document.querySelector<HTMLElement>('[data-recall-tools]');
if (body && tools) {
  const nodes = [...body.childNodes];
  const entries: HTMLDetailsElement[] = [];
  const stack: { depth: number; content: HTMLElement }[] = [];
  let headingDepth = 1;
  let mode = 'read';
  const notify = () => document.dispatchEvent(new Event('study-mode-change'));
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
      details.addEventListener('toggle', notify);
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
    tools.querySelectorAll<HTMLElement>('[data-recall-actions], [data-recall-hint]').forEach((node) => { node.hidden = mode !== 'recall'; });
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
    notify();
  };
  buttons.forEach((button) => button.addEventListener('click', () => changeMode(button.dataset.studyMode ?? 'read')));
  tools.querySelectorAll<HTMLButtonElement>('[data-recall-all]').forEach((button) => button.addEventListener('click', () => {
    entries.forEach((entry) => { entry.open = button.dataset.recallAll === 'show'; });
    notify();
  }));
  const revealTarget = (hash: string) => {
    let id: string;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target || !body.contains(target)) return;
    let ancestor = target.parentElement;
    while (ancestor && ancestor !== body) {
      if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
      ancestor = ancestor.parentElement;
    }
    requestAnimationFrame(() => { target.scrollIntoView({ block: 'start' }); notify(); });
  };
  document.querySelectorAll<HTMLAnchorElement>('.article-toc a, .article-toc-mobile a').forEach((link) => link.addEventListener('click', () => revealTarget(link.hash)));
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
