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
