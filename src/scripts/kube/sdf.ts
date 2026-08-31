export interface SdfSample {
  distance: number;
  nx: number;
  ny: number;
}

/** Signed distance and outward normal for a rounded rectangle. */
export function roundedRectangleSdf(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): SdfSample {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  const cx = width / 2;
  const cy = height / 2;
  const qx = Math.abs(x - cx) - (width / 2 - r);
  const qy = Math.abs(y - cy) - (height / 2 - r);
  const outsideX = Math.max(qx, 0);
  const outsideY = Math.max(qy, 0);
  const outsideLength = Math.hypot(outsideX, outsideY);
  const inside = Math.min(Math.max(qx, qy), 0);
  const distance = outsideLength + inside - r;

  let nx = outsideLength > 0 ? outsideX / outsideLength : 0;
  let ny = outsideLength > 0 ? outsideY / outsideLength : 0;
  if (outsideLength === 0) {
    if (qx > qy) nx = 1;
    else ny = 1;
  }
  nx *= Math.sign(x - cx) || 1;
  ny *= Math.sign(y - cy) || 1;

  return { distance, nx, ny };
}
