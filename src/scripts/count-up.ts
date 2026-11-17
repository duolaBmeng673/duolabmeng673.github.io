const els = [...document.querySelectorAll<HTMLElement>('[data-countup]')];

if (els.length > 0) {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  const animate = (el: HTMLElement) => {
    if (el.dataset.countupDone === '1') return;
    el.dataset.countupDone = '1';

    const target = el.querySelector<HTMLElement>('strong') ?? el;
    const to = Number(el.dataset.countup);
    const from = Number(el.dataset.countupFrom ?? 0);
    const duration = Number(el.dataset.countupDuration ?? 900);
    if (reduceMotion || !Number.isFinite(to) || to <= from || duration <= 0) {
      target.textContent = String(to);
      return;
    }

    let startTime = 0;
    target.textContent = String(from);

    const tick = (now: number) => {
      if (!startTime) startTime = now;
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      target.textContent = String(Math.round(from + (to - from) * eased));
      if (progress < 1 && !document.hidden) {
        window.requestAnimationFrame(tick);
      } else {
        target.textContent = String(to);
      }
    };

    window.requestAnimationFrame(tick);
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
