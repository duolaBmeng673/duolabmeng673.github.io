import { STORAGE_KEYS } from '../lib/storage-keys';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// 1. Stage Presets + Terminal + RSS Copy
function initHeroStage() {
  const stage = document.querySelector<HTMLElement>('[data-hero-stage]');
  if (!stage || stage.dataset.initialized === '1') return;
  stage.dataset.initialized = '1';

  const buttons = [...stage.querySelectorAll<HTMLButtonElement>('[data-preset-slug]')];
  const panels = [...stage.querySelectorAll<HTMLElement>('[data-preset-panel]')];
  const cmdNode = stage.querySelector<HTMLElement>('[data-terminal-cmd]');
  const moreLink = stage.querySelector<HTMLAnchorElement>('[data-stage-more]');
  const copyBtn = stage.querySelector<HTMLButtonElement>('[data-copy-rss]');

  let typingTimer = 0;
  let resetTimer = 0;

  const typeCommand = (text: string, animate: boolean) => {
    if (!cmdNode) return;
    window.clearTimeout(typingTimer);
    if (!animate || reducedMotion()) {
      cmdNode.textContent = text;
      return;
    }
    let idx = 0;
    cmdNode.textContent = '';
    const step = () => {
      idx += 1;
      cmdNode.textContent = text.slice(0, idx);
      if (idx < text.length) {
        typingTimer = window.setTimeout(step, 18);
      }
    };
    step();
  };

  const activatePreset = (slug: string, persist: boolean, animate: boolean) => {
    const matched = buttons.find((btn) => btn.dataset.presetSlug === slug) ?? buttons[0];
    if (!matched) return;
    const activeSlug = matched.dataset.presetSlug ?? 'all';

    for (const btn of buttons) {
      btn.setAttribute('aria-checked', String(btn.dataset.presetSlug === activeSlug));
    }
    for (const panel of panels) {
      panel.hidden = panel.dataset.presetPanel !== activeSlug;
    }

    if (moreLink && matched.dataset.moreHref && matched.dataset.moreLabel) {
      moreLink.href = matched.dataset.moreHref;
      moreLink.textContent = matched.dataset.moreLabel;
    }

    typeCommand(`notes ls --cat=${activeSlug} --limit=6`, animate);

    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEYS.preset, activeSlug);
      } catch {
        /* Storage is optional. */
      }
    }
    document.documentElement.dataset.preset = activeSlug;
    window.dispatchEvent(new CustomEvent('duolabmeng673:preset-change', { detail: { slug: activeSlug } }));
  };

  const initial = document.documentElement.dataset.preset || 'all';
  activatePreset(initial, false, false);

  for (const btn of buttons) {
    btn.addEventListener('click', () => {
      const slug = btn.dataset.presetSlug;
      if (slug) activatePreset(slug, true, true);
    });
  }

  copyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/rss.xml`);
    } catch {
      /* Clipboard permission fallback */
    }
    copyBtn.textContent = '✓ 已复制 RSS';
    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      copyBtn.textContent = '⧉ 复制 RSS';
    }, 1400);
  });
}

// 2. Danmaku Knowledge Tags Marquee (CSS transform animation + IntersectionObserver play/pause)
function initDanmaku() {
  const root = document.querySelector<HTMLElement>('[data-danmaku]');
  if (!root || root.dataset.initialized === '1') return;
  root.dataset.initialized = '1';
  if (reducedMotion()) return;

  if ('IntersectionObserver' in window) {
    let inView = false;
    const sync = () => root.classList.toggle('is-inview', inView && !document.hidden);
    const io = new IntersectionObserver(
      ([entry]) => {
        inView = Boolean(entry?.isIntersecting);
        sync();
      },
      { threshold: 0.01 },
    );
    io.observe(root);
    document.addEventListener('visibilitychange', sync);
  } else {
    root.classList.add('is-inview');
  }
}

// 3. CardSwap 3D Stack (native CSS transforms, pauses offscreen & when hidden)
function initCardSwap() {
  const root = document.querySelector<HTMLElement>('[data-card-swap]');
  if (!root || root.dataset.initialized === '1') return;
  root.dataset.initialized = '1';

  const slots = [...root.querySelectorAll<HTMLAnchorElement>('[data-swap-slot]')];
  const prevBtn = root.querySelector<HTMLButtonElement>('[data-swap-prev]');
  const nextBtn = root.querySelector<HTMLButtonElement>('[data-swap-next]');
  const countNode = root.querySelector<HTMLElement>('[data-swap-count]');
  if (!slots.length) return;

  let active = 0;
  let hovered = false;
  let inView = false;
  const total = slots.length;

  const layout = () => {
    slots.forEach((slot, idx) => {
      const order = (idx - active + total) % total;
      const zIndex = total - order;
      const x = order * 24;
      const y = -order * 18;
      const z = -order * 52;
      const scale = Math.max(0.82, 1 - order * 0.045);
      const opacity = order > 3 ? 0 : Math.max(0.45, 1 - order * 0.16);
      slot.style.zIndex = String(zIndex);
      slot.style.transform = `translate3d(${x}px, ${y}px, ${z}px) scale(${scale}) skewY(3deg)`;
      slot.style.opacity = String(opacity);
      slot.toggleAttribute('data-front', order === 0);
      slot.tabIndex = order === 0 ? 0 : -1;
    });
    if (countNode) countNode.textContent = `${active + 1} / ${total}`;
  };

  const go = (delta: number) => {
    active = (active + delta + total) % total;
    layout();
  };

  prevBtn?.addEventListener('click', () => go(-1));
  nextBtn?.addEventListener('click', () => go(1));

  slots.forEach((slot, idx) => {
    slot.addEventListener('click', (e) => {
      if (idx !== active) {
        e.preventDefault();
        active = idx;
        layout();
      }
    });
  });

  root.addEventListener('mouseenter', () => { hovered = true; });
  root.addEventListener('mouseleave', () => { hovered = false; });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inView = Boolean(entry?.isIntersecting);
    }, { threshold: 0.01 }).observe(root);
  } else {
    inView = true;
  }

  layout();
  if (!reducedMotion()) {
    window.setInterval(() => {
      if (inView && !hovered && !document.hidden) go(1);
    }, 3600);
  }
}

initHeroStage();
initDanmaku();
initCardSwap();
