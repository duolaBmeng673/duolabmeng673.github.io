export function bindStickyAutoHide({
  bar,
  sentinel,
  desktopMedia = '(min-width: 1024px)',
}: {
  bar: HTMLElement | null;
  sentinel?: HTMLElement | null;
  desktopMedia?: string;
}) {
  if (!bar || typeof document === 'undefined' || !document.documentElement || typeof requestAnimationFrame !== 'function') {
    return { reveal: () => {} };
  }
  const root = document.documentElement;
  const syncBarHeight = () => {
    const h = bar.getBoundingClientRect?.().height;
    if (typeof h === 'number' && h > 0) root.style?.setProperty('--archive-tools-h', `${h}px`);
  };
  syncBarHeight();
  if (typeof ResizeObserver === 'function') new ResizeObserver(syncBarHeight).observe(bar);
  const mediaQuery = window.matchMedia?.(desktopMedia);
  const isDesktop = () => mediaQuery?.matches ?? true;
  const position = () => Math.max(0, Math.min(window.scrollY, Math.max(0, root.scrollHeight - window.innerHeight)));
  const stickyTop = () => Number.parseFloat(getComputedStyle?.(bar).top ?? '') || 70;
  const isStuck = () => {
    if (!isDesktop()) return false;
    if (sentinel) return sentinel.getBoundingClientRect().top <= stickyTop() + 2;
    return window.scrollY > 120;
  };
  let last = position();
  let direction = 0;
  let travel = 0;
  let pending = false;
  const reveal = () => {
    delete bar.dataset.dockHidden;
  };
  const syncStuckClass = (stuck: boolean) => {
    bar.classList?.toggle('is-stuck', stuck);
  };
  const pinned = () => bar.contains(document.activeElement);
  const update = () => {
    pending = false;
    const y = position();
    const delta = y - last;
    last = y;
    const stuck = isStuck();
    syncStuckClass(stuck);
    if (!stuck || pinned()) {
      reveal();
      direction = 0;
      travel = 0;
      return;
    }
    if (!delta) return;
    const next = Math.sign(delta);
    travel = next === direction ? travel + Math.abs(delta) : Math.abs(delta);
    direction = next;
    if (travel < 12) return;
    if (direction > 0) bar.dataset.dockHidden = 'true';
    else reveal();
    travel = 0;
  };
  window.addEventListener('scroll', () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(update);
  }, { passive: true });
  bar.addEventListener('focusin', reveal);
  mediaQuery?.addEventListener?.('change', () => {
    const stuck = isStuck();
    syncStuckClass(stuck);
    if (!stuck) {
      reveal();
      direction = 0;
      travel = 0;
    }
  });
  window.addEventListener('pageshow', () => {
    reveal();
    last = position();
    direction = 0;
    travel = 0;
    syncStuckClass(isStuck());
  });
  syncStuckClass(isStuck());
  return { reveal };
}
