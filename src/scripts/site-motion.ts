const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(pointer: fine)');

const root = document.documentElement;

function setupPointerGlow() {
  if (reduceMotion.matches || !finePointer.matches) return;

  let pointerX = window.innerWidth / 2;
  let pointerY = window.innerHeight / 2;
  let frame = 0;

  const updatePointer = (event: PointerEvent) => {
    pointerX = event.clientX;
    pointerY = event.clientY;

    if (frame) return;

    frame = window.requestAnimationFrame(() => {
      root.style.setProperty('--pointer-x', `${pointerX}px`);
      root.style.setProperty('--pointer-y', `${pointerY}px`);
      frame = 0;
    });
  };

  window.addEventListener('pointermove', updatePointer, { passive: true });
}

function setupReveal() {
  const revealItems = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));

  if (!revealItems.length) return;

  if (reduceMotion.matches || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.16,
      rootMargin: '0px 0px -8% 0px',
    },
  );

  revealItems.forEach((item) => observer.observe(item));
}

function setupTilt() {
  if (reduceMotion.matches || !finePointer.matches) return;

  const tiltItems = Array.from(document.querySelectorAll<HTMLElement>('[data-tilt]'));

  tiltItems.forEach((item) => {
    item.addEventListener('pointermove', (event) => {
      const rect = item.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;

      item.style.setProperty('--tilt-x', `${(-y * 3).toFixed(2)}deg`);
      item.style.setProperty('--tilt-y', `${(x * 3.5).toFixed(2)}deg`);
      item.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
      item.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
    });

    item.addEventListener('pointerleave', () => {
      item.style.setProperty('--tilt-x', '0deg');
      item.style.setProperty('--tilt-y', '0deg');
      item.style.removeProperty('--spot-x');
      item.style.removeProperty('--spot-y');
    });
  });
}

setupPointerGlow();
setupReveal();
setupTilt();
