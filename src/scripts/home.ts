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
    const PRESET_TRAIL_RGB: Record<string, string> = {
      all: '37 99 235',
      research: '139 92 246',
      cs: '225 65 107',
      '837': '13 148 136',
    };
    document.documentElement.dataset.preset = activeSlug;
    document.documentElement.style.setProperty('--trail-rgb', PRESET_TRAIL_RGB[activeSlug] ?? PRESET_TRAIL_RGB.all);
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

// 2. Random Pooled Danmaku (5 lanes, +-6px Y jitter, bounded speed ratio <=1.6x, max 8 onscreen, pure CSS transform)
function initDanmaku() {
  const root = document.querySelector<HTMLElement>('[data-danmaku]');
  if (!root || root.dataset.initialized === '1') return;
  root.dataset.initialized = '1';
  if (reducedMotion()) return;

  const stage = root.querySelector<HTMLElement>('[data-danmaku-stage]');
  const pool = root.querySelector<HTMLElement>('[data-danmaku-pool]');
  const lanes = [...root.querySelectorAll<HTMLElement>('.ktag-lane')];
  const sourceTags = pool ? [...pool.querySelectorAll<HTMLAnchorElement>('a[data-knowledge-label]')] : [];
  if (!stage || !lanes.length || !sourceTags.length) return;

  // Measure natural pill widths once before switching into stage-only live mode.
  const tagSpecs = sourceTags.map((el) => ({
    href: el.getAttribute('href') || '#',
    title: el.getAttribute('title') || '',
    label: el.dataset.knowledgeLabel || el.textContent?.trim() || '',
    category: el.dataset.category || '',
    swatchBg: (el.querySelector<HTMLElement>('.ktag-swatch')?.style.background) || 'var(--tm)',
    width: Math.max(48, Math.ceil(el.getBoundingClientRect().width) || (el.textContent?.trim().length ?? 4) * 14 + 34),
  }));

  root.classList.add('is-danmaku-live');

  const MAX_ONSCREEN = 8;
  const MIN_SPEED = 42;
  const MAX_SPEED = 64; // 64 / 42 = 1.524x <= 1.6x
  const MIN_GAP_PX = 36;
  const laneCount = lanes.length;

  interface LaneReservation {
    launchSimMs: number;
    width: number;
    speed: number;
    exitSimMs: number;
  }

  const lastByLane: Array<LaneReservation | null> = Array.from({ length: laneCount }, () => null);
  const deck = tagSpecs.map((_, idx) => idx);
  let deckPos = deck.length;
  const nextSpec = () => {
    if (deckPos >= deck.length) {
      for (let i = deck.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      deckPos = 0;
    }
    return tagSpecs[deck[deckPos++]];
  };

  let inView = false;
  let hoveredOrFocused = false;
  let running = false;
  let simAccumMs = 0;
  let runStartedAt = 0;
  let timerId = 0;
  let activeCount = 0;
  let lastLane = -1;

  const getSimNow = () => (running ? simAccumMs + (performance.now() - runStartedAt) : simAccumMs);

  const canPlay = () => inView && !document.hidden && !hoveredOrFocused;

  const syncPlayState = () => {
    const shouldRun = canPlay();
    root.classList.toggle('is-inview', inView && !document.hidden);
    root.classList.toggle('is-paused', hoveredOrFocused);
    if (shouldRun === running) return;
    if (shouldRun) {
      runStartedAt = performance.now();
      running = true;
      scheduleTick(120);
    } else {
      simAccumMs += performance.now() - runStartedAt;
      running = false;
      if (timerId) {
        window.clearTimeout(timerId);
        timerId = 0;
      }
    }
  };

  const earliestForLane = (laneIdx: number, speed: number, stageW: number) => {
    const prev = lastByLane[laneIdx];
    if (!prev) return getSimNow();
    const enterReady = prev.launchSimMs + ((prev.width + MIN_GAP_PX) / prev.speed) * 1000;
    const clearCatchup = prev.exitSimMs - (Math.max(0, stageW + 16 - MIN_GAP_PX) / speed) * 1000;
    return Math.max(enterReady, clearCatchup);
  };

  const spawnOne = (initialProgress = 0): boolean => {
    if (activeCount >= MAX_ONSCREEN) return false;
    const stageW = Math.max(260, stage.clientWidth || root.clientWidth || 640);
    const speed = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
    const simNow = getSimNow();

    const candidateLanes = lanes.map((_, idx) => idx);
    for (let i = candidateLanes.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidateLanes[i], candidateLanes[j]] = [candidateLanes[j], candidateLanes[i]];
    }
    candidateLanes.sort((a, b) => (a === lastLane ? 1 : b === lastLane ? -1 : 0));

    let chosenLane = -1;
    if (initialProgress > 0) {
      for (const laneIdx of candidateLanes) {
        if (!lastByLane[laneIdx]) {
          chosenLane = laneIdx;
          break;
        }
      }
    } else {
      for (const laneIdx of candidateLanes) {
        if (earliestForLane(laneIdx, speed, stageW) <= simNow) {
          chosenLane = laneIdx;
          break;
        }
      }
    }
    if (chosenLane < 0) return false;

    const spec = nextSpec();
    const travelPx = stageW + spec.width + 16;
    const durSec = travelPx / speed;
    const jitterY = Math.round((Math.random() * 12 - 6) * 10) / 10;

    const el = document.createElement('a');
    el.className = 'tag ktag-pill-lg ktag-fly';
    el.href = spec.href;
    if (spec.title) el.title = spec.title;
    el.dataset.category = spec.category;

    const sw = document.createElement('span');
    sw.className = 'ktag-swatch';
    sw.style.background = spec.swatchBg;
    sw.setAttribute('aria-hidden', 'true');
    const txt = document.createElement('span');
    txt.textContent = spec.label;
    el.append(sw, txt);

    const delaySec = initialProgress > 0 ? -(durSec * initialProgress) : 0;
    const launchSimMs = simNow + delaySec * 1000;
    el.style.setProperty('--fly-from', `${stageW + 8}px`);
    el.style.setProperty('--fly-to', `${-(spec.width + 8)}px`);
    el.style.setProperty('--fly-dur', `${durSec.toFixed(3)}s`);
    el.style.setProperty('--jitter-y', `${jitterY}px`);
    if (delaySec < 0) {
      el.style.animationDelay = `${delaySec.toFixed(3)}s`;
    }

    lastLane = chosenLane;
    lastByLane[chosenLane] = {
      launchSimMs,
      width: spec.width,
      speed,
      exitSimMs: launchSimMs + durSec * 1000,
    };
    activeCount += 1;

    el.addEventListener(
      'animationend',
      () => {
        el.remove();
        activeCount = Math.max(0, activeCount - 1);
        if (running && activeCount < MAX_ONSCREEN) {
          scheduleTick(120 + Math.random() * 480);
        }
      },
      { once: true },
    );

    lanes[chosenLane].appendChild(el);
    return true;
  };

  function scheduleTick(delayMs: number) {
    if (!running || timerId) return;
    timerId = window.setTimeout(() => {
      timerId = 0;
      if (!running) return;
      spawnOne(0);
      if (activeCount < MAX_ONSCREEN) {
        scheduleTick(420 + Math.random() * 780);
      }
    }, Math.max(40, delayMs));
  }

  // Seed initial tags staggered across the 5 lanes (<= MAX_ONSCREEN)
  const initialOffsets = [0.14, 0.42, 0.68, 0.28, 0.56];
  for (let i = 0; i < Math.min(laneCount, MAX_ONSCREEN); i += 1) {
    spawnOne(initialOffsets[i]);
  }

  root.addEventListener('pointerenter', () => {
    hoveredOrFocused = true;
    syncPlayState();
  });
  root.addEventListener('pointerleave', () => {
    hoveredOrFocused = root.matches(':focus-within');
    syncPlayState();
  });
  root.addEventListener('focusin', () => {
    hoveredOrFocused = true;
    syncPlayState();
  });
  root.addEventListener('focusout', () => {
    window.requestAnimationFrame(() => {
      hoveredOrFocused = root.matches(':hover') || root.matches(':focus-within');
      syncPlayState();
    });
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      ([entry]) => {
        inView = Boolean(entry?.isIntersecting);
        syncPlayState();
      },
      { threshold: 0.01 },
    );
    io.observe(root);
    document.addEventListener('visibilitychange', syncPlayState);
  } else {
    inView = true;
    syncPlayState();
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
      // Phase 1 (0..280ms): front card drops down & fades completely to 0 before wrap
      outgoing.classList.add('is-dropping');
      outgoing.style.zIndex = String(total + 1);
      outgoing.style.transform = 'translate3d(0, 128px, 24px) scale(0.95) skewY(3deg)';
      outgoing.style.opacity = '0';

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
