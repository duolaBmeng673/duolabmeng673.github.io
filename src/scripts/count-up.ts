const els = [...document.querySelectorAll<HTMLElement>('[data-countup]')];

if (els.length > 0) {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const animate = (el: HTMLElement) => {
    if (el.dataset.countupDone === '1') return;
    el.dataset.countupDone = '1';

    const target = el.querySelector<HTMLElement>('strong') ?? el;
    const to = Number(el.dataset.countup);
    if (!Number.isFinite(to)) return;
    target.textContent = String(to);
    if (reduceMotion) return;

    const duration = Math.min(450, Math.max(120, Number(el.dataset.countupDuration ?? 360)));
    el.classList.add('is-entering');
    window.setTimeout(() => el.classList.remove('is-entering'), duration);
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            io.unobserve(entry.target);
            animate(entry.target as HTMLElement);
          }
        }
      },
      { threshold: 0.1 },
    );
    for (const el of els) io.observe(el);
  } else {
    for (const el of els) animate(el);
  }
}

export {};
