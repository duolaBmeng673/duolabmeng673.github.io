import type { KubeProfile } from './profiles';
import { computeDisplacementField } from './displacementMath';
import { roundedRectangleSdf } from './sdf';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function generateDisplacementTexture(options: {
  width: number;
  height: number;
  bezel: number;
  profile: KubeProfile;
  thickness: number;
  borderRadius?: number;
}): string | null {
  const { width, height, bezel, profile, thickness, borderRadius = 0.06 } = options;
  if (width <= 0 || height <= 0 || bezel <= 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const image = context.createImageData(width, height);
  const field = computeDisplacementField(profile, 128, thickness);
  const sample = (value: number) => {
    const position = Math.max(0, Math.min(1, value)) * (field.samples.length - 1);
    const lower = Math.floor(position);
    const upper = Math.min(field.samples.length - 1, lower + 1);
    return lerp(field.samples[lower].displacement, field.samples[upper].displacement, position - lower);
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const sdf = roundedRectangleSdf(x, y, width, height, borderRadius * Math.min(width, height));
      if (sdf.distance >= 0) {
        image.data[offset] = 128;
        image.data[offset + 1] = 128;
        image.data[offset + 2] = 128;
        image.data[offset + 3] = 255;
        continue;
      }
      const distance = Math.max(0, Math.min(1, -sdf.distance / bezel));
      const normalized = sample(distance) / field.maxDisplacement;
      image.data[offset] = Math.round(128 - sdf.nx * normalized * 127);
      image.data[offset + 1] = Math.round(128 - sdf.ny * normalized * 127);
      image.data[offset + 2] = 128;
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}
