import { useEffect, useRef, useState } from 'react';
import TechText from './TechText';

export interface TechTextIslandProps {
  text: string;
}

export default function TechTextIsland({ text }: TechTextIslandProps) {
  const hostRef = useRef<HTMLSpanElement | null>(null);
  const [ready, setReady] = useState(false);
  const [metrics, setMetrics] = useState({
    fontSize: 44,
    fontWeight: 700,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, system-ui, sans-serif',
  });
  const [colors, setColors] = useState({
    ink: '#121217',
    accent: '#26607d',
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const measureTarget = host.closest<HTMLElement>('.hero-tech-wrap') ?? host;

    const readVisualState = () => {
      const hostStyle = getComputedStyle(host);
      const wrapStyle = getComputedStyle(measureTarget);
      const rootStyle = getComputedStyle(document.documentElement);
      const parsedSize = Number.parseFloat(wrapStyle.fontSize) || 44;
      const parsedWeight = Number.parseInt(wrapStyle.fontWeight, 10) || 700;
      const ink = wrapStyle.color || rootStyle.getPropertyValue('--tx').trim() || '#121217';
      const accent =
        hostStyle.getPropertyValue('--ac').trim() || rootStyle.getPropertyValue('--ac').trim() || '#26607d';
      setMetrics((prev) =>
        prev.fontSize === parsedSize && prev.fontWeight === parsedWeight && prev.fontFamily === wrapStyle.fontFamily
          ? prev
          : { fontSize: parsedSize, fontWeight: parsedWeight, fontFamily: wrapStyle.fontFamily },
      );
      setColors((prev) => (prev.ink === ink && prev.accent === accent ? prev : { ink, accent }));
    };

    readVisualState();
    setReady(true);

    const mo = new MutationObserver(readVisualState);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-preset'] });

    const ro = 'ResizeObserver' in window ? new ResizeObserver(readVisualState) : null;
    ro?.observe(measureTarget);

    return () => {
      mo.disconnect();
      ro?.disconnect();
    };
  }, []);

  return (
    <span ref={hostRef} className="tech-text-host" data-tech-ready={ready ? 'true' : undefined}>
      <TechText
        text={text}
        fontFamily={metrics.fontFamily}
        fontWeight={metrics.fontWeight}
        fontSize={metrics.fontSize}
        letterSpacing={-0.02}
        align="center"
        color={colors.ink}
        accentColor={colors.accent}
        reveal="letter"
        dashLength={4}
        dashGap={2}
        specks={5}
        sweep={false}
        intro="none"
        clickKick={true}
        draggable={true}
        selection={true}
        labels={true}
        guides={false}
      />
    </span>
  );
}
