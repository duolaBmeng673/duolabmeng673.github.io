import { useEffect, useState } from 'react';

export interface CountUpIslandProps {
  to: number;
  from?: number;
  duration?: number;
  className?: string;
}

export default function CountUpIsland({
  to,
  from = 0,
  duration = 900,
  className = 'masthead-stat-num',
}: CountUpIslandProps) {
  // Keep initial SSR/first-paint value equal to `to` for zero-JS parity & layout stability.
  const [value, setValue] = useState(to);

  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduceMotion || to <= from || duration <= 0) {
      setValue(to);
      return undefined;
    }

    let rafId = 0;
    let startTime = 0;
    setValue(from);

    const tick = (now: number) => {
      if (!startTime) startTime = now;
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(from + (to - from) * eased);
      setValue(current);
      if (progress < 1 && !document.hidden) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        setValue(to);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [to, from, duration]);

  return <strong className={className}>{value}</strong>;
}
