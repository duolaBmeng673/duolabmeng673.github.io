/**
 * Shared radial wave timing model used by the background dot-matrix,
 * the stage wave veil, and delayed stage/WebGL color synchronization.
 */

export const WAVE_SPEED = 450; // px/s user-tuned wave propagation speed
export const PULSE_SPEED = 520; // px/s click impact disc expansion speed
export const WAVE_LEAD = 130; // px leading edge ahead of flip zone
export const WAVE_DITHER = 230; // px organic per-cell flip band
export const WAVE_WAKE = 330; // px trailing colored wake behind flip zone
export const WAVE_STRUCT_SPAN = WAVE_LEAD + WAVE_DITHER + WAVE_WAKE;

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const smoothstep = (t: number): number => {
  const u = clamp(t, 0, 1);
  return u * u * (3 - 2 * u);
};

/**
 * Total duration (ms) for a preset wave to cross `maxReach` plus its full trailing structure.
 */
export function computeWaveDuration(maxReach: number): number {
  const totalDist = Math.max(0, maxReach) + WAVE_STRUCT_SPAN;
  return Math.round(clamp((totalDist / WAVE_SPEED) * 1000, 2200, 6000));
}

/**
 * Near-constant front radius R(t) with gentle 12% smoothstep cushion so the mid-screen
 * front never spikes to unreadable speed while start/end stay tactile.
 */
export function computeWaveRadius(elapsedMs: number, durationMs: number, maxReach: number): number {
  if (durationMs <= 0) return maxReach + WAVE_STRUCT_SPAN;
  const u = clamp(elapsedMs / durationMs, 0, 1);
  const progress = 0.88 * u + 0.12 * smoothstep(u);
  return progress * (maxReach + WAVE_STRUCT_SPAN);
}

/**
 * Delay (ms) before the wave front arrives at the visual center of a target rect (e.g. `.stage`).
 */
export function computeStageArrivalDelay(
  originX: number,
  originY: number,
  rect: { left: number; top: number; width: number; height: number },
): number {
  if (rect.width <= 0 || rect.height <= 0) return 0;
  const cx = rect.left + rect.width * 0.5;
  const cy = rect.top + rect.height * 0.5;
  const dist = Math.hypot(cx - originX, cy - originY);
  return Math.round(clamp((dist / WAVE_SPEED) * 1000 * 0.72, 60, 1400));
}

/**
 * Recommended WebGL/CSS stage color transition duration (ms) matching the wave front crossing.
 */
export const STAGE_MORPH_MS = Math.round(((WAVE_LEAD + WAVE_DITHER) / WAVE_SPEED) * 1000);
