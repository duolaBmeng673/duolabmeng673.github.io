import { useCallback, useEffect, useRef, useState } from 'react';
import type { SwapCardItem } from '../../lib/home-data';

export interface CardSwapIslandProps {
  cards: SwapCardItem[];
}

function CardBadgeIcon({ icon }: { icon: SwapCardItem['icon'] }) {
  if (icon === 'book') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    );
  }
  if (icon === 'sparkles') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      </svg>
    );
  }
  if (icon === 'cpu') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect width="16" height="16" x="4" y="4" rx="2" />
        <rect width="6" height="6" x="9" y="9" rx="1" />
        <path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2" />
      </svg>
    );
  }
  if (icon === 'sigma') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M18 7V4H6l6 8-6 8h12v-3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function slotGeometry(order: number, total: number) {
  const zIndex = total - order;
  const x = order * 24;
  const y = -order * 18;
  const z = -order * 52;
  const scale = Math.max(0.82, 1 - order * 0.045);
  const opacity = order > 3 ? 0 : Math.max(0.45, 1 - order * 0.16);
  return {
    zIndex,
    x,
    y,
    z,
    scale,
    opacity,
    transform: `translate3d(${x}px, ${y}px, ${z}px) scale(${scale}) skewY(3deg)`,
  };
}

function applySlotDom(
  slot: HTMLAnchorElement,
  props: { zIndex: number; transform: string; opacity: number },
  isFront: boolean,
) {
  slot.style.zIndex = String(props.zIndex);
  slot.style.transform = props.transform;
  slot.style.opacity = String(props.opacity);
  slot.toggleAttribute('data-front', isFront);
  slot.tabIndex = isFront ? 0 : -1;
}

export default function CardSwapIsland({ cards }: CardSwapIslandProps) {
  const total = cards.length;
  const [active, setActive] = useState(0);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const slotRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const activeRef = useRef(0);
  const hoveredRef = useRef(false);
  const inViewRef = useRef(false);
  const animatingRef = useRef(false);
  const reduceMotionRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const animListenersRef = useRef<Array<{ el: HTMLAnchorElement; fn: () => void }>>([]);

  const clearPhaseClasses = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    animListenersRef.current.forEach(({ el, fn }) => el.removeEventListener('animationend', fn));
    animListenersRef.current = [];
    slotRefs.current.forEach((s) => {
      if (!s) return;
      s.classList.remove('is-arc-dropping', 'is-dropping', 'is-settling', 'is-spring', 'is-instant');
      s.style.removeProperty('--drop-x');
      s.style.removeProperty('--drop-y');
      s.style.removeProperty('--drop-z');
      s.style.removeProperty('--drop-scale');
      s.style.removeProperty('--drop-opacity');
      s.style.removeProperty('--drop-delay');
    });
    animatingRef.current = false;
  }, []);

  const layoutSlots = useCallback(
    (targetActive: number) => {
      slotRefs.current.forEach((slot, idx) => {
        if (!slot) return;
        const order = (idx - targetActive + total) % total;
        applySlotDom(slot, slotGeometry(order, total), order === 0);
      });
    },
    [total],
  );

  const cascadeForward = useCallback(
    (steps: number) => {
      if (total <= 1 || steps <= 0) return;
      if (reduceMotionRef.current) {
        clearPhaseClasses();
        const nextActive = (activeRef.current + steps) % total;
        activeRef.current = nextActive;
        setActive(nextActive);
        layoutSlots(nextActive);
        return;
      }

      if (animatingRef.current) {
        clearPhaseClasses();
        layoutSlots(activeRef.current);
      }
      animatingRef.current = true;

      const STAGGER_MS = 95;
      const DROP_MS = 380;
      const oldActive = activeRef.current;
      const nextActive = (oldActive + steps) % total;
      const droppingIndices = Array.from({ length: steps }, (_, k) => (oldActive + k) % total);
      const droppingSet = new Set(droppingIndices);

      activeRef.current = nextActive;
      setActive(nextActive);

      slotRefs.current.forEach((slot, idx) => {
        if (!slot || droppingSet.has(idx)) return;
        const newOrder = (idx - nextActive + total) % total;
        slot.classList.add('is-spring');
        applySlotDom(slot, slotGeometry(newOrder, total), newOrder === 0);
      });

      let completedDrops = 0;
      droppingIndices.forEach((slotIdx, stepIdx) => {
        const card = slotRefs.current[slotIdx];
        if (!card) return;
        const startGeom = slotGeometry(stepIdx, total);
        const delayMs = stepIdx * STAGGER_MS;

        card.toggleAttribute('data-front', false);
        card.tabIndex = -1;
        card.style.zIndex = String(total + steps - stepIdx);
        card.style.setProperty('--drop-x', `${startGeom.x}px`);
        card.style.setProperty('--drop-y', `${startGeom.y}px`);
        card.style.setProperty('--drop-z', `${startGeom.z}px`);
        card.style.setProperty('--drop-scale', `${startGeom.scale}`);
        card.style.setProperty('--drop-opacity', `${startGeom.opacity}`);
        card.style.setProperty('--drop-delay', `${delayMs}ms`);
        card.classList.add('is-arc-dropping');

        let settled = false;
        const finalizeDrop = () => {
          if (settled) return;
          settled = true;

          const targetOrder = (slotIdx - nextActive + total) % total;
          const backGeom = slotGeometry(targetOrder, total);
          card.classList.add('is-instant');
          card.style.opacity = '0';
          card.classList.remove('is-arc-dropping');
          card.style.removeProperty('--drop-x');
          card.style.removeProperty('--drop-y');
          card.style.removeProperty('--drop-z');
          card.style.removeProperty('--drop-scale');
          card.style.removeProperty('--drop-opacity');
          card.style.removeProperty('--drop-delay');
          card.style.zIndex = String(backGeom.zIndex);
          card.style.transform = `translate3d(${backGeom.x + 10}px, ${backGeom.y - 24}px, ${backGeom.z}px) scale(${Math.max(0.78, backGeom.scale - 0.02)}) skewY(3deg)`;
          void card.offsetWidth;

          card.classList.remove('is-instant');
          card.classList.add('is-spring');
          applySlotDom(card, backGeom, false);

          completedDrops += 1;
          if (completedDrops === droppingIndices.length) {
            timersRef.current.push(
              window.setTimeout(() => {
                slotRefs.current.forEach((s) => s?.classList.remove('is-spring'));
                animatingRef.current = false;
              }, 620),
            );
          }
        };

        card.addEventListener('animationend', finalizeDrop, { once: true });
        animListenersRef.current.push({ el: card, fn: finalizeDrop });
        timersRef.current.push(window.setTimeout(finalizeDrop, delayMs + DROP_MS + 40));
      });
    },
    [clearPhaseClasses, layoutSlots, total],
  );

  const goPrev = useCallback(() => {
    if (total <= 1) return;
    if (reduceMotionRef.current) {
      clearPhaseClasses();
      const nextActive = (activeRef.current - 1 + total) % total;
      activeRef.current = nextActive;
      setActive(nextActive);
      layoutSlots(nextActive);
      return;
    }

    if (animatingRef.current) {
      clearPhaseClasses();
      layoutSlots(activeRef.current);
    }
    animatingRef.current = true;

    const nextActive = (activeRef.current - 1 + total) % total;
    const incoming = slotRefs.current[nextActive];
    const frontGeom = slotGeometry(0, total);
    if (!incoming) return;

    incoming.classList.add('is-dropping');
    incoming.style.zIndex = String(total + 1);
    incoming.style.transform = 'translate3d(-14px, -112px, 24px) scale(0.94) skewY(3deg)';
    incoming.style.opacity = '0.35';

    activeRef.current = nextActive;
    setActive(nextActive);
    slotRefs.current.forEach((slot, idx) => {
      if (!slot || idx === nextActive) return;
      const order = (idx - nextActive + total) % total;
      slot.classList.add('is-spring');
      applySlotDom(slot, slotGeometry(order, total), false);
    });

    timersRef.current.push(
      window.setTimeout(() => {
        incoming.classList.remove('is-dropping');
        incoming.classList.add('is-spring');
        applySlotDom(incoming, frontGeom, true);

        timersRef.current.push(
          window.setTimeout(() => {
            slotRefs.current.forEach((s) => s?.classList.remove('is-spring'));
            animatingRef.current = false;
          }, 620),
        );
      }, 240),
    );
  }, [clearPhaseClasses, layoutSlots, total]);

  useEffect(() => {
    layoutSlots(activeRef.current);

    const motionMq = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
    reduceMotionRef.current = motionMq?.matches ?? false;
    const onMotionChange = (e: MediaQueryListEvent) => {
      reduceMotionRef.current = e.matches;
      if (e.matches) {
        clearPhaseClasses();
        layoutSlots(activeRef.current);
      }
    };
    motionMq?.addEventListener('change', onMotionChange);

    const rootEl = rootRef.current;
    let io: IntersectionObserver | null = null;
    if (rootEl && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(
        ([entry]) => {
          inViewRef.current = Boolean(entry?.isIntersecting);
        },
        { threshold: 0.01 },
      );
      io.observe(rootEl);
    } else {
      inViewRef.current = true;
    }

    const onVisibility = () => {
      if (document.hidden && animatingRef.current) {
        clearPhaseClasses();
        layoutSlots(activeRef.current);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const autoTimer = window.setInterval(() => {
      if (!reduceMotionRef.current && inViewRef.current && !hoveredRef.current && !document.hidden && !animatingRef.current) {
        cascadeForward(1);
      }
    }, 3600);

    return () => {
      motionMq?.removeEventListener('change', onMotionChange);
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(autoTimer);
      clearPhaseClasses();
    };
  }, [cascadeForward, clearPhaseClasses, layoutSlots]);

  return (
    <div
      ref={rootRef}
      className="vis swap-lab-vis"
      data-card-swap
      onMouseEnter={() => {
        hoveredRef.current = true;
      }}
      onMouseLeave={() => {
        hoveredRef.current = false;
      }}
    >
      <div className="card-swap-stage">
        {cards.map((card, idx) => (
          <a
            key={`${card.href}-${idx}`}
            ref={(el) => {
              slotRefs.current[idx] = el;
            }}
            className="card-swap-slot"
            href={card.href}
            data-swap-slot={idx}
            data-front={idx === active ? '' : undefined}
            tabIndex={idx === active ? 0 : -1}
            onClick={(e) => {
              const steps = (idx - activeRef.current + total) % total;
              if (steps > 0) {
                e.preventDefault();
                cascadeForward(steps);
              }
            }}
          >
            <div className="swap-blog-card">
              <div className="swap-blog-top">
                <span className="swap-blog-badge" style={{ color: card.accent }}>
                  <CardBadgeIcon icon={card.icon} />
                  <span>{card.cat}</span>
                </span>
                <svg className="swap-blog-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M7 7h10v10" />
                  <path d="M7 17 17 7" />
                </svg>
              </div>
              <div className="swap-blog-body">
                <strong>{card.title}</strong>
                <p>{card.desc}</p>
              </div>
            </div>
          </a>
        ))}
      </div>

      <div className="swap-controls" aria-label="专题卡片切换控制">
        <button
          type="button"
          className="swap-ctrl-btn"
          data-swap-prev
          aria-label="上一张专题卡片"
          onClick={() => goPrev()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <span className="swap-ctrl-count" data-swap-count>
          {active + 1} / {total}
        </span>
        <button
          type="button"
          className="swap-ctrl-btn"
          data-swap-next
          aria-label="下一张专题卡片"
          onClick={() => cascadeForward(1)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
