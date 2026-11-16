const header = document.querySelector<HTMLElement>('.site-header');
if (header) {
  const root = document.documentElement;
  const menuBtn = header.querySelector?.('[data-mobile-nav-toggle]') as HTMLButtonElement | null | undefined;
  const menuPanel = header.querySelector?.('[data-mobile-nav-menu]') as HTMLElement | null | undefined;
  const desktopQuery = window.matchMedia?.('(min-width: 1024px) and (hover: hover) and (pointer: fine)');
  const isDesktop = () => Boolean(desktopQuery?.matches);
  const scrolledAt = (y: number) => (isDesktop() ? y >= 8 : y > 40);
  let menuOpen = false;

  const setMenuOpen = (next: boolean) => {
    menuOpen = next;
    if (menuPanel) menuPanel.hidden = !next;
    menuBtn?.setAttribute('aria-expanded', String(next));
    if (next) delete root.dataset.headerHidden;
  };

  menuBtn?.addEventListener('click', (event) => {
    event.stopPropagation();
    setMenuOpen(!menuOpen);
  });

  if (menuPanel) {
    document.addEventListener?.('click', (event) => {
      if (!menuOpen) return;
      const target = event.target as Node | null;
      if (target && !header.contains(target)) setMenuOpen(false);
    });
    document.addEventListener?.('keydown', (event) => {
      if (event.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
        menuBtn?.focus();
      }
    });
  }

  // Clamp elastic overscroll so a bounce at either end is not a direction change.
  const position = () => Math.max(0, Math.min(window.scrollY, Math.max(0, root.scrollHeight - window.innerHeight)));
  let last = position(), direction = 0, travel = 0, pending = false;
  const reveal = () => { delete root.dataset.headerHidden; };
  const pinned = () =>
    menuOpen || header.contains(document.activeElement) || Boolean(header.querySelector('details[open]'));
  const update = () => {
    pending = false;
    const y = position(), delta = y - last;
    last = y;
    header.classList?.toggle('is-scrolled', scrolledAt(y));
    if (isDesktop() || y <= header.getBoundingClientRect().height || pinned()) {
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
  desktopQuery?.addEventListener?.('change', () => {
    header.classList?.toggle('is-scrolled', scrolledAt(position()));
    if (isDesktop()) {
      reveal(); direction = 0; travel = 0;
    }
  });
  window.addEventListener('pageshow', () => {
    setMenuOpen(false);
    reveal();
    last = position();
    direction = 0;
    travel = 0;
    header.classList?.toggle('is-scrolled', scrolledAt(last));
  });
}
export {};
