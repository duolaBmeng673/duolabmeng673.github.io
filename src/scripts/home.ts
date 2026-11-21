import { STORAGE_KEYS } from '../lib/storage-keys';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function initMotionController() {
  const homeRoot = document.querySelector<HTMLElement>('[data-home-root]');
  const toggleBtn = document.querySelector<HTMLButtonElement>('[data-motion-toggle]');
  const labelNode = toggleBtn?.querySelector<HTMLElement>('.motion-toggle-text');
  const listeners = new Set<() => void>();

  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEYS.motion);
  } catch {
    stored = null;
  }

  let paused = stored === 'paused' ? true : stored === 'running' ? false : reducedMotion();

  const apply = (persist: boolean) => {
    if (homeRoot) {
      homeRoot.dataset.motion = paused ? 'paused' : 'running';
    }
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
      const nextLabel = paused ? '继续动效' : '暂停动效';
      toggleBtn.setAttribute('aria-label', nextLabel);
      toggleBtn.title = nextLabel;
      if (labelNode) labelNode.textContent = nextLabel;
    }
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEYS.motion, paused ? 'paused' : 'running');
      } catch {
        // Ignore storage errors in private mode.
      }
    }
    for (const fn of listeners) fn();
  };

  toggleBtn?.addEventListener('click', () => {
    paused = !paused;
    apply(true);
  });

  window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    try {
      if (localStorage.getItem(STORAGE_KEYS.motion)) return;
    } catch {
      // Ignore storage errors.
    }
    paused = e.matches;
    apply(false);
  });

  apply(false);

  return {
    isPaused: () => paused,
    toggle: () => {
      paused = !paused;
      apply(true);
    },
    subscribe: (fn: () => void) => listeners.add(fn),
  };
}

type MotionController = ReturnType<typeof initMotionController>;

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

  const activatePreset = (
    slug: string,
    persist: boolean,
    animate: boolean,
    triggerEl?: HTMLElement,
    clickOrigin?: { x: number; y: number },
  ) => {
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
    document.documentElement.style.removeProperty('--trail-rgb');
    const originRect = triggerEl?.getBoundingClientRect();
    const fallbackRect = stage.getBoundingClientRect();
    const originX = clickOrigin
      ? clickOrigin.x
      : originRect
        ? originRect.left + originRect.width / 2
        : fallbackRect.width > 0
          ? fallbackRect.left + fallbackRect.width / 2
          : window.innerWidth / 2;
    const originY = clickOrigin
      ? clickOrigin.y
      : originRect
        ? originRect.top + originRect.height / 2
        : fallbackRect.height > 0
          ? fallbackRect.top + fallbackRect.height / 2
          : window.innerHeight / 2;

    const homeRoot = document.querySelector<HTMLElement>('[data-home-root]');
    const motionPaused = reducedMotion() || homeRoot?.dataset.motion === 'paused';
    const startTime = performance.now();
    // Stage responds immediately on click without waiting for the backdrop wave
    stage.dataset.preset = activeSlug;

    window.dispatchEvent(
      new CustomEvent('duolabmeng673:preset-change', {
        detail: { slug: activeSlug, originX, originY, startTime, delayMs: 0, animate: animate && !motionPaused },
      }),
    );
  };

  const initial = document.documentElement.dataset.preset || 'all';
  activatePreset(initial, false, false);

  for (const btn of buttons) {
    btn.addEventListener('click', (event: MouseEvent) => {
      const slug = btn.dataset.presetSlug;
      if (!slug) return;
      const hasPointerCoords = event.clientX > 0 || event.clientY > 0;
      activatePreset(
        slug,
        true,
        true,
        btn,
        hasPointerCoords ? { x: event.clientX, y: event.clientY } : undefined,
      );
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
function initDanmaku(motionCtrl: MotionController) {
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

  const initialStageW = Math.max(260, stage.clientWidth || root.clientWidth || 960);
  const MAX_ONSCREEN = Math.max(14, Math.min(24, Math.round(initialStageW / 54)));
  const MIN_SPEED = 42;
  const MAX_SPEED = 64; // 64 / 42 = 1.524x <= 1.6x
  const MIN_GAP_PX = 24;
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

  const canPlay = () => inView && !document.hidden && !hoveredOrFocused && !motionCtrl.isPaused() && !reducedMotion();

  const syncPlayState = () => {
    const shouldRun = canPlay();
    const userPaused = motionCtrl.isPaused();
    root.classList.toggle('is-inview', inView && !document.hidden);
    root.classList.toggle('is-paused', hoveredOrFocused || userPaused);
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

  const spawnOne = (initialProgress = 0, forcedLane = -1): boolean => {
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
    if (forcedLane >= 0 && forcedLane < laneCount) {
      chosenLane = forcedLane;
    } else if (initialProgress > 0) {
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
    const jitterY = Math.round((Math.random() * 10 - 5) * 10) / 10;

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
          scheduleTick(60 + Math.random() * 200);
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
        scheduleTick(140 + Math.random() * 280);
      }
    }, Math.max(40, delayMs));
  }

  // Seed initial tags staggered across the 6 lanes (3 per lane on wide full-row stage, 2 on compact)
  const leadOffsets = [0.68, 0.80, 0.62, 0.74, 0.66, 0.84];
  const midOffsets = [0.36, 0.48, 0.30, 0.42, 0.34, 0.50];
  const trailOffsets = [0.08, 0.20, 0.04, 0.16, 0.10, 0.22];
  const wideStage = initialStageW >= 880;
  for (let i = 0; i < laneCount; i += 1) {
    spawnOne(leadOffsets[i % leadOffsets.length], i);
    if (wideStage) {
      spawnOne(midOffsets[i % midOffsets.length], i);
    }
    spawnOne(trailOffsets[i % trailOffsets.length], i);
  }

  root.addEventListener('focusin', () => {
    hoveredOrFocused = true;
    syncPlayState();
  });
  root.addEventListener('focusout', () => {
    window.requestAnimationFrame(() => {
      hoveredOrFocused = root.matches(':focus-within');
      syncPlayState();
    });
  });

  motionCtrl.subscribe(syncPlayState);

  let touchStart: { x: number; y: number } | null = null;
  root.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    touchStart = { x: e.clientX, y: e.clientY };
  }, { passive: true });
  root.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch' || !touchStart) return;
    const dist = Math.hypot(e.clientX - touchStart.x, e.clientY - touchStart.y);
    touchStart = null;
    if (dist <= 8 && !(e.target as HTMLElement | null)?.closest('a')) {
      motionCtrl.toggle();
    }
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

const motionCtrl = initMotionController();
initHeroStage();
initDanmaku(motionCtrl);
