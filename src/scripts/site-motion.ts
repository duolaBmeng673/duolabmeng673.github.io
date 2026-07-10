const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(pointer: fine)');

const root = document.documentElement;

function setupIntro() {
  if (!root.classList.contains('intro-pending')) return;

  const finishIntro = () => {
    root.classList.remove('intro-pending');

    try {
      sessionStorage.setItem('yyf-intro-seen', 'true');
    } catch {
      // Storage can be unavailable in privacy-restricted browsing contexts.
    }
  };

  if (reduceMotion.matches) {
    finishIntro();
    return;
  }

  window.setTimeout(finishIntro, 2700);
}

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

function setupHeroRefraction() {
  if (reduceMotion.matches || !finePointer.matches) return;

  const sculpture = document.querySelector<HTMLElement>('.hero-sculpture');
  if (!sculpture) return;

  let frame = 0;
  let x = 0.5;
  let y = 0.5;

  const updateRefraction = (event: PointerEvent) => {
    const rect = sculpture.getBoundingClientRect();
    x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));

    if (frame) return;

    frame = window.requestAnimationFrame(() => {
      sculpture.style.setProperty('--refraction-x', `${(x - 0.5).toFixed(3)}`);
      sculpture.style.setProperty('--refraction-y', `${(y - 0.5).toFixed(3)}`);
      sculpture.style.setProperty('--glint-x', `${(x * 100).toFixed(1)}%`);
      sculpture.style.setProperty('--glint-y', `${(y * 100).toFixed(1)}%`);
      frame = 0;
    });
  };

  sculpture.addEventListener('pointermove', updateRefraction, { passive: true });
  sculpture.addEventListener('pointerleave', () => {
    sculpture.style.setProperty('--refraction-x', '0');
    sculpture.style.setProperty('--refraction-y', '0');
    sculpture.style.setProperty('--glint-x', '50%');
    sculpture.style.setProperty('--glint-y', '40%');
  });
}

function setupReveal() {
  const revealItems = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));

  if (!revealItems.length) return;

  if (reduceMotion.matches || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
    return;
  }

  revealItems.forEach((item, index) => {
    const group = item.parentElement;
    const siblings = group
      ? Array.from(group.children).filter((child) => child.hasAttribute('data-reveal'))
      : [];
    const position = siblings.indexOf(item);

    if (position > 0) {
      item.style.setProperty('--reveal-delay', `${Math.min(position * 70, 210)}ms`);
    } else if (index === 0) {
      item.style.setProperty('--reveal-delay', '80ms');
    }
  });

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

  revealItems.forEach((item) => {
    const rect = item.getBoundingClientRect();

    if (rect.top < window.innerHeight * 0.94 && rect.bottom > 0) {
      item.classList.add('is-visible');
      return;
    }

    observer.observe(item);
  });
}

function setupHeader() {
  const header = document.querySelector<HTMLElement>('.site-header');
  if (!header) return;

  let frame = 0;

  const updateHeader = () => {
    if (frame) return;

    frame = window.requestAnimationFrame(() => {
      header.classList.toggle('is-scrolled', window.scrollY > 28);
      frame = 0;
    });
  };

  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });
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

setupIntro();
setupPointerGlow();
setupHeroRefraction();
setupReveal();
setupTilt();
setupHeader();
