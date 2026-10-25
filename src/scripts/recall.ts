type Question = { id: string; slug: string; depth: 2 | 3 };
const data = document.querySelector('#study-questions');
const body = document.querySelector<HTMLElement>('[data-study-body]');
const tools = document.querySelector<HTMLElement>('[data-recall-tools]');
if (data && body && tools) {
  const questions: Question[] = JSON.parse(data.textContent ?? '[]');
  const originalHeadings = [...body.children].filter((node): node is HTMLElement => node instanceof HTMLElement && /^H[1-6]$/.test(node.tagName));
  const contextIds = new Set<string>();
  for (const question of questions) {
    let depth: number = question.depth;
    const index = originalHeadings.findIndex((heading) => heading.id === question.slug);
    for (let i = index - 1; i >= 0; i--) {
      const heading = originalHeadings[i];
      const level = Number(heading.tagName.slice(1));
      if (level < depth) { contextIds.add(heading.id); depth = level; }
      if (level === 1) break;
    }
  }
  const entries: { section: HTMLElement; answer: HTMLElement; button: HTMLButtonElement; slug: string }[] = [];
  const setAnswer = (answer: HTMLElement, button: HTMLButtonElement, visible: boolean) => {
    answer.hidden = !visible;
    button.setAttribute('aria-expanded', String(visible));
    button.textContent = visible ? '收起答案' : '查看答案';
  };
  // Reparent rendered nodes, so both modes use the very same answer and Markdown pipeline.
  for (const question of questions) {
    const heading = document.getElementById(question.slug);
    if (!heading || heading.parentElement !== body || heading.tagName !== `H${question.depth}`) continue;
    const section = document.createElement('section');
    section.className = 'recall-question';
    const answer = document.createElement('div');
    answer.className = 'recall-answer'; answer.id = `answer-${question.id}`;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'recall-toggle'; button.hidden = true;
    button.setAttribute('aria-controls', answer.id); button.setAttribute('aria-expanded', 'true');
    button.textContent = '收起答案';
    body.insertBefore(section, heading);
    let sibling = heading.nextSibling;
    section.append(heading, button, answer);
    while (sibling && !(sibling instanceof HTMLElement && /^H[1-3]$/.test(sibling.tagName) && Number(sibling.tagName.slice(1)) <= question.depth)) {
      const next = sibling.nextSibling; answer.append(sibling); sibling = next;
    }
    button.addEventListener('click', () => setAnswer(answer, button, answer.hidden));
    entries.push({ section, answer, button, slug: question.slug });
  }
  let mode = 'read';
  const buttons = [...tools.querySelectorAll<HTMLButtonElement>('[data-study-mode]')];
  const otherBlocks = [...body.children].filter((node): node is HTMLElement => node instanceof HTMLElement && !entries.some((entry) => entry.section === node));
  const tocLinks = [...document.querySelectorAll<HTMLAnchorElement>('.article-toc a, .article-toc-mobile a')];
  const changeMode = (next: string) => {
    mode = next;
    body.classList.toggle('is-recalling', mode === 'recall');
    for (const entry of entries) { entry.button.hidden = mode !== 'recall'; setAnswer(entry.answer, entry.button, mode === 'read'); }
    for (const node of otherBlocks) node.hidden = mode === 'recall' && !contextIds.has(node.id);
    for (const link of tocLinks) {
      const slug = decodeURIComponent(link.hash.slice(1));
      if (link.parentElement) link.parentElement.hidden = mode === 'recall' && !contextIds.has(slug) && !entries.some((entry) => entry.slug === slug);
    }
    tools.querySelectorAll<HTMLElement>('[data-recall-actions], [data-recall-hint]').forEach((node) => { node.hidden = mode !== 'recall'; });
    buttons.forEach((button) => {
      const active = button.dataset.studyMode === mode;
      button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
    });
    document.dispatchEvent(new Event('study-mode-change'));
  };
  buttons.forEach((button) => button.addEventListener('click', () => changeMode(button.dataset.studyMode ?? 'read')));
  tools.querySelectorAll<HTMLButtonElement>('[data-recall-all]').forEach((button) => button.addEventListener('click', () => {
    entries.forEach((entry) => setAnswer(entry.answer, entry.button, button.dataset.recallAll === 'show'));
  }));
  window.addEventListener('hashchange', () => {
    if (mode !== 'recall') return;
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    const entry = entries.find((entry) => target && entry.answer.contains(target));
    if (entry) setAnswer(entry.answer, entry.button, true);
    else if (target && otherBlocks.some((node) => node === target || node.contains(target))) changeMode('read');
  });
  if (entries.length) tools.hidden = false;
}
