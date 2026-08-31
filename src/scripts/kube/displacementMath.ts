import type { KubeProfile } from './profiles';
import { profiles } from './profiles';

export interface DisplacementSample {
  distance: number;
  displacement: number;
}

export function displacementAt(profile: KubeProfile, distance: number, thickness: number, index = 1.5): number {
  const f = profiles[profile];
  const t = Math.max(0, Math.min(1, distance));
  const delta = 0.001;
  const height = f(t);
  const derivative = (f(Math.min(1, t + delta)) - f(Math.max(0, t - delta))) / (2 * delta);

  const nx = -derivative;
  const ny = 1;
  const normalLength = Math.hypot(nx, ny) || 1;
  const normalX = nx / normalLength;
  const normalY = ny / normalLength;
  const cosTheta1 = normalY;
  const sinTheta1 = Math.sqrt(Math.max(0, 1 - cosTheta1 ** 2));
  const ratio = index;
  const sinTheta2 = Math.min(1, ratio * sinTheta1);
  const cosTheta2 = Math.sqrt(Math.max(0, 1 - sinTheta2 ** 2));
  const r = ratio * cosTheta1 - cosTheta2;
  const refractedX = r * normalX;
  const refractedY = ratio + r * normalY;
  if (refractedY <= 0) return 0;
  return -(refractedX * height * thickness) / refractedY;
}

export function computeDisplacementField(profile: KubeProfile, sampleCount: number, thickness: number) {
  const samples = Array.from({ length: sampleCount }, (_, index) => {
    const distance = index / (sampleCount - 1);
    return { distance, displacement: displacementAt(profile, distance, thickness) };
  });
  const maxDisplacement = Math.max(1e-6, ...samples.map((sample) => Math.abs(sample.displacement)));
  return { samples, maxDisplacement };
}
