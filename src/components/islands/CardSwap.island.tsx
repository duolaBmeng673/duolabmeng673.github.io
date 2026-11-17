import { useEffect, useRef, useState } from 'react';
import type { SwapCardItem } from '../../lib/home-data';
import ReactBitsCardSwap, { Card, type CardSwapHandle } from './ReactBitsCardSwap';

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

export default function CardSwapIsland({ cards }: CardSwapIslandProps) {
  const total = cards.length;
  const [active, setActive] = useState(0);
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
  );
  const [motionPaused, setMotionPaused] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    const homeRoot = document.querySelector<HTMLElement>('[data-home-root]');
    return homeRoot?.dataset.motion === 'paused';
  });
  const swapRef = useRef<CardSwapHandle | null>(null);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);

  useEffect(() => {
    const sync = () => {
      setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const homeRoot = document.querySelector<HTMLElement>('[data-home-root]');
    let motionMo: MutationObserver | null = null;
    if (homeRoot) {
      const syncMotion = () => setMotionPaused(homeRoot.dataset.motion === 'paused');
      syncMotion();
      motionMo = new MutationObserver(syncMotion);
      motionMo.observe(homeRoot, { attributes: true, attributeFilter: ['data-motion'] });
    }
    return () => {
      mo.disconnect();
      motionMo?.disconnect();
    };
  }, []);

  return (
    <div
      className="vis swap-lab-vis"
      data-card-swap
      onPointerDownCapture={(e) => {
        pointerDownRef.current = { x: e.clientX, y: e.clientY };
        draggedRef.current = false;
      }}
      onPointerMoveCapture={(e) => {
        if (!pointerDownRef.current) return;
        if (Math.hypot(e.clientX - pointerDownRef.current.x, e.clientY - pointerDownRef.current.y) > 6) {
          draggedRef.current = true;
        }
      }}
    >
      <ReactBitsCardSwap
        ref={swapRef}
        width={280}
        height={172}
        cardDistance={32}
        verticalDistance={28}
        depth={70}
        skewAmount={6}
        visibleCards={4}
        cardRadius={16}
        delay={4000}
        speed={1}
        bounce={0.35}
        parallax={0.5}
        hoverSpread={0.12}
        dim={0.48}
        autoplay={!motionPaused}
        pauseOnHover
        draggable
        intro={false}
        theme={theme}
        onChange={(index) => setActive(index)}
      >
        {cards.map((card, idx) => (
          <Card key={`${card.href}-${idx}`}>
            <a
              className="swap-blog-card"
              href={card.href}
              draggable={false}
              style={{ ['--card-accent' as string]: card.accent }}
              onClick={(e) => {
                if (draggedRef.current || !e.currentTarget.closest('[data-front]')) {
                  e.preventDefault();
                }
              }}
            >
              <div className="swap-card-bar">
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
            </a>
          </Card>
        ))}
      </ReactBitsCardSwap>

      <div className="swap-controls" aria-label="专题卡片切换控制">
        <button
          type="button"
          className="swap-ctrl-btn"
          data-swap-prev
          aria-label="上一张专题卡片"
          onClick={() => swapRef.current?.prev()}
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
          onClick={() => swapRef.current?.next()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
