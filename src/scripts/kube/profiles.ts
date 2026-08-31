export type KubeProfile = 'convex-circle' | 'convex-squircle' | 'concave' | 'lip';

const smootherstep = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

const convexCircle = (x: number) => Math.sqrt(Math.max(0, 1 - (1 - x) ** 2));
const convexSquircle = (x: number) => Math.pow(Math.max(0, 1 - (1 - x) ** 4), 0.25);
const concave = (x: number) => 1 - convexCircle(x);
const lip = (x: number) => {
  const s = smootherstep(x);
  return (1 - s) * convexCircle(x) + s * concave(x);
};

export const profiles: Record<KubeProfile, (x: number) => number> = {
  'convex-circle': convexCircle,
  'convex-squircle': convexSquircle,
  concave,
  lip,
};

export const profileLabels: Record<KubeProfile, string> = {
  'convex-circle': 'Convex circle',
  'convex-squircle': 'Convex squircle',
  concave: 'Concave',
  lip: 'Lip',
};
