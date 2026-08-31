import type { KubeProfile } from './profiles';
import { profiles } from './profiles';
import { roundedRectangleSdf } from './sdf';

export function generateSpecularTexture(options: {
  width: number;
  height: number;
  bezel: number;
  profile: KubeProfile;
  lightAngle: number;
  shininess: number;
  opacity?: number;
  borderRadius?: number;
}): string | null {
  const { width, height, bezel, profile, lightAngle, shininess, opacity = 1, borderRadius = 0.06 } = options;
  if (width <= 0 || height <= 0 || bezel <= 0) return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const image = context.createImageData(width, height);
  const f = profiles[profile];
  const angle = (lightAngle * Math.PI) / 180;
  const lightX = Math.sin(angle);
  const lightY = Math.cos(angle);
  const radius = borderRadius * Math.min(width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const sdf = roundedRectangleSdf(x, y, width, height, radius);
      image.data[offset] = 255;
      image.data[offset + 1] = 255;
      image.data[offset + 2] = 255;
      if (sdf.distance >= 0) {
        image.data[offset + 3] = 0;
        continue;
      }
      const distance = Math.max(0, Math.min(1, -sdf.distance / bezel));
      const delta = 0.001;
      const derivative = (f(Math.min(1, distance + delta)) - f(Math.max(0, distance - delta))) / (2 * delta);
      const slopeX = 1 / Math.hypot(1, derivative);
      const slopeY = derivative / Math.hypot(1, derivative);
      const nx = -sdf.nx * 0.7 + slopeX * 0.3;
      const ny = -sdf.ny * 0.7 + slopeY * 0.3;
      const length = Math.hypot(nx, ny) || 1;
      const intensity = Math.pow(Math.max(0, (nx / length) * lightX + (ny / length) * lightY), shininess);
      const edgeFalloff = 1 - Math.pow(distance, 0.5);
      image.data[offset + 3] = Math.round(intensity * edgeFalloff * 255 * opacity);
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}
