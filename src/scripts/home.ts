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

  const targetSpeeds = [24, 18, 30];
  root.querySelectorAll<HTMLElement>('.ktag-lane').forEach((lane, idx) => {
    const seg = lane.querySelector<HTMLElement>('.ktag-segment');
    const segW = seg?.offsetWidth || 0;
    const speed = targetSpeeds[idx % targetSpeeds.length];
    if (segW > 0) {
      const dur = Math.max(90, Math.round(segW / speed));
      lane.style.setProperty('--lane-dur', `${dur}s`);
    }
  });

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

// 3. CardSwap 3D Stack (3-phase pure CSS transform/opacity transitions, pauses offscreen & when hidden)
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
  let animating = false;
  let phaseTimers: number[] = [];
  const total = slots.length;

  const slotProps = (order: number) => {
    const zIndex = total - order;
    const x = order * 24;
    const y = -order * 18;
    const z = -order * 52;
    const scale = Math.max(0.82, 1 - order * 0.045);
    const opacity = order > 3 ? 0 : Math.max(0.45, 1 - order * 0.16);
    return {
      zIndex,
      transform: `translate3d(${x}px, ${y}px, ${z}px) scale(${scale}) skewY(3deg)`,
      opacity,
    };
  };

  const applySlot = (slot: HTMLAnchorElement, props: { zIndex: number; transform: string; opacity: number }, isFront: boolean) => {
    slot.style.zIndex = String(props.zIndex);
    slot.style.transform = props.transform;
    slot.style.opacity = String(props.opacity);
    slot.toggleAttribute('data-front', isFront);
    slot.tabIndex = isFront ? 0 : -1;
  };

  const clearPhaseClasses = () => {
    phaseTimers.forEach((id) => window.clearTimeout(id));
    phaseTimers = [];
    slots.forEach((s) => s.classList.remove('is-dropping', 'is-settling', 'is-instant'));
    animating = false;
  };

  const layout = () => {
    slots.forEach((slot, idx) => {
      const order = (idx - active + total) % total;
      applySlot(slot, slotProps(order), order === 0);
    });
    if (countNode) countNode.textContent = `${active + 1} / ${total}`;
  };

  const go = (delta: number) => {
    if (total <= 1) return;
    if (reducedMotion() || Math.abs(delta) !== 1) {
      clearPhaseClasses();
      active = (active + delta + total) % total;
      layout();
      return;
    }

    if (animating) {
      clearPhaseClasses();
      layout();
    }
    animating = true;

    const outgoingIdx = active;
    const nextActive = (active + delta + total) % total;
    const outgoing = slots[outgoingIdx];

    if (delta === 1) {
      // Phase 1 (0..280ms): front card drops down & fades
      outgoing.classList.add('is-dropping');
      outgoing.style.zIndex = String(total + 1);
      outgoing.style.transform = 'translate3d(0, 128px, 24px) scale(0.95) skewY(3deg)';
      outgoing.style.opacity = '0.08';

      phaseTimers.push(
        window.setTimeout(() => {
          // Phase 2 (280..480ms): snap outgoing above back stack while remaining step forward
          outgoing.classList.remove('is-dropping');
          outgoing.classList.add('is-instant');
          const backProps = slotProps(total - 1);
          outgoing.style.zIndex = '1';
          outgoing.style.transform = `translate3d(${(total - 1) * 24 + 12}px, ${-(total - 1) * 18 - 34}px, ${-(total - 1) * 52}px) scale(${Math.max(0.78, 1 - (total - 1) * 0.045)}) skewY(3deg)`;
          outgoing.style.opacity = '0';
          void outgoing.offsetWidth;

          active = nextActive;
          if (countNode) countNode.textContent = `${active + 1} / ${total}`;
          slots.forEach((slot, idx) => {
            if (idx === outgoingIdx) {
              slot.toggleAttribute('data-front', false);
              slot.tabIndex = -1;
              return;
            }
            const order = (idx - active + total) % total;
            applySlot(slot, slotProps(order), order === 0);
          });

          phaseTimers.push(
            window.setTimeout(() => {
              // Phase 3 (460..780ms): settle outgoing card into final back stack slot
              outgoing.classList.remove('is-instant');
              outgoing.classList.add('is-settling');
              applySlot(outgoing, backProps, false);

              phaseTimers.push(
                window.setTimeout(() => {
                  outgoing.classList.remove('is-settling');
                  animating = false;
                }, 340),
              );
            }, 180),
          );
        }, 280),
      );
    } else {
      // Prev (-1): bring last card up from back, glide others back, drop into front (~0.78s)
      const incomingIdx = nextActive;
      const incoming = slots[incomingIdx];

      // Phase 1: lift incoming above & forward while existing cards step back
      incoming.classList.add('is-dropping');
      incoming.style.zIndex = String(total + 1);
      incoming.style.transform = 'translate3d(-14px, -112px, 24px) scale(0.94) skewY(3deg)';
      incoming.style.opacity = '0.35';

      active = nextActive;
      if (countNode) countNode.textContent = `${active + 1} / ${total}`;
      slots.forEach((slot, idx) => {
        if (idx === incomingIdx) return;
        const order = (idx - active + total) % total;
        applySlot(slot, slotProps(order), false);
      });

      phaseTimers.push(
        window.setTimeout(() => {
          // Phase 2-3: settle incoming softly into front slot
          incoming.classList.remove('is-dropping');
          incoming.classList.add('is-settling');
          applySlot(incoming, slotProps(0), true);

          phaseTimers.push(
            window.setTimeout(() => {
              incoming.classList.remove('is-settling');
              animating = false;
            }, 380),
          );
        }, 260),
      );
    }
  };

  prevBtn?.addEventListener('click', () => go(-1));
  nextBtn?.addEventListener('click', () => go(1));

  slots.forEach((slot, idx) => {
    slot.addEventListener('click', (e) => {
      if (idx !== active) {
        e.preventDefault();
        clearPhaseClasses();
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
      if (inView && !hovered && !document.hidden && !animating) go(1);
    }, 3600);
  }
}

initHeroStage();
initDanmaku();
initCardSwap();
