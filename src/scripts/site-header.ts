const header = document.querySelector<HTMLElement>('.site-header');
if (header) {
  const root = document.documentElement;
  // Clamp elastic overscroll so a bounce at either end is not a direction change.
  const position = () => Math.max(0, Math.min(window.scrollY, Math.max(0, root.scrollHeight - window.innerHeight)));
  let last = position(), direction = 0, travel = 0, pending = false;
  const reveal = () => { delete root.dataset.headerHidden; };
  const pinned = () => header.contains(document.activeElement) || Boolean(header.querySelector('details[open]'));
  const update = () => {
    pending = false;
    const y = position(), delta = y - last;
    last = y;
    if (y <= header.getBoundingClientRect().height || pinned()) {
      reveal(); direction = 0; travel = 0; return;
    }
    if (!delta) return;
    const next = Math.sign(delta);
    travel = next === direction ? travel + Math.abs(delta) : Math.abs(delta);
    direction = next;
    // Small movements should not make the header flicker while reading.
    if (travel < 12) return;
    if (direction > 0) root.dataset.headerHidden = 'true';
    else reveal();
    travel = 0;
  };
  window.addEventListener('scroll', () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(update);
  }, { passive: true });
  header.addEventListener('focusin', reveal);
  header.addEventListener('toggle', () => { if (pinned()) reveal(); }, true);
  window.addEventListener('pageshow', () => { reveal(); last = position(); direction = 0; travel = 0; });
}
export {};
