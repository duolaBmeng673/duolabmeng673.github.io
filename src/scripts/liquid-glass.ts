/**
 * Enhanced liquid glass with convex bezel refraction.
 * Mimics Apple Music's panels as seen in kube.io demo.
 * Generates high-quality displacement map with specular highlights.
 */

interface GlassConfig {
  size: number;
  refractionLevel: number;
  blurStrength: number;
  specularOpacity: number;
  specularSaturation: number;
}

const config: GlassConfig = {
  size: 256,
  refractionLevel: 1.0,
  blurStrength: 1.0,
  specularOpacity: 0.4,
  specularSaturation: 6,
};

function generateLiquidGlassMap(targetId: string, strongMode = false) {
  const mapImage = document.querySelector<SVGImageElement>(`#${targetId}`);
  if (!mapImage) return;

  const size = config.size;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');

  if (!context) return;

  const imageData = context.createImageData(size, size);
  const data = imageData.data;

  // Refractive indices
  const n1 = 1.0; // air
  const n2 = 1.5; // glass
  const ratio = n1 / n2;

  // Convex squircle surface - Apple's preferred curve
  const surfaceProfile = (r: number): number => {
    if (r >= 1) return 0;
    const clamped = Math.max(0, Math.min(1, r));
    return Math.pow(1 - Math.pow(1 - clamped, 4), 0.25);
  };

  // Surface derivative for normal calculation
  const surfaceDerivative = (r: number): number => {
    if (r >= 1 || r <= 0) return 0;
    const inner = 1 - r;
    const inner4 = Math.pow(inner, 4);
    const outer = 1 - inner4;
    if (outer <= 0) return 0;
    return Math.pow(inner, 3) / Math.pow(outer, 0.75);
  };

  // Smootherstep for edge falloff
  const smootherstep = (edge0: number, edge1: number, x: number): number => {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * t * (t * (t * 6 - 15) + 10);
  };

  let maxDisplacement = 0;
  const displacements: Array<{x: number; y: number; specular: number}> = [];

  // Calculate displacement and specular for each pixel
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const uvX = px / (size - 1);
      const uvY = py / (size - 1);
      const centeredX = (uvX - 0.5) * 2;
      const centeredY = (uvY - 0.5) * 2;

      const r = Math.sqrt(centeredX * centeredX + centeredY * centeredY);

      let dx = 0;
      let dy = 0;
      let specular = 0;

      if (r > 0 && r < 1) {
        const height = surfaceProfile(r);
        const dh_dr = surfaceDerivative(r);

        // Surface normal
        const normalX = -centeredX * dh_dr / r;
        const normalY = -centeredY * dh_dr / r;
        const normalZ = 1;
        const normalLength = Math.sqrt(normalX * normalX + normalY * normalY + normalZ * normalZ);

        const nx = normalX / normalLength;
        const ny = normalY / normalLength;
        const nz = normalZ / normalLength;

        // Incident ray (orthogonal, pointing down)
        const incidentZ = -1;

        // cos(θ₁) = incident · normal
        const cosTheta1 = -incidentZ * nz;

        // Snell's Law
        const sin2Theta1 = 1 - cosTheta1 * cosTheta1;
        const sin2Theta2 = ratio * ratio * sin2Theta1;

        if (sin2Theta2 <= 1) {
          const cosTheta2 = Math.sqrt(1 - sin2Theta2);

          // Refracted ray direction
          const refractScale = ratio * cosTheta1 - cosTheta2;
          const refractX = nx * refractScale;
          const refractY = ny * refractScale;
          const refractZ = ratio * incidentZ + nz * refractScale;

          // Project onto XY plane
          if (refractZ !== 0) {
            const scale = -1 / refractZ;
            dx = refractX * scale * config.refractionLevel;
            dy = refractY * scale * config.refractionLevel;
          }

          // Specular highlight (rim light effect)
          // Light comes from above-right
          const lightDirX = 0.5;
          const lightDirY = -0.3;
          const lightDirZ = -0.8;
          const lightLength = Math.sqrt(lightDirX * lightDirX + lightDirY * lightDirY + lightDirZ * lightDirZ);
          const lx = lightDirX / lightLength;
          const ly = lightDirY / lightLength;
          const lz = lightDirZ / lightLength;

          // Reflection of light around normal
          const dotLN = lx * nx + ly * ny + lz * nz;
          const reflectX = 2 * dotLN * nx - lx;
          const reflectY = 2 * dotLN * ny - ly;
          const reflectZ = 2 * dotLN * nz - lz;

          // View direction (straight down)
          const viewZ = -1;
          const dotRV = reflectZ * viewZ;

          if (dotRV > 0) {
            const specularPower = 32 * config.specularSaturation;
            specular = Math.pow(dotRV, specularPower) * config.specularOpacity;
          }
        }

        // Edge falloff
        const edgeFalloff = smootherstep(0.88, 0.98, r);
        dx *= (1 - edgeFalloff);
        dy *= (1 - edgeFalloff);
        specular *= (1 - smootherstep(0.75, 0.95, r));
      }

      displacements.push({x: dx, y: dy, specular});
      const magnitude = Math.sqrt(dx * dx + dy * dy);
      if (magnitude > maxDisplacement) {
        maxDisplacement = magnitude;
      }
    }
  }

  // Normalize and encode
  for (let i = 0; i < displacements.length; i++) {
    const {x, y, specular} = displacements[i];
    const normalizedX = maxDisplacement > 0 ? x / maxDisplacement : 0;
    const normalizedY = maxDisplacement > 0 ? y / maxDisplacement : 0;

    const index = i * 4;
    data[index] = Math.round((0.5 + normalizedX * 0.5) * 255);
    data[index + 1] = Math.round((0.5 + normalizedY * 0.5) * 255);
    data[index + 2] = Math.round(specular * 255); // Store specular in blue channel
    data[index + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);

  // Apply blur for smoother refraction
  if (config.blurStrength > 0) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = size;
    tempCanvas.height = size;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.filter = `blur(${config.blurStrength * 0.8}px)`;
      tempCtx.drawImage(canvas, 0, 0);
      context.clearRect(0, 0, size, size);
      context.drawImage(tempCanvas, 0, 0);
    }
  }

  const mapUrl = canvas.toDataURL('image/png');
  mapImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', mapUrl);
  mapImage.setAttribute('href', mapUrl);

  console.log(`Generated liquid glass map: max displacement = ${maxDisplacement.toFixed(2)}px`);
}

// Generate both normal and strong displacement maps
generateLiquidGlassMap('blog-liquid-map', false);
generateLiquidGlassMap('blog-liquid-map-strong', true);
