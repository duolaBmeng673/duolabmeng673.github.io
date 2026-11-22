// Static fixed-position non-repeating random square-tile background for article reading pages.
// Renders once on load, resize, and theme toggle (zero animation loop, 0% idle CPU, zero periodic tiling).

const CELL = 20;
const TILE = 18;

const hash2d = (x: number, y: number, seed: number): number => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
};

function initArticleFixedTileBg() {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-article-fixed-tile]');
  if (!canvas || canvas.dataset.initialized === '1') return;
  canvas.dataset.initialized = '1';

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  // Fresh random seed per page visit so no two visits or regions repeat periodically
  const seed = (Math.random() * 0x7fffffff) | 0;

  const draw = () => {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.ceil(rect.width));
    const height = Math.max(1, Math.ceil(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const isDark = document.documentElement.dataset.theme === 'dark';
    const baseColor = isDark ? '255, 255, 255' : '18, 18, 23';
    const baseAlpha = isDark ? 0.022 : 0.017;
    const tier1Alpha = isDark ? 0.044 : 0.032;
    const tier2Alpha = isDark ? 0.068 : 0.048;
    const tier3Alpha = isDark ? 0.096 : 0.066;

    const cols = Math.ceil(width / CELL);
    const rows = Math.ceil(height / CELL);

    // Base micro-tile matrix
    ctx.fillStyle = `rgba(${baseColor}, ${baseAlpha})`;
    for (let r = 0; r < rows; r += 1) {
      const y = r * CELL;
      for (let c = 0; c < cols; c += 1) {
        ctx.fillRect(c * CELL, y, TILE, TILE);
      }
    }

    // Sparse non-repeating organic accent tiles across 3 subtle brightness tiers
    const tier1: Array<[number, number]> = [];
    const tier2: Array<[number, number]> = [];
    const tier3: Array<[number, number]> = [];

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const h = hash2d(c, r, seed);
        if (h < 0.008) {
          tier3.push([c * CELL, r * CELL]);
        } else if (h < 0.024) {
          tier2.push([c * CELL, r * CELL]);
        } else if (h < 0.052) {
          tier1.push([c * CELL, r * CELL]);
        }
      }
    }

    const paintTier = (cells: Array<[number, number]>, alpha: number) => {
      if (!cells.length) return;
      ctx.fillStyle = `rgba(${baseColor}, ${alpha})`;
      for (let i = 0; i < cells.length; i += 1) {
        ctx.fillRect(cells[i][0], cells[i][1], TILE, TILE);
      }
    };

    paintTier(tier1, tier1Alpha);
    paintTier(tier2, tier2Alpha);
    paintTier(tier3, tier3Alpha);
  };

  const themeObserver = new MutationObserver(draw);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(draw).observe(canvas);
  } else {
    window.addEventListener('resize', draw, { passive: true });
  }

  draw();
}

initArticleFixedTileBg();
