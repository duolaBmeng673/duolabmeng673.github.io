type CountMode = 'roll' | 'count';
type EasingMode = 'spring' | 'easeOut' | 'expo' | 'linear';

interface CharSlot {
  char: string;
  enter?: boolean;
  leave?: boolean;
  follow?: number;
}

interface DigitColumn {
  slot: number;
  index: number;
  place: number;
  from: number;
  to: number;
  enter: boolean;
  leave: boolean;
  delta: number;
  char?: undefined;
}

type RollSlot = CharSlot | DigitColumn;

interface ActiveColumn extends DigitColumn {
  box: HTMLSpanElement;
  strip: HTMLSpanElement | null;
  blur: SVGFEGaussianBlurElement | undefined;
  cells: (Text | null)[];
  width: number;
  ease: (t: number) => number;
  base: number;
  sigma: number;
  presence: number;
}

const CELL = 1.2;
const STAGGER = 0.07;
const SVG_NS = 'http://www.w3.org/2000/svg';
const UNITS: ReadonlyArray<readonly [number, string]> = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (e0: number, e1: number, v: number) => {
  const t = clamp01((v - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const mod10 = (v: number) => ((v % 10) + 10) % 10;

function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const derivX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const dx = derivX(t);
      if (Math.abs(dx) < 1e-6) break;
      t -= (sampleX(t) - x) / dx;
    }
    t = clamp01(t);
    let lo = 0;
    let hi = 1;
    if (Math.abs(sampleX(t) - x) > 1e-5) {
      t = x;
      for (let i = 0; i < 12; i++) {
        const sx = sampleX(t);
        if (Math.abs(sx - x) < 1e-5) break;
        if (x > sx) lo = t;
        else hi = t;
        t = 0.5 * (lo + hi);
      }
    }
    return sampleY(t);
  };
}

function makeSpring(overshoot: number) {
  const log = Math.log(Math.min(0.5, Math.max(0.001, overshoot)));
  const zeta = -log / Math.sqrt(Math.PI * Math.PI + log * log);
  const damped = Math.PI / 0.52;
  const natural = damped / Math.sqrt(1 - zeta * zeta);
  const raw = (t: number) =>
    1 - Math.exp(-zeta * natural * t) * (Math.cos(damped * t) + ((zeta * natural) / damped) * Math.sin(damped * t));
  const residual = 1 - raw(1);
  return (t: number) => (t >= 1 ? 1 : raw(t) + residual * t * t * t);
}

const EASINGS: Record<EasingMode, (t: number) => number> = {
  linear: (t) => t,
  easeOut: cubicBezier(0.33, 1, 0.68, 1),
  expo: (t) => (t >= 1 ? 1 : (1 - Math.pow(2, -10 * t)) / (1 - Math.pow(2, -10))),
  spring: makeSpring(0.06),
};

const getDecimalPlaces = (num: number) => {
  const str = num.toString();
  if (str.includes('.')) {
    const decimals = str.split('.')[1];
    if (parseInt(decimals, 10) !== 0) return decimals.length;
  }
  return 0;
};

const unitFor = (value: number): readonly [number, string] =>
  UNITS.find(([size]) => Math.abs(value) >= size * 0.9995) ?? [1, ''];

const scaleFor = (value: number, compact: boolean, decimals: number | undefined, places: number) => {
  if (!compact) return { size: 1, label: '', digits: places };
  const [size, label] = unitFor(value);
  const nextDecimals = decimals ?? (label ? (Math.abs(value) / size < 100 ? 1 : 0) : places);
  return { size, label, digits: nextDecimals };
};

const splitNumber = (value: number, digits: number, size: number) => {
  const fixed = (Math.abs(value) / size).toFixed(digits);
  const [int, frac = ''] = fixed.split('.');
  return { negative: value < 0 && Number(fixed) !== 0, int, frac };
};

const groupDigits = (int: string, separator: string) =>
  separator ? int.replace(/\B(?=(\d{3})+(?!\d))/g, separator) : int;

function buildRoll(a: number, b: number, spin: boolean, places: number, separator: string) {
  const { size, label, digits } = scaleFor(b, false, undefined, places);
  const pa = splitNumber(a, digits, size);
  const pb = splitNumber(b, digits, size);
  const length = Math.max(pa.int.length, pb.int.length);
  const slots: RollSlot[] = [];
  const columns: DigitColumn[] = [];
  if (pa.negative || pb.negative) {
    slots.push({ char: '-', enter: !pa.negative, leave: !pb.negative });
  }

  const digitAt = (parts: ReturnType<typeof splitNumber>, place: number) => {
    if (place < 0) return Number(parts.frac[-place - 1]);
    const index = parts.int.length - 1 - place;
    return index >= 0 ? Number(parts.int[index]) : null;
  };

  for (let place = length - 1; place >= -digits; place--) {
    if (place === -1) slots.push({ char: '.' });
    const start = digitAt(pa, place);
    const end = digitAt(pb, place);
    const column: DigitColumn = {
      slot: slots.length,
      index: columns.length,
      place,
      from: start ?? 0,
      to: end ?? 0,
      enter: start === null,
      leave: end === null,
      delta: 0,
    };
    slots.push(column);
    columns.push(column);
    if (separator && place > 0 && place % 3 === 0) {
      slots.push({ char: separator, follow: column.index });
    }
  }

  const up = spin || b >= a;
  columns.forEach((column, index) => {
    const rank = columns.length - 1 - index;
    const base = up ? mod10(column.to - column.from) : -mod10(column.from - column.to);
    const turns = spin
      ? Math.max(1, 3 - rank)
      : Math.min(Math.floor(Math.abs(b - a) / (size * 10 ** (column.place + 1))), Math.max(0, 3 - rank));
    column.delta = base + (up ? 10 : -10) * turns;
  });

  return { slots, columns, label };
}

let uidSeq = 0;

function mountCountUp(wrap: HTMLElement) {
  if (wrap.dataset.countupInit === '1') return null;
  const hostEl = wrap.querySelector<HTMLElement>('strong') ?? wrap;
  const to = Number(wrap.dataset.countup);
  if (!Number.isFinite(to)) return null;

  const fromRaw = Number(wrap.dataset.countupFrom ?? 0);
  const from = Number.isFinite(fromRaw) ? fromRaw : 0;
  const durationRaw = Number(wrap.dataset.countupDuration ?? 1.35);
  const duration = Number.isFinite(durationRaw) ? Math.max(0, durationRaw) : 1.35;
  const delayRaw = Number(wrap.dataset.countupDelay ?? 0);
  const delay = Number.isFinite(delayRaw) ? Math.max(0, delayRaw) : 0;
  const mode: CountMode = wrap.dataset.countupMode === 'count' ? 'count' : 'roll';
  const easingAttr = wrap.dataset.countupEasing;
  const easing: EasingMode =
    easingAttr === 'linear' || easingAttr === 'easeOut' || easingAttr === 'expo' || easingAttr === 'spring'
      ? easingAttr
      : 'spring';
  const replayOnHover = wrap.dataset.countupHover !== 'false';
  const separator = wrap.dataset.countupSeparator ?? '';
  const prefix = wrap.dataset.countupPrefix ?? '';
  const suffix = wrap.dataset.countupSuffix ?? '';

  wrap.dataset.countupInit = '1';
  const uid = `cu-${++uidSeq}`;
  const places = Math.max(getDecimalPlaces(from), getDecimalPlaces(to));

  let running = false;
  let started = false;
  let rafId = 0;

  const formatValue = (val: number) => {
    const { size, label, digits } = scaleFor(val, false, undefined, places);
    const parts = splitNumber(val, digits, size);
    const body = `${parts.negative ? '-' : ''}${groupDigits(parts.int, separator)}${parts.frac ? `.${parts.frac}` : ''}`;
    return `${prefix}${body}${label}${suffix}`;
  };

  const slotStyleText = `display:inline-block;height:${CELL}em;line-height:${CELL}em;`;

  const run = (spin = false) => {
    if (rafId) cancelAnimationFrame(rafId);
    const a = spin && mode === 'roll' ? to : from;
    const b = to;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const ease = EASINGS[easing];
    const total = duration;
    let renderFrame: (elapsedSec: number) => void;

    if (reduce || total === 0) {
      hostEl.textContent = formatValue(b);
      running = false;
      return;
    }

    if (mode === 'roll') {
      const model = buildRoll(a, b, spin, places, separator);
      const finalText = formatValue(b);

      hostEl.textContent = '';
      hostEl.classList.add('cu-active');

      const stripWrap = document.createElement('span');
      stripWrap.setAttribute('aria-hidden', 'true');
      stripWrap.style.cssText = 'display:inline-flex;align-items:baseline;white-space:pre;user-select:none;';

      if (prefix) {
        const prefixEl = document.createElement('span');
        prefixEl.style.cssText = slotStyleText;
        prefixEl.textContent = prefix;
        stripWrap.appendChild(prefixEl);
      }

      const slotNodes: HTMLSpanElement[] = [];
      model.slots.forEach((slot) => {
        const isChar = slot.char !== undefined;
        const hidden = isChar
          ? Boolean(slot.enter || (slot.follow !== undefined && model.columns[slot.follow]?.enter))
          : slot.enter;

        const node = document.createElement('span');
        node.style.cssText = `${slotStyleText}${isChar ? 'overflow:hidden;' : 'position:relative;overflow:hidden;'}${hidden ? 'width:0;opacity:0;' : ''}`;

        if (isChar) {
          node.textContent = slot.char;
        } else {
          const colStrip = document.createElement('span');
          colStrip.style.cssText = `display:flex;flex-direction:column;transform:translateY(${-CELL}em);`;
          [-1, 0, 1, 2].forEach((offset) => {
            const cell = document.createElement('span');
            cell.style.height = `${CELL}em`;
            cell.textContent = String(mod10(slot.from + offset));
            colStrip.appendChild(cell);
          });
          node.appendChild(colStrip);
        }

        stripWrap.appendChild(node);
        slotNodes.push(node);
      });

      if (model.label) {
        const labelEl = document.createElement('span');
        labelEl.style.cssText = slotStyleText;
        labelEl.textContent = model.label;
        stripWrap.appendChild(labelEl);
      }
      if (suffix) {
        const suffixEl = document.createElement('span');
        suffixEl.style.cssText = slotStyleText;
        suffixEl.textContent = suffix;
        stripWrap.appendChild(suffixEl);
      }

      const sr = document.createElement('span');
      sr.className = 'cu-sr';
      sr.textContent = finalText;

      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('width', '0');
      svg.setAttribute('height', '0');
      svg.style.position = 'absolute';
      const defs = document.createElementNS(SVG_NS, 'defs');
      const blurNodes: SVGFEGaussianBlurElement[] = [];
      model.columns.forEach((col) => {
        const filter = document.createElementNS(SVG_NS, 'filter');
        filter.setAttribute('id', `${uid}-${col.index}`);
        filter.setAttribute('x', '-20%');
        filter.setAttribute('y', '-50%');
        filter.setAttribute('width', '140%');
        filter.setAttribute('height', '200%');
        filter.setAttribute('color-interpolation-filters', 'sRGB');
        const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
        blur.setAttribute('stdDeviation', '0 0');
        filter.appendChild(blur);
        defs.appendChild(filter);
        blurNodes.push(blur);
      });
      svg.appendChild(defs);
      hostEl.append(stripWrap, sr, svg);

      const fontSize = parseFloat(getComputedStyle(hostEl).fontSize) || 16;
      const cellPx = CELL * fontSize;
      const stagger = model.columns.length > 1 ? Math.min(STAGGER, (total * 0.4) / (model.columns.length - 1)) : 0;
      const span = Math.max(0.001, total - stagger * (model.columns.length - 1));

      const columns: ActiveColumn[] = model.columns.map((col) => {
        const box = slotNodes[col.slot];
        const strip = box?.firstChild as HTMLSpanElement | null;
        return {
          ...col,
          box,
          strip,
          blur: blurNodes[col.index],
          cells: strip ? Array.from(strip.childNodes, (n) => n.firstChild as Text | null) : [],
          width: box ? box.scrollWidth : 0,
          ease:
            easing === 'spring'
              ? makeSpring(Math.min(0.12, Math.max(0.01, 0.35 / Math.max(1, Math.abs(col.delta)))))
              : ease,
          base: Math.floor(col.from),
          sigma: 0,
          presence: col.enter ? 0 : 1,
        };
      });

      const marks = model.slots
        .map((slot, idx) => ({ slot, node: slotNodes[idx] }))
        .filter(
          (entry): entry is { slot: CharSlot; node: HTMLSpanElement } =>
            entry.slot.char !== undefined &&
            Boolean(entry.slot.enter || entry.slot.leave || entry.slot.follow !== undefined),
        )
        .map((entry) => ({ ...entry.slot, node: entry.node, width: entry.node.scrollWidth }));

      const fade = (node: HTMLSpanElement | undefined, width: number, presence: number, settled: boolean) => {
        if (!node) return;
        node.style.width = settled ? '' : `${(presence * width).toFixed(2)}px`;
        node.style.opacity = settled ? '' : presence.toFixed(3);
      };

      renderFrame = (elapsedSec) => {
        const overall = total > 0 ? clamp01(elapsedSec / total) : 1;
        columns.forEach((column, idx) => {
          if (!column.strip) return;
          const u = clamp01((elapsedSec - idx * stagger) / span);
          const pos = column.from + column.delta * column.ease(u);
          const base = Math.floor(pos);
          if (base !== column.base) {
            column.base = base;
            column.cells.forEach((node, offset) => {
              if (node) node.nodeValue = String(mod10(base + offset - 1));
            });
          }
          column.strip.style.transform = `translateY(${(-(1 + pos - base) * CELL).toFixed(4)}em)`;

          const u0 = Math.max(0, u - 0.004);
          const u1 = Math.min(1, u + 0.004);
          const speed =
            u1 > u0 ? (Math.abs(column.delta) * Math.abs(column.ease(u1) - column.ease(u0))) / (u1 - u0) / span : 0;
          const sigma = u > 0 && u < 1 ? Math.min(cellPx * 0.05, (speed * cellPx) / 600) : 0;
          if (Math.abs(sigma - column.sigma) > 0.05 || (sigma === 0 && column.sigma !== 0)) {
            column.sigma = sigma;
            if (sigma > 0.2 && column.blur) {
              column.blur.setAttribute('stdDeviation', `0 ${sigma.toFixed(2)}`);
              column.strip.style.filter = `url(#${uid}-${idx})`;
            } else {
              column.strip.style.filter = '';
            }
          }

          if (column.enter || column.leave) {
            column.presence = column.enter ? smooth(0, 0.45, u) : 1 - smooth(0.55, 1, u);
            fade(column.box, column.width, column.presence, column.enter && u >= 1);
          }
        });

        marks.forEach((mark) => {
          if (mark.follow !== undefined) {
            const col = columns[mark.follow];
            if (col && (col.enter || col.leave)) {
              fade(mark.node, mark.width, col.presence, col.enter && col.presence >= 1);
            }
          } else {
            const presence = mark.enter ? smooth(0, 0.3, overall) : 1 - smooth(0.7, 1, overall);
            fade(mark.node, mark.width, presence, Boolean(mark.enter) && overall >= 1);
          }
        });
      };
    } else {
      hostEl.textContent = '';
      const txt = document.createElement('span');
      txt.textContent = formatValue(from);
      hostEl.appendChild(txt);
      renderFrame = (elapsedSec) => {
        const p = total > 0 ? clamp01(elapsedSec / total) : 1;
        const value = a + (b - a) * ease(p);
        txt.textContent = formatValue(value);
      };
    }

    running = true;
    const delayMs = spin ? 0 : delay * 1000;
    const startAt = performance.now() + delayMs;
    const step = (now: number) => {
      const elapsed = (now - startAt) / 1000;
      if (elapsed < 0) {
        rafId = requestAnimationFrame(step);
        return;
      }
      if (elapsed >= total) {
        renderFrame(Infinity);
        running = false;
        rafId = 0;
        return;
      }
      renderFrame(elapsed);
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
  };

  if (replayOnHover) {
    const hoverHost = wrap.closest<HTMLElement>('[data-countup-hover-zone]') ?? wrap;
    hoverHost.addEventListener('pointerenter', () => {
      if (started && !running) run(mode === 'roll');
    });
  }

  return () => {
    if (started) return;
    started = true;
    run(false);
  };
}

const wraps = [...document.querySelectorAll<HTMLElement>('[data-countup]')];

if (wraps.length > 0) {
  const triggerByTarget = new Map<Element, () => void>();
  for (const wrap of wraps) {
    const start = mountCountUp(wrap);
    if (!start) continue;
    const target = wrap.querySelector('strong') ?? wrap;
    triggerByTarget.set(target, start);
  }

  if (triggerByTarget.size > 0) {
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            io.unobserve(entry.target);
            triggerByTarget.get(entry.target)?.();
          }
        },
        { threshold: 0.1 },
      );
      for (const target of triggerByTarget.keys()) io.observe(target);
    } else {
      for (const start of triggerByTarget.values()) start();
    }
  }
}

export {};
