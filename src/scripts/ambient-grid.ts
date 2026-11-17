/**
 * Drifting architectural square-grid backdrop.
 * - Desktop / fine pointer: follows pointer with fading trailing cells + click ripples.
 * - Touch / coarse pointer: runs an autonomous sweeping diagonal light band without needing pointer events.
 * - prefers-reduced-motion: reduce: renders a crisp static grid and disables drift/animation loops.
 */
const canvas = document.querySelector<HTMLCanvasElement>('[data-ambient-grid]');
if (canvas) {
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const squareSize = 44;
    const isStaticPage = canvas.hasAttribute('data-ambient-static');
    const motionMedia = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const pointerMedia = window.matchMedia?.('(hover: hover) and (pointer: fine)');

    let reduceMotion = isStaticPage || (motionMedia?.matches ?? false);
    let hasFinePointer = pointerMedia?.matches ?? true;
    let theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    let width = 0;
    let height = 0;
    let dpr = 1;
    let inView = true;
    let offsetX = 0;
    let offsetY = 0;
    let lastTime = performance.now();
    let elapsed = 0;
    let rafId = 0;

    const activeCells = new Map<string, number>();
    const ripples: Array<{ wx: number; wy: number; age: number; duration: number; speed: number }> = [];
    const pointer = { x: -9999, y: -9999, inside: false };

    const parseTrailRgb = (): [number, number, number] => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue('--trail-rgb').trim();
      const parts = raw.split(/[\s,]+/).slice(0, 3).map((v) => Number(v));
      if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
        return [parts[0], parts[1], parts[2]];
      }
      return [37, 99, 235];
    };

    let currentRgb: [number, number, number] = parseTrailRgb();
    let fromRgb: [number, number, number] = [...currentRgb];
    let targetRgb: [number, number, number] = [...currentRgb];
    let colorTransitionStart = 0;
    const COLOR_TRANSITION_MS = 160;

    const syncTrailColor = () => {
      const next = parseTrailRgb();
      if (next[0] === targetRgb[0] && next[1] === targetRgb[1] && next[2] === targetRgb[2]) return;
      if (reduceMotion) {
        currentRgb = next;
        fromRgb = next;
        targetRgb = next;
        colorTransitionStart = 0;
      } else {
        fromRgb = [...currentRgb];
        targetRgb = next;
        colorTransitionStart = performance.now();
      }
      if (activeCells.size > 0 || ripples.length > 0) startLoop();
      else if (!rafId) renderFrame(performance.now());
    };

    const getPalette = () =>
      theme === 'dark'
        ? {
            line: 'rgba(244, 241, 250, 0.055)',
            maxFill: 0.16,
            maxBorder: 0.38,
          }
        : {
            line: 'rgba(17, 17, 27, 0.045)',
            maxFill: 0.12,
            maxBorder: 0.28,
          };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    };

    const boostCell = (gx: number, gy: number, energy: number) => {
      const key = `${gx},${gy}`;
      const prev = activeCells.get(key) || 0;
      if (energy > prev) activeCells.set(key, energy);
    };

    const igniteAt = (localX: number, localY: number) => {
      const gx = Math.floor((localX + offsetX) / squareSize);
      const gy = Math.floor((localY + offsetY) / squareSize);
      boostCell(gx, gy, 1.0);
      boostCell(gx + 1, gy, 0.36);
      boostCell(gx - 1, gy, 0.36);
      boostCell(gx, gy + 1, 0.36);
      boostCell(gx, gy - 1, 0.36);
    };

    const renderFrame = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (!reduceMotion && !hasFinePointer) {
        // Touch / coarse pointer: regular drifting + diagonal sweeping band independent of pointer events
        offsetX += dt * 11;
        offsetY += dt * 7;
        elapsed += dt;

        const minCol = Math.floor(offsetX / squareSize) - 1;
        const maxCol = Math.ceil((width + offsetX) / squareSize) + 1;
        const minRow = Math.floor(offsetY / squareSize) - 1;
        const maxRow = Math.ceil((height + offsetY) / squareSize) + 1;
        const span = (maxCol - minCol) * 0.72 + (maxRow - minRow) * 0.56 + 10;
        const sweepCenter = ((elapsed * 3.4) % span) - 5;
        for (let gy = minRow; gy <= maxRow; gy += 1) {
          for (let gx = minCol; gx <= maxCol; gx += 1) {
            const diag = (gx - minCol) * 0.72 + (gy - minRow) * 0.56;
            const dist = Math.abs(diag - sweepCenter);
            if (dist < 2.2) {
              const energy = Math.exp(-dist * dist * 0.55) * 0.75;
              boostCell(gx, gy, energy);
            }
          }
        }
      }

      for (let i = ripples.length - 1; i >= 0; i -= 1) {
        const rp = ripples[i];
        rp.age += dt;
        if (rp.age >= rp.duration) {
          ripples.splice(i, 1);
          continue;
        }
        const radius = rp.age * rp.speed;
        const fade = 1 - rp.age / rp.duration;
        const minC = Math.floor((rp.wx - radius) / squareSize);
        const maxC = Math.ceil((rp.wx + radius) / squareSize);
        const minR = Math.floor((rp.wy - radius) / squareSize);
        const maxR = Math.ceil((rp.wy + radius) / squareSize);
        for (let gy = minR; gy <= maxR; gy += 1) {
          for (let gx = minC; gx <= maxC; gx += 1) {
            const cx = (gx + 0.5) * squareSize;
            const cy = (gy + 0.5) * squareSize;
            const dist = Math.hypot(cx - rp.wx, cy - rp.wy);
            if (Math.abs(dist - radius) < squareSize * 0.65) {
              boostCell(gx, gy, fade * 0.65);
            }
          }
        }
      }

      if (colorTransitionStart > 0) {
        const elapsedColor = Math.min(1, Math.max(0, (now - colorTransitionStart) / COLOR_TRANSITION_MS));
        const ease = 1 - Math.pow(1 - elapsedColor, 2);
        currentRgb = [
          fromRgb[0] + (targetRgb[0] - fromRgb[0]) * ease,
          fromRgb[1] + (targetRgb[1] - fromRgb[1]) * ease,
          fromRgb[2] + (targetRgb[2] - fromRgb[2]) * ease,
        ];
        if (elapsedColor >= 1) {
          currentRgb = [...targetRgb];
          colorTransitionStart = 0;
        }
      }

      const rgbToken = `${Math.round(currentRgb[0])} ${Math.round(currentRgb[1])} ${Math.round(currentRgb[2])}`;
      const palette = getPalette();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const modX = ((offsetX % squareSize) + squareSize) % squareSize;
      const modY = ((offsetY % squareSize) + squareSize) % squareSize;

      if (!reduceMotion) {
        const decay = Math.exp(-dt * 2.7);
        for (const [key, energy] of activeCells.entries()) {
          const nextEnergy = energy * decay;
          if (nextEnergy < 0.012) {
            activeCells.delete(key);
            continue;
          }
          activeCells.set(key, nextEnergy);
          const comma = key.indexOf(',');
          const gx = Number(key.slice(0, comma));
          const gy = Number(key.slice(comma + 1));
          const sx = gx * squareSize - offsetX;
          const sy = gy * squareSize - offsetY;
          if (sx + squareSize < 0 || sx > width || sy + squareSize < 0 || sy > height) continue;

          ctx.fillStyle = `rgb(${rgbToken} / ${(nextEnergy * palette.maxFill).toFixed(4)})`;
          ctx.fillRect(sx + 0.5, sy + 0.5, squareSize - 1, squareSize - 1);

          ctx.strokeStyle = `rgb(${rgbToken} / ${(nextEnergy * palette.maxBorder).toFixed(4)})`;
          ctx.lineWidth = 1;
          ctx.strokeRect(sx + 0.5, sy + 0.5, squareSize - 1, squareSize - 1);
        }
      }

      ctx.strokeStyle = palette.line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = -modX; x <= width + squareSize; x += squareSize) {
        const px = Math.round(x) + 0.5;
        ctx.moveTo(px, 0);
        ctx.lineTo(px, height);
      }
      for (let y = -modY; y <= height + squareSize; y += squareSize) {
        const py = Math.round(y) + 0.5;
        ctx.moveTo(0, py);
        ctx.lineTo(width, py);
      }
      ctx.stroke();

      if (!reduceMotion && !hasFinePointer && inView && !document.hidden) {
        rafId = requestAnimationFrame(renderFrame);
      } else if (!reduceMotion && hasFinePointer && inView && !document.hidden && (activeCells.size > 0 || ripples.length > 0 || colorTransitionStart > 0)) {
        rafId = requestAnimationFrame(renderFrame);
      } else {
        rafId = 0;
      }
    };

    const startLoop = () => {
      if (reduceMotion || rafId || !inView || document.hidden) return;
      if (hasFinePointer && activeCells.size === 0 && ripples.length === 0) return;
      lastTime = performance.now();
      rafId = requestAnimationFrame(renderFrame);
    };

    const stopLoop = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    window.addEventListener(
      'resize',
      () => {
        resize();
        if (!rafId) renderFrame(performance.now());
      },
      { passive: true }
    );

    if (!isStaticPage) {
      window.addEventListener(
        'pointermove',
        (e) => {
          if (reduceMotion || !hasFinePointer) return;
          const rect = canvas.getBoundingClientRect();
          const lx = e.clientX - rect.left;
          const ly = e.clientY - rect.top;
          if (lx >= 0 && lx <= rect.width && ly >= 0 && ly <= rect.height) {
            pointer.x = lx;
            pointer.y = ly;
            pointer.inside = true;
            igniteAt(lx, ly);
            startLoop();
          } else {
            pointer.inside = false;
          }
        },
        { passive: true }
      );

      window.addEventListener(
        'pointerdown',
        (e) => {
          if (reduceMotion || !hasFinePointer) return;
          const rect = canvas.getBoundingClientRect();
          const lx = e.clientX - rect.left;
          const ly = e.clientY - rect.top;
          if (lx >= 0 && lx <= rect.width && ly >= 0 && ly <= rect.height) {
            ripples.push({
              wx: lx + offsetX,
              wy: ly + offsetY,
              age: 0,
              duration: 0.65,
              speed: 380,
            });
            startLoop();
          }
        },
        { passive: true }
      );

      document.addEventListener('mouseleave', () => {
        pointer.inside = false;
      });

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && inView && !reduceMotion) startLoop();
        else if (document.hidden) stopLoop();
      });

      window.addEventListener('duolabmeng673:preset-change', () => {
        syncTrailColor();
      });

      motionMedia?.addEventListener('change', (e) => {
        reduceMotion = e.matches;
        if (reduceMotion) {
          activeCells.clear();
          ripples.length = 0;
          stopLoop();
          renderFrame(performance.now());
        } else {
          startLoop();
        }
      });

      pointerMedia?.addEventListener('change', (e) => {
        hasFinePointer = e.matches;
        pointer.inside = false;
        if (!hasFinePointer && !reduceMotion && inView && !document.hidden) startLoop();
        else if (hasFinePointer && activeCells.size === 0 && ripples.length === 0) stopLoop();
      });

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(
          ([entry]) => {
            inView = entry?.isIntersecting ?? true;
            if (inView && !reduceMotion && !document.hidden) startLoop();
            else if (!inView) stopLoop();
          },
          { threshold: 0.01 }
        ).observe(canvas);
      }
    }

    new MutationObserver(() => {
      theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
      syncTrailColor();
      if (!rafId) renderFrame(performance.now());
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-preset', 'style'] });

    resize();
    renderFrame(performance.now());
  }
}

export {};
