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
  language.textContent = pre.dataset.language ?? [...code.classList].find((name) => name.startsWith('language-'))?.slice(9) ?? 'Code';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'code-copy';
  button.textContent = 'Copy';
  const feedback = document.createElement('span');
  feedback.className = 'code-copy-feedback';
  feedback.setAttribute('aria-live', 'polite');
  let reset: ReturnType<typeof setTimeout> | undefined;
  button.addEventListener('click', async () => {
    clearTimeout(reset);
    if (await copyText(code.textContent ?? '')) {
      button.textContent = '已复制';
      feedback.textContent = '代码已复制';
      reset = setTimeout(() => { button.textContent = 'Copy'; feedback.textContent = ''; }, 2000);
    } else {
      button.textContent = 'Copy';
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
const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-toc-link]')];
const headings = links.map((link) => document.getElementById(decodeURIComponent(link.hash.slice(1)))).filter((heading): heading is HTMLElement => Boolean(heading));
const updateCurrent = () => {
  const current = [...headings].reverse().find((heading) => heading.getBoundingClientRect().top <= 150) ?? headings[0];
  links.forEach((link) => {
    const active = current?.id === decodeURIComponent(link.hash.slice(1));
    link.classList.toggle('is-current', active);
    if (active) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
  });
};
let framePending = false;
if (headings.length) {
  window.addEventListener('scroll', () => {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(() => { updateCurrent(); framePending = false; });
  }, { passive: true });
  updateCurrent();
}
document.querySelectorAll<HTMLAnchorElement>('.article-toc-mobile a').forEach((link) => link.addEventListener('click', () => {
  const details = link.closest('details'); if (details) details.open = false;
}));
