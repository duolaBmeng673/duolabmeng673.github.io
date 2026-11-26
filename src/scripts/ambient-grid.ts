/**
 * Interactive architectural square-grid backdrop.
 * - Cell pitch is 20px, aligned with article-tile-bg's adjacent tile-gap centerlines (x = 20*c, y = 20*r).
 * - Desktop / fine pointer: follows pointer with fading trailing cells + click ripples across the full top canvas
 *   (including the header region and homepage).
 * - Touch / coarse pointer: runs an autonomous sweeping diagonal light band on the homepage (unless paused);
 *   stays static on non-home pages via (hover: none), (pointer: coarse).
 * - prefers-reduced-motion: reduce: renders a crisp static grid and disables animation loops.
 */
const canvas = document.querySelector<HTMLCanvasElement>('[data-ambient-grid]');
if (canvas) {
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const homeRoot = document.querySelector<HTMLElement>('[data-home-root]');
    const isHome = Boolean(homeRoot) || document.body.classList.contains('home-page');
    const squareSize = 20;
    const motionMedia = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const pointerMedia = window.matchMedia?.('(hover: hover) and (pointer: fine)');
    const coarseOrNoHoverMedia = window.matchMedia?.('(hover: none), (pointer: coarse)');

    let systemReduceMotion = motionMedia?.matches ?? false;
    let userPaused = homeRoot?.dataset.motion === 'paused';
    let hasFinePointer = pointerMedia?.matches ?? true;
    let isCoarseOrNoHover = coarseOrNoHoverMedia?.matches ?? false;
    let allowPointer = !systemReduceMotion && hasFinePointer;
    let allowTouchSweep = !systemReduceMotion && !userPaused && !hasFinePointer && !(isCoarseOrNoHover && !isHome);

    const syncMotionState = () => {
      allowPointer = !systemReduceMotion && hasFinePointer;
      allowTouchSweep = !systemReduceMotion && !userPaused && !hasFinePointer && !(isCoarseOrNoHover && !isHome);
    };

    let theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    let width = 0;
    let height = 0;
    let canvasDocLeft = 0;
    let canvasDocTop = 0;
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
      if (!allowPointer && !allowTouchSweep) {
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
      canvasDocLeft = Math.round(rect.left + window.scrollX);
      canvasDocTop = Math.round(rect.top + window.scrollY);
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
      const gx = Math.floor((localX + canvasDocLeft + offsetX) / squareSize);
      const gy = Math.floor((localY + canvasDocTop + offsetY) / squareSize);
      boostCell(gx, gy, 1.0);
      boostCell(gx + 1, gy, 0.36);
      boostCell(gx - 1, gy, 0.36);
      boostCell(gx, gy + 1, 0.36);
      boostCell(gx, gy - 1, 0.36);
    };

    const snapGridLine = (coord: number) => (dpr >= 2 ? Math.round(coord * dpr) / dpr : Math.round(coord) + 0.5);

    const renderFrame = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (allowTouchSweep) {
        // Touch / coarse pointer on homepage: drifting + diagonal sweeping band independent of pointer events
        offsetX += dt * 11;
        offsetY += dt * 7;
        elapsed += dt;

        const minCol = Math.floor((canvasDocLeft + offsetX) / squareSize) - 1;
        const maxCol = Math.ceil((canvasDocLeft + width + offsetX) / squareSize) + 1;
        const minRow = Math.floor((canvasDocTop + offsetY) / squareSize) - 1;
        const maxRow = Math.ceil((canvasDocTop + height + offsetY) / squareSize) + 1;
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

      const totalOffsetX = canvasDocLeft + offsetX;
      const totalOffsetY = canvasDocTop + offsetY;
      const modX = ((totalOffsetX % squareSize) + squareSize) % squareSize;
      const modY = ((totalOffsetY % squareSize) + squareSize) % squareSize;

      if (allowPointer || allowTouchSweep) {
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
          const sx = gx * squareSize - totalOffsetX;
          const sy = gy * squareSize - totalOffsetY;
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
        const px = snapGridLine(x);
        ctx.moveTo(px, 0);
        ctx.lineTo(px, height);
      }
      for (let y = -modY; y <= height + squareSize; y += squareSize) {
        const py = snapGridLine(y);
        ctx.moveTo(0, py);
        ctx.lineTo(width, py);
      }
      ctx.stroke();

      if (allowTouchSweep && inView && !document.hidden) {
        rafId = requestAnimationFrame(renderFrame);
      } else if (allowPointer && inView && !document.hidden && (activeCells.size > 0 || ripples.length > 0 || colorTransitionStart > 0)) {
        rafId = requestAnimationFrame(renderFrame);
      } else {
        rafId = 0;
      }
    };

    const startLoop = () => {
      if ((!allowPointer && !allowTouchSweep) || rafId || !inView || document.hidden) return;
      if (!allowTouchSweep && activeCells.size === 0 && ripples.length === 0 && colorTransitionStart === 0) return;
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

    window.addEventListener(
      'pointermove',
      (e) => {
        if (!allowPointer) return;
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
        if (!allowPointer) return;
        const rect = canvas.getBoundingClientRect();
        const lx = e.clientX - rect.left;
        const ly = e.clientY - rect.top;
        if (lx >= 0 && lx <= rect.width && ly >= 0 && ly <= rect.height) {
          ripples.push({
            wx: lx + canvasDocLeft + offsetX,
            wy: ly + canvasDocTop + offsetY,
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
      if (!document.hidden && inView && (allowPointer || allowTouchSweep)) startLoop();
      else if (document.hidden) stopLoop();
    });

    window.addEventListener('duolabmeng673:preset-change', () => {
      syncTrailColor();
    });

    motionMedia?.addEventListener('change', (e) => {
      systemReduceMotion = e.matches;
      syncMotionState();
      if (!allowPointer && !allowTouchSweep) {
        activeCells.clear();
        ripples.length = 0;
        stopLoop();
        renderFrame(performance.now());
      } else {
        startLoop();
      }
    });

    if (homeRoot) {
      new MutationObserver(() => {
        userPaused = homeRoot.dataset.motion === 'paused';
        syncMotionState();
        if (!allowPointer && !allowTouchSweep) {
          activeCells.clear();
          ripples.length = 0;
          stopLoop();
          renderFrame(performance.now());
        } else if (!allowTouchSweep && activeCells.size === 0 && ripples.length === 0) {
          stopLoop();
        } else {
          startLoop();
        }
      }).observe(homeRoot, { attributes: true, attributeFilter: ['data-motion'] });
    }

    const handlePointerMediaChange = () => {
      hasFinePointer = pointerMedia?.matches ?? true;
      isCoarseOrNoHover = coarseOrNoHoverMedia?.matches ?? false;
      syncMotionState();
      pointer.inside = false;
      if (!allowPointer && !allowTouchSweep) {
        activeCells.clear();
        ripples.length = 0;
        stopLoop();
        renderFrame(performance.now());
      } else if (allowTouchSweep && inView && !document.hidden) {
        startLoop();
      } else if (!allowTouchSweep && activeCells.size === 0 && ripples.length === 0) {
        stopLoop();
      }
    };

    pointerMedia?.addEventListener('change', handlePointerMediaChange);
    coarseOrNoHoverMedia?.addEventListener('change', handlePointerMediaChange);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        ([entry]) => {
          inView = entry?.isIntersecting ?? true;
          if (inView && (allowPointer || allowTouchSweep) && !document.hidden) startLoop();
          else if (!inView) stopLoop();
        },
        { threshold: 0.01 }
      ).observe(canvas);
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
