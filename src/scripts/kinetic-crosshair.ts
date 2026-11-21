// Dual-style low-power interactive backdrop (Scheme C: Kinetic Crosshair & Scheme B: Packet Mesh).
// Zero React, zero WebGL, 0% idle CPU: renders in the upper area of /, /blog/, /study-notes/, /tools/, /about/,
// syncs colors to the active theme & channel/preset, switches live via Settings, and halts rAF when settled/offscreen.

const CROSS_STEP = 34;
const HALF_LEN = 4.5;
const HOVER_RADIUS = 160;
const WAVE_MAX_R = 300;
const WAVE_SPEED = 440;
const WAVE_BAND = 54;
const MAX_WAVES = 4;

const MESH_LINK_RADIUS = 185;
const PACKET_SPEED = 3.1;
const MAX_PACKETS = 18;

type Rgb = [number, number, number];
type ChannelKey = 'all' | 'research' | 'cs' | '837';
type BgStyle = 'crosshair' | 'mesh';

interface MeshNode {
  x: number;
  y: number;
  glow: number;
  adj: number[];
}

interface Packet {
  from: number;
  to: number;
  t: number;
  hopsLeft: number;
  prev: number;
}

const PRESET_VAR: Record<ChannelKey, string> = {
  all: '--ch-all-rgb',
  research: '--ch-research-rgb',
  cs: '--ch-cs-rgb',
  '837': '--ch-837-rgb',
};

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

const parseCssRgb = (raw: string, fallback: Rgb): Rgb => {
  const parts = raw
    .trim()
    .split(/[\s,]+/)
    .slice(0, 3)
    .map(Number);
  return parts.length === 3 && parts.every(Number.isFinite) ? [parts[0], parts[1], parts[2]] : fallback;
};

const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => {
  const u = clamp(t, 0, 1);
  return [
    a[0] + (b[0] - a[0]) * u,
    a[1] + (b[1] - a[1]) * u,
    a[2] + (b[2] - a[2]) * u,
  ];
};

const resolveChannelKey = (): ChannelKey => {
  const channel = document.body.dataset.channel || 'site';
  if (channel === 'home') {
    const preset = document.documentElement.dataset.preset;
    if (preset === 'all' || preset === 'research' || preset === 'cs' || preset === '837') return preset;
    return 'all';
  }
  if (channel === 'study') return '837';
  if (channel === 'blog') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('category') === 'Computer Science') return 'cs';
    return 'research';
  }
  // /tools/ and /about/ follow site Indigo accent (reserving Dusk purple strictly for homepage `all`)
  return 'research';
};

const readThemeAccent = (): { rgb: Rgb; isDark: boolean } => {
  const root = document.documentElement;
  const isDark = root.dataset.theme === 'dark';
  const key = resolveChannelKey();
  const cssVar = PRESET_VAR[key];
  const fallback: Rgb = isDark ? [122, 162, 255] : [59, 95, 208];
  const raw = getComputedStyle(root).getPropertyValue(cssVar);
  return { rgb: parseCssRgb(raw, fallback), isDark };
};

const readBgStyle = (): BgStyle => (document.documentElement.dataset.bgStyle === 'mesh' ? 'mesh' : 'crosshair');

function initKineticCrosshair() {
  const container = document.querySelector<HTMLElement>('[data-kinetic-crosshair]');
  const canvas = container?.querySelector<HTMLCanvasElement>('canvas');
  if (!container || !canvas || container.dataset.initialized === '1') return;
  container.dataset.initialized = '1';

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const motionMedia = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const finePointerMedia = window.matchMedia?.('(hover: hover) and (pointer: fine)');
  const homeRoot = document.querySelector<HTMLElement>('[data-home-root]');

  let style: BgStyle = readBgStyle();
  let systemReduce = motionMedia?.matches ?? false;
  let hostPaused = homeRoot?.dataset.motion === 'paused';
  let hasFinePointer = finePointerMedia?.matches ?? true;
  let visible = true;
  let rafId = 0;
  let lastTime = 0;

  let width = 1;
  let height = 1;
  let dpr = 1;

  // Scheme C: Crosshair grid state
  let cols = 0;
  let rows = 0;
  let startX = 0;
  let startY = 0;
  let angles = new Float32Array(0);
  let glows = new Float32Array(0);
  const waves: Array<{ x: number; y: number; r: number }> = [];

  // Scheme B: Packet Mesh state
  let meshNodes: MeshNode[] = [];
  let meshEdges: Array<[number, number]> = [];
  const packets: Packet[] = [];
  let meshWakeAlpha = 0;

  let pointerX = -9999;
  let pointerY = -9999;
  let pointerInside = false;

  const initial = readThemeAccent();
  let isDark = initial.isDark;
  let curRgb: Rgb = [...initial.rgb];
  let fromRgb: Rgb = [...initial.rgb];
  let targetRgb: Rgb = [...initial.rgb];
  let colorT = 1;

  const isStatic = () => systemReduce || hostPaused;

  const stopLoop = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    lastTime = 0;
  };

  const rebuildGeometry = () => {
    const rect = container.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Build Scheme C sparse 34px crosshair lattice
    cols = Math.max(1, Math.floor(width / CROSS_STEP) + 1);
    rows = Math.max(1, Math.floor(height / CROSS_STEP) + 1);
    startX = (width - (cols - 1) * CROSS_STEP) * 0.5;
    startY = (height - (rows - 1) * CROSS_STEP) * 0.5;
    const count = cols * rows;
    angles = new Float32Array(count);
    glows = new Float32Array(count);

    // Build Scheme B deterministic sparse static routing topology
    meshNodes = [];
    meshEdges = [];
    packets.length = 0;
    const mCols = Math.max(6, Math.round(width / 138));
    const mRows = Math.max(4, Math.round(height / 118));
    const cellW = width / mCols;
    const cellH = height / mRows;
    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let r = 0; r < mRows; r += 1) {
      for (let c = 0; c < mCols; c += 1) {
        meshNodes.push({
          x: (c + 0.16 + rand() * 0.68) * cellW,
          y: (r + 0.16 + rand() * 0.68) * cellH,
          glow: 0,
          adj: [],
        });
      }
    }
    const maxEdgeDist = Math.max(cellW, cellH) * 1.42;
    for (let i = 0; i < meshNodes.length; i += 1) {
      for (let j = i + 1; j < meshNodes.length; j += 1) {
        const d = Math.hypot(meshNodes[i].x - meshNodes[j].x, meshNodes[i].y - meshNodes[j].y);
        if (d < maxEdgeDist) {
          meshEdges.push([i, j]);
          meshNodes[i].adj.push(j);
          meshNodes[j].adj.push(i);
        }
      }
    }
  };

  const drawCrosshairFrame = (dt: number, r: number, g: number, b: number, staticMode: boolean): boolean => {
    let keepAlive = false;

    if (!staticMode) {
      for (let i = waves.length - 1; i >= 0; i -= 1) {
        waves[i].r += WAVE_SPEED * dt;
        if (waves[i].r >= WAVE_MAX_R + WAVE_BAND) {
          waves.splice(i, 1);
        } else {
          keepAlive = true;
        }
      }
    } else if (waves.length) {
      waves.length = 0;
    }

    const baseAlpha = isDark ? 0.16 : 0.20;
    const activeGain = isDark ? 0.72 : 0.64;
    const angleLerp = Math.min(1, dt * 11);
    const glowLerp = Math.min(1, dt * 9.5);
    const activeList: number[] = [];

    // Pass 1: batch all resting crosshairs in one single stroke path
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${baseAlpha})`;
    ctx.lineWidth = 1.15;
    ctx.beginPath();

    let idx = 0;
    for (let row = 0; row < rows; row += 1) {
      const y = startY + row * CROSS_STEP;
      for (let col = 0; col < cols; col += 1) {
        const x = startX + col * CROSS_STEP;

        if (!staticMode) {
          let targetAngle = 0;
          let targetGlow = 0;

          if (hasFinePointer && pointerInside) {
            const dx = pointerX - x;
            const dy = pointerY - y;
            const dSq = dx * dx + dy * dy;
            if (dSq < HOVER_RADIUS * HOVER_RADIUS) {
              const dist = Math.sqrt(dSq);
              const k = 1 - dist / HOVER_RADIUS;
              targetAngle = Math.atan2(dy, dx);
              targetGlow = k * k * 0.35 + k * 0.65;
            }
          }

          for (let w = 0; w < waves.length; w += 1) {
            const wave = waves[w];
            const dist = Math.hypot(x - wave.x, y - wave.y);
            const band = Math.abs(dist - wave.r);
            if (band < WAVE_BAND) {
              const local = 1 - band / WAVE_BAND;
              const fade = clamp(1 - wave.r / WAVE_MAX_R, 0, 1);
              const k = Math.sin(local * Math.PI * 0.5) * fade;
              targetAngle += Math.PI * 0.5 * k;
              if (k > targetGlow) targetGlow = k;
            }
          }

          let diff = targetAngle - angles[idx];
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;

          angles[idx] += diff * angleLerp;
          glows[idx] += (targetGlow - glows[idx]) * glowLerp;

          if (Math.abs(diff) > 0.008 || Math.abs(targetGlow - glows[idx]) > 0.008) {
            keepAlive = true;
          } else if (targetGlow === 0 && targetAngle === 0) {
            angles[idx] = 0;
            glows[idx] = 0;
          } else {
            angles[idx] = targetAngle;
            glows[idx] = targetGlow;
          }
        } else {
          angles[idx] = 0;
          glows[idx] = 0;
        }

        if (glows[idx] > 0.012 || Math.abs(angles[idx]) > 0.012) {
          activeList.push(idx);
        } else {
          ctx.moveTo(x - HALF_LEN, y);
          ctx.lineTo(x + HALF_LEN, y);
          ctx.moveTo(x, y - HALF_LEN);
          ctx.lineTo(x, y + HALF_LEN);
        }
        idx += 1;
      }
    }
    ctx.stroke();

    // Pass 2: draw ONLY active rotated/lit crosshairs
    for (let i = 0; i < activeList.length; i += 1) {
      const cellIdx = activeList[i];
      const row = Math.floor(cellIdx / cols);
      const col = cellIdx - row * cols;
      const x = startX + col * CROSS_STEP;
      const y = startY + row * CROSS_STEP;
      const gVal = clamp(glows[cellIdx], 0, 1);
      const ang = angles[cellIdx];
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const len = HALF_LEN * (1 + gVal * 0.52);

      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(baseAlpha + gVal * activeGain).toFixed(3)})`;
      ctx.lineWidth = 1.15 + gVal * 0.7;
      ctx.beginPath();
      ctx.moveTo(x - ca * len, y - sa * len);
      ctx.lineTo(x + ca * len, y + sa * len);
      ctx.moveTo(x + sa * len, y - ca * len);
      ctx.lineTo(x - sa * len, y + ca * len);
      ctx.stroke();
    }

    return keepAlive;
  };

  const drawMeshFrame = (dt: number, r: number, g: number, b: number, staticMode: boolean): boolean => {
    let keepAlive = false;

    // 1. Batched static topology edges & anchor nodes
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${isDark ? 0.11 : 0.13})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < meshEdges.length; i += 1) {
      const [aIdx, bIdx] = meshEdges[i];
      ctx.moveTo(meshNodes[aIdx].x, meshNodes[aIdx].y);
      ctx.lineTo(meshNodes[bIdx].x, meshNodes[bIdx].y);
    }
    ctx.stroke();

    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${isDark ? 0.30 : 0.34})`;
    ctx.beginPath();
    for (let i = 0; i < meshNodes.length; i += 1) {
      const n = meshNodes[i];
      ctx.moveTo(n.x + 2.2, n.y);
      ctx.arc(n.x, n.y, 2.2, 0, Math.PI * 2);
    }
    ctx.fill();

    if (staticMode) {
      packets.length = 0;
      meshWakeAlpha = 0;
      return false;
    }

    // 2. Smooth pointer relay fade
    const targetWake = hasFinePointer && pointerInside ? 1 : 0;
    meshWakeAlpha += (targetWake - meshWakeAlpha) * Math.min(1, dt * 9);
    if (Math.abs(targetWake - meshWakeAlpha) > 0.008) {
      keepAlive = true;
    } else {
      meshWakeAlpha = targetWake;
    }

    if (meshWakeAlpha > 0.01) {
      for (let i = 0; i < meshNodes.length; i += 1) {
        const n = meshNodes[i];
        const d = Math.hypot(n.x - pointerX, n.y - pointerY);
        if (d < MESH_LINK_RADIUS) {
          const k = (1 - d / MESH_LINK_RADIUS) * meshWakeAlpha;
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(k * (isDark ? 0.62 : 0.56)).toFixed(3)})`;
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(pointerX, pointerY);
          ctx.lineTo(n.x, n.y);
          ctx.stroke();
          if (k > n.glow) n.glow = k;
        }
      }
    }

    // 3. Advance multi-hop click packets along topology edges
    for (let i = packets.length - 1; i >= 0; i -= 1) {
      const p = packets[i];
      p.t += dt * PACKET_SPEED;
      const a = meshNodes[p.from];
      const bNode = meshNodes[p.to];
      if (a && bNode) {
        const u = Math.min(1, p.t);
        const px = a.x + (bNode.x - a.x) * u;
        const py = a.y + (bNode.y - a.y) * u;

        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${isDark ? 0.78 : 0.68})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(bNode.x, bNode.y);
        ctx.stroke();

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.28)`;
        ctx.beginPath();
        ctx.arc(px, py, 8.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isDark ? '#ffffff' : `rgb(${r}, ${g}, ${b})`;
        ctx.beginPath();
        ctx.arc(px, py, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }

      if (p.t >= 1) {
        if (bNode) bNode.glow = 1;
        if (p.hopsLeft > 0 && bNode && bNode.adj.length) {
          const candidates = bNode.adj.filter((idx) => idx !== p.prev);
          const nextIdx = candidates.length
            ? candidates[Math.floor(Math.random() * candidates.length)]
            : bNode.adj[0];
          p.prev = p.from;
          p.from = p.to;
          p.to = nextIdx;
          p.t = 0;
          p.hopsLeft -= 1;
          keepAlive = true;
        } else {
          packets.splice(i, 1);
        }
      } else {
        keepAlive = true;
      }
    }

    // 4. Glow highlighted routing nodes & decay back to 0% CPU rest
    for (let i = 0; i < meshNodes.length; i += 1) {
      const n = meshNodes[i];
      if (n.glow > 0.015) {
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(n.glow * 0.88).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 2.4 + n.glow * 2.5, 0, Math.PI * 2);
        ctx.fill();
        const targetNodeGlow =
          meshWakeAlpha > 0.01
            ? Math.max(0, (1 - Math.hypot(n.x - pointerX, n.y - pointerY) / MESH_LINK_RADIUS) * meshWakeAlpha)
            : 0;
        if (n.glow > targetNodeGlow + 0.01) {
          n.glow = Math.max(targetNodeGlow, n.glow - dt * 1.9);
          keepAlive = true;
        } else {
          n.glow = targetNodeGlow;
        }
      }
    }

    return keepAlive;
  };

  const drawFrame = (dt: number): boolean => {
    let keepAlive = false;

    if (colorT < 1) {
      colorT = Math.min(1, colorT + dt / 0.28);
      const eased = colorT * colorT * (3 - 2 * colorT);
      curRgb = mixRgb(fromRgb, targetRgb, eased);
      if (colorT < 1) keepAlive = true;
    }

    ctx.clearRect(0, 0, width, height);

    const r = Math.round(curRgb[0]);
    const g = Math.round(curRgb[1]);
    const b = Math.round(curRgb[2]);
    const staticMode = isStatic();

    const styleBusy =
      style === 'mesh'
        ? drawMeshFrame(dt, r, g, b, staticMode)
        : drawCrosshairFrame(dt, r, g, b, staticMode);

    return keepAlive || styleBusy;
  };

  const tick = (now: number) => {
    rafId = 0;
    if (!visible || document.hidden) {
      lastTime = 0;
      return;
    }
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 1 / 60;
    lastTime = now;
    const keepGoing = drawFrame(dt);
    if (keepGoing && !isStatic()) {
      rafId = requestAnimationFrame(tick);
    } else {
      lastTime = 0;
    }
  };

  const wake = () => {
    if (rafId || !visible || document.hidden) return;
    if (isStatic()) {
      drawFrame(1 / 60);
      return;
    }
    lastTime = 0;
    rafId = requestAnimationFrame(tick);
  };

  const syncColor = (animate: boolean) => {
    const next = readThemeAccent();
    isDark = next.isDark;
    fromRgb = [...curRgb];
    targetRgb = [...next.rgb];
    if (!animate || isStatic()) {
      curRgb = [...targetRgb];
      colorT = 1;
      drawFrame(1 / 60);
    } else {
      colorT = 0;
      wake();
    }
  };

  const syncStyle = () => {
    const next = readBgStyle();
    if (next === style) return;
    style = next;
    waves.length = 0;
    packets.length = 0;
    meshWakeAlpha = 0;
    angles.fill(0);
    glows.fill(0);
    for (let i = 0; i < meshNodes.length; i += 1) meshNodes[i].glow = 0;
    stopLoop();
    drawFrame(1 / 60);
  };

  const triggerClickAtClient = (clientX: number, clientY: number) => {
    if (isStatic() || !visible) return;
    const rect = container.getBoundingClientRect();
    const lx = clientX - rect.left;
    const ly = clientY - rect.top;
    if (lx < -WAVE_MAX_R || lx > rect.width + WAVE_MAX_R || ly < -WAVE_MAX_R || ly > rect.height + WAVE_MAX_R) {
      return;
    }

    if (style === 'mesh') {
      if (!meshNodes.length) return;
      let bestIdx = 0;
      let bestD = Infinity;
      for (let i = 0; i < meshNodes.length; i += 1) {
        const d = Math.hypot(meshNodes[i].x - lx, meshNodes[i].y - ly);
        if (d < bestD) {
          bestD = d;
          bestIdx = i;
        }
      }
      const src = meshNodes[bestIdx];
      src.glow = 1;
      for (const toIdx of src.adj.slice(0, 4)) {
        packets.push({ from: bestIdx, to: toIdx, t: 0, hopsLeft: 2, prev: bestIdx });
        if (packets.length > MAX_PACKETS) packets.shift();
      }
    } else {
      waves.push({ x: lx, y: ly, r: 0 });
      if (waves.length > MAX_WAVES) waves.shift();
    }
    wake();
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!hasFinePointer || isStatic() || !visible) return;
    const rect = container.getBoundingClientRect();
    const lx = e.clientX - rect.left;
    const ly = e.clientY - rect.top;
    const margin = style === 'mesh' ? MESH_LINK_RADIUS : HOVER_RADIUS;
    const inside = lx >= -margin && lx <= rect.width + margin && ly >= -margin && ly <= rect.height + margin;
    if (!inside) {
      if (pointerInside) {
        pointerInside = false;
        wake();
      }
      return;
    }
    pointerX = lx;
    pointerY = ly;
    pointerInside = true;
    wake();
  };

  const onPointerLeave = () => {
    if (!pointerInside) return;
    pointerInside = false;
    wake();
  };

  const onPointerDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('.site-header')) return;
    triggerClickAtClient(e.clientX, e.clientY);
  };

  const onPresetChange = (event: Event) => {
    const detail = (event as CustomEvent<{ originX?: number; originY?: number; animate?: boolean }>).detail;
    syncColor(detail?.animate ?? true);
    if (detail?.animate && typeof detail.originX === 'number' && typeof detail.originY === 'number') {
      triggerClickAtClient(detail.originX, detail.originY);
    }
  };

  const onVisibility = () => {
    if (document.hidden) stopLoop();
    else wake();
  };

  const rootObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.attributeName === 'data-bg-style') syncStyle();
      else syncColor(true);
    }
  });
  rootObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'data-preset', 'data-bg-style'],
  });

  if (homeRoot) {
    new MutationObserver(() => {
      hostPaused = homeRoot.dataset.motion === 'paused';
      if (isStatic()) {
        stopLoop();
        drawFrame(1 / 60);
      } else {
        wake();
      }
    }).observe(homeRoot, { attributes: true, attributeFilter: ['data-motion'] });
  }

  motionMedia?.addEventListener('change', (e) => {
    systemReduce = e.matches;
    if (isStatic()) {
      stopLoop();
      drawFrame(1 / 60);
    } else {
      wake();
    }
  });

  finePointerMedia?.addEventListener('change', (e) => {
    hasFinePointer = e.matches;
    if (!hasFinePointer && pointerInside) {
      pointerInside = false;
      wake();
    }
  });

  if (typeof IntersectionObserver !== 'undefined') {
    new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? true;
        if (!visible) stopLoop();
        else wake();
      },
      { threshold: 0.01 },
    ).observe(container);
  }

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      rebuildGeometry();
      drawFrame(1 / 60);
    }).observe(container);
  } else {
    window.addEventListener(
      'resize',
      () => {
        rebuildGeometry();
        drawFrame(1 / 60);
      },
      { passive: true },
    );
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('blur', onPointerLeave);
  document.addEventListener('pointerleave', onPointerLeave);
  window.addEventListener('duolabmeng673:preset-change', onPresetChange);
  window.addEventListener('duolabmeng673:bg-style-change', syncStyle);
  window.addEventListener('popstate', () => syncColor(true));
  document.addEventListener('visibilitychange', onVisibility);

  if (document.body.dataset.channel === 'blog') {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-category-filter], .filter-chip, .category-pill')) {
        queueMicrotask(() => syncColor(true));
      }
    });
  }

  rebuildGeometry();
  drawFrame(1 / 60);
}

initKineticCrosshair();
