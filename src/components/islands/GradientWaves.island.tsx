import { useEffect, useMemo, useRef, useState } from 'react';
import './GradientWaves.css';

export interface WavePresetConfig {
  slug: string;
  horizonColor: string;
  waveColor: string;
  crestColor: string;
  amplitude: number;
  swell: number;
  turbulence: number;
  waveScale: number;
  lightAngle: number;
  speed: number;
}

export interface GradientWavesIslandProps {
  presets: WavePresetConfig[];
  defaultSlug?: string;
  className?: string;
}

const ROOT = 'gradient-waves-container';
const CANVAS = 'gradient-waves-canvas';

const MAX_SWELLS = 4;
const SWELL_SECONDS = 3.2;
const SWELL_GAIN = 2.8;
const SWELL_WIDTH = 8;
const INTRO_SECONDS = 2.6;
const CAMERA_HEIGHT = 30;
const QUALITY_STEPS = 84; // medium quality parity with prototype
const MAX_WAVE_DPR = 1.5;
const TARGET_FPS = 30;
const MIN_FRAME_MS = 1000 / TARGET_FPS; // fixed 30 fps render cadence

const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uClock;
uniform float uAmplitude;
uniform float uWaveScale;
uniform float uWaveRatio;
uniform float uSwell;
uniform float uTurbulence;
uniform float uHeight;
uniform float uTilt;
uniform float uZoom;
uniform vec2 uLook;
uniform float uFogDepth;
uniform float uBrightness;
uniform float uOpacity;
uniform float uGrain;
uniform vec3 uHorizon;
uniform vec3 uWave;
uniform vec3 uCrest;
uniform vec3 uBackground;
uniform float uOpaque;
uniform float uLight;
uniform vec3 uSun;
uniform float uRelief;
uniform float uSheen;
uniform float uSteps;
uniform float uStride;
uniform vec3 uIntro;
uniform vec3 uSwells[${MAX_SWELLS}];
uniform float uSwellWidth;
out vec4 outColor;

const float FAR = 4000.0;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 surface(vec2 xy) {
  vec2 freq = vec2(uWaveScale / 7.0, (uWaveScale * uWaveRatio) / 3.0);
  vec4 tc = vec4(uTime / 0.130, uTime / 0.810, uTime / 0.200, uTime / 0.710);
  float a = xy.x + tc.x;
  float swellPhase = (xy.y + a) / 20.0 + tc.y;
  float bend = uSwell * cos(swellPhase) / 20.0;
  float mx = a + uSwell * sin(swellPhase);
  float crossPhase = xy.x / 23.0 + tc.w;
  float my = xy.y - tc.z + uTurbulence * cos(crossPhase);
  float twist = -uTurbulence * sin(crossPhase) / 23.0;
  float cx = cos(mx * freq.x);
  float cy = cos(my * freq.y);
  float rise = 1.0;
  if (uIntro.z > 0.0) rise = mix(1.0, smoothstep(uIntro.y * 0.45, uIntro.y * 1.6, xy.x), uIntro.z);
  float amp = uAmplitude * rise;
  float h = (sin(mx * freq.x) + sin(my * freq.y)) * amp + uHeight;
  float dx = amp * (freq.x * cx * (1.0 + bend) + freq.y * cy * twist);
  float dy = amp * (freq.x * cx * bend + freq.y * cy);
  for (int k = 0; k < ${MAX_SWELLS}; k++) {
    vec3 sw = uSwells[k];
    if (sw.z <= 0.0) continue;
    float u = (xy.x - sw.x) / uSwellWidth;
    float v = (xy.y - sw.y) / (uSwellWidth * 3.5);
    float bump = sw.z * exp(-u * u - v * v);
    h += bump;
    dx += bump * (-2.0 * u / uSwellWidth);
    dy += bump * (-2.0 * v / (uSwellWidth * 3.5));
  }
  return vec3(h, dx, dy);
}

float march(vec3 origin, vec3 dir) {
  float dist = 0.0;
  for (int i = 0; i < 128; i++) {
    if (float(i) >= uSteps) break;
    float gap = origin.z + dist * dir.z - surface(origin.xy + dist * dir.xy).x;
    if (abs(gap) < 0.002 * dist + 0.01) break;
    dist += uStride * gap;
    if (!(abs(dist) < FAR)) return FAR;
  }
  return dist;
}

void main() {
  float c;
  float s;
  float vfov = (3.14159 / 2.3) / max(uZoom, 0.05);
  vec3 cam = vec3(0.0, 0.0, ${CAMERA_HEIGHT.toFixed(1)});
  vec2 uv = gl_FragCoord.xy / uResolution - 0.5;
  uv.x *= uResolution.x / uResolution.y;
  uv.y *= -1.0;

  vec3 dir = vec3(0.0, 0.0, -1.0);
  float ulen = length(uv);
  float xrot = vfov * ulen;
  c = cos(xrot);
  s = sin(xrot);
  dir = mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c) * dir;
  vec2 nuv = ulen > 1e-5 ? uv / ulen : vec2(1.0, 0.0);
  dir = mat3(nuv.x, -nuv.y, 0.0, nuv.y, nuv.x, 0.0, 0.0, 0.0, 1.0) * dir;
  c = cos(uTilt + uLook.y);
  s = sin(uTilt + uLook.y);
  dir = mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c) * dir;
  c = cos(uLook.x);
  s = sin(uLook.x);
  dir = mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0) * dir;

  float dist = march(cam, dir);
  vec3 pos = cam + dist * dir;
  vec3 field = surface(pos.xy);
  vec3 view = -dir;

  float crest = clamp((field.x - uHeight) / max(2.0 * uAmplitude, 0.001) * 0.5 + 0.5, 0.0, 1.0);
  vec3 body = mix(uWave, uCrest, smoothstep(0.45, 1.0, crest) * 0.5);
  vec3 normal = normalize(vec3(-field.yz * (1.0 + 1.5 * uRelief), 1.0));
  float diffuse = clamp(dot(normal, uSun) * 0.5 + 0.5, 0.0, 1.0);
  float lightness = mix(1.0, diffuse * diffuse * (3.0 - 2.0 * diffuse), uRelief);
  float sheen = pow(clamp(dot(normal, normalize(uSun + view)), 0.0, 1.0), 14.0) * uSheen * (0.4 + 0.6 * uRelief);
  float rim = pow(1.0 - clamp(dot(normal, view), 0.0, 1.0), 3.0);

  vec3 col;
  float alpha;
  float haze = 1.0 - exp(-dist / (uFogDepth * 5.0));
  float fade = 1.0 - smoothstep(0.35, 1.0, haze);
  if (uLight < 0.5) {
    vec3 lit = mix(uHorizon * 0.18, body, lightness) + uCrest * sheen;
    lit = mix(lit, uHorizon, rim * 0.15 * uRelief);
    col = mix(lit, uHorizon, smoothstep(0.0, 1.0, haze)) * 0.85 * uBrightness;
    alpha = fade;
  } else {
    vec3 hue = mix(uHorizon, body, 0.35 + 0.65 * lightness);
    float density = mix(0.16, 0.9, 1.0 - lightness);
    density *= 1.0 - clamp(sheen, 0.0, 1.0) * 0.85;
    density *= 1.0 - 0.5 * smoothstep(0.0, 1.0, haze);
    col = hue;
    alpha = fade * clamp(density * uBrightness, 0.0, 1.0);
  }

  float reveal = uIntro.x;
  col = clamp(col, 0.0, 1.0);
  float grain = (hash(gl_FragCoord.xy + fract(uClock) * 64.0) - 0.5) * uGrain;
  alpha = clamp(alpha * (1.0 + grain), 0.0, 1.0) * reveal * uOpacity;
  if (uOpaque > 0.5) {
    outColor = vec4(mix(uBackground, col, alpha), 1.0);
  } else {
    outColor = vec4(col * alpha, alpha);
  }
}`;

type RGB = [number, number, number];
type Swell = { x: number; y: number; at: number; scale?: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

let probe: CanvasRenderingContext2D | null = null;
const parseColor = (value: string, fallback: RGB): RGB => {
  if (typeof document === 'undefined') return fallback;
  if (!probe) probe = document.createElement('canvas').getContext('2d');
  if (!probe) return fallback;
  probe.fillStyle = '#000000';
  probe.fillStyle = value;
  const text = probe.fillStyle;
  if (text.startsWith('#')) {
    const hex = parseInt(text.slice(1), 16);
    return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
  }
  const match = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(text);
  if (!match) return fallback;
  return [Number(match[1]) / 255, Number(match[2]) / 255, Number(match[3]) / 255];
};

const compile = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const rayAt = (point: [number, number], aspect: number, zoom: number, tilt: number, look: [number, number]) => {
  const uvx = (point[0] - 0.5) * aspect;
  const uvy = point[1] - 0.5;
  const vfov = Math.PI / 2.3 / Math.max(zoom, 0.05);
  const length = Math.hypot(uvx, uvy);
  const turn = vfov * length;
  let dir = [0, -Math.sin(turn), -Math.cos(turn)];
  const nx = length > 1e-5 ? uvx / length : 1;
  const ny = length > 1e-5 ? uvy / length : 0;
  dir = [nx * dir[0] + ny * dir[1], -ny * dir[0] + nx * dir[1], dir[2]];
  const pitch = tilt + look[1];
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  dir = [cp * dir[0] - sp * dir[2], dir[1], sp * dir[0] + cp * dir[2]];
  const cy = Math.cos(look[0]);
  const sy = Math.sin(look[0]);
  dir = [cy * dir[0] - sy * dir[1], sy * dir[0] + cy * dir[1], dir[2]];
  return dir;
};

const groundAt = (
  point: [number, number],
  aspect: number,
  height: number,
  zoom: number,
  tilt: number,
  look: [number, number],
): [number, number] | null => {
  const dir = rayAt(point, aspect, zoom, tilt, look);
  if (dir[2] > -0.02) return null;
  const travel = (CAMERA_HEIGHT - height) / -dir[2];
  return [dir[0] * travel, dir[1] * travel];
};

const prefersReduced = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);

export default function GradientWavesIsland({ presets, defaultSlug = 'all', className = '' }: GradientWavesIslandProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeSlug, setActiveSlug] = useState<string>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.dataset.preset || defaultSlug;
    }
    return defaultSlug;
  });
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.dataset.theme === 'dark';
    }
    return false;
  });

  // Read-only observers syncing document theme & preset changes without mutating global attributes
  useEffect(() => {
    const syncFromDom = () => {
      const nextTheme = document.documentElement.dataset.theme === 'dark';
      setIsDark(nextTheme);
      const nextSlug = document.documentElement.dataset.preset;
      if (nextSlug) setActiveSlug(nextSlug);
    };
    syncFromDom();

    const mo = new MutationObserver(syncFromDom);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-preset'] });

    const onPresetEvent = (event: Event) => {
      const slug = (event as CustomEvent<{ slug?: string }>).detail?.slug;
      if (slug) setActiveSlug(slug);
    };
    window.addEventListener('duolabmeng673:preset-change', onPresetEvent);
    return () => {
      mo.disconnect();
      window.removeEventListener('duolabmeng673:preset-change', onPresetEvent);
    };
  }, []);

  const activePreset = useMemo(
    () => presets.find((p) => p.slug === activeSlug) ?? presets[0],
    [presets, activeSlug],
  );

  const horizon = useMemo(
    () => parseColor(activePreset?.horizonColor ?? '#5227FF', [0.32, 0.15, 1.0]),
    [activePreset?.horizonColor],
  );
  const wave = useMemo(
    () => parseColor(activePreset?.waveColor ?? '#C084FC', [0.75, 0.52, 0.99]),
    [activePreset?.waveColor],
  );
  const crest = useMemo(
    () => parseColor(isDark ? (activePreset?.crestColor ?? '#F3E8FF') : '#FFFFFF', [1, 1, 1]),
    [isDark, activePreset?.crestColor],
  );

  const settings = {
    horizon,
    wave,
    crest,
    lightMode: !isDark,
    speed: activePreset?.speed ?? 0.48,
    amplitude: Math.max(0, activePreset?.amplitude ?? 2.4),
    waveScale: Math.max(0.01, activePreset?.waveScale ?? 0.58),
    waveRatio: 0.9,
    swell: activePreset?.swell ?? 32,
    turbulence: activePreset?.turbulence ?? 20,
    tilt: (clamp(52, 10, 85) * Math.PI) / 180,
    zoom: 1.14,
    height: 6.8,
    fogDepth: 26,
    relief: 1,
    lightAngle: ((activePreset?.lightAngle ?? 145) * Math.PI) / 180,
    sheen: 0.42,
    brightness: isDark ? 0.96 : 1.06,
    opacity: isDark ? 0.94 : 0.88,
    grain: 0.2,
    steps: QUALITY_STEPS,
    intro: true,
    mouseInteraction: true,
    parallaxStrength: 0.5,
    mouseStrength: 0.6,
    swellOnClick: true,
    dpr: MAX_WAVE_DPR,
  };

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const wakeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    wakeRef.current?.();
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const canvas = document.createElement('canvas');
    canvas.className = CANVAS;
    container.appendChild(canvas);

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    });
    if (!gl) {
      canvas.remove();
      return undefined;
    }

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) {
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
      if (program) gl.deleteProgram(program);
      canvas.remove();
      return undefined;
    }
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, 'aPosition');
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      canvas.remove();
      return undefined;
    }

    const uniformNames = [
      'uResolution', 'uTime', 'uClock', 'uAmplitude', 'uWaveScale', 'uWaveRatio',
      'uSwell', 'uTurbulence', 'uHeight', 'uTilt', 'uZoom', 'uLook', 'uFogDepth',
      'uBrightness', 'uOpacity', 'uGrain', 'uHorizon', 'uWave', 'uCrest',
      'uBackground', 'uOpaque', 'uLight', 'uSun', 'uRelief', 'uSheen',
      'uSteps', 'uStride', 'uIntro', 'uSwells', 'uSwellWidth',
    ] as const;
    const u: Record<string, WebGLUniformLocation | null> = {};
    for (const name of uniformNames) u[name] = gl.getUniformLocation(program, name);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(program);

    const swellData = new Float32Array(MAX_SWELLS * 3);
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const init = settingsRef.current;
    const state = {
      width: 1,
      height: 1,
      cssWidth: 0,
      cssHeight: 0,
      time: 0,
      clock: 0,
      last: 0,
      lastFrameAt: 0,
      raf: 0,
      visible: true,
      introAt: -1,
      pointer: [0.5, 0.5] as [number, number],
      inside: false,
      look: [0, 0] as [number, number],
      steer: [0, 0] as [number, number],
      swells: [] as Swell[],
      quiet: 0,
      seen: null as typeof settings | null,
      presetKey: `${init.horizon.join(',')}|${init.wave.join(',')}|${init.crest.join(',')}`,
      cur: {
        horizon: [...init.horizon] as RGB,
        wave: [...init.wave] as RGB,
        crest: [...init.crest] as RGB,
        amplitude: init.amplitude,
        waveScale: init.waveScale,
        swell: init.swell,
        turbulence: init.turbulence,
        lightAngle: init.lightAngle,
        speed: init.speed,
        morphing: false,
      },
    };

    const fit = () => {
      const s = settingsRef.current;
      const ratio = Math.min(window.devicePixelRatio || 1, s.dpr);
      const width = Math.max(1, Math.round(state.cssWidth * ratio));
      const height = Math.max(1, Math.round(state.cssHeight * ratio));
      if (width === state.width && height === state.height) return;
      state.quiet = 0;
      state.width = width;
      state.height = height;
      canvas.width = width;
      canvas.height = height;
    };

    const introProgress = (s: typeof settings, reduced: boolean) => {
      if (!s.intro || reduced || state.introAt < 0) return 1;
      return clamp((state.clock - state.introAt) / INTRO_SECONDS, 0, 1);
    };

    const render = (reduced: boolean) => {
      const s = settingsRef.current;
      const cur = state.cur;
      gl.viewport(0, 0, state.width, state.height);
      gl.uniform2f(u.uResolution, state.width, state.height);
      gl.uniform1f(u.uTime, state.time);
      gl.uniform1f(u.uClock, state.clock);
      gl.uniform1f(u.uAmplitude, cur.amplitude);
      gl.uniform1f(u.uWaveScale, cur.waveScale);
      gl.uniform1f(u.uWaveRatio, s.waveRatio);
      gl.uniform1f(u.uSwell, cur.swell);
      gl.uniform1f(u.uTurbulence, cur.turbulence);
      gl.uniform1f(u.uHeight, s.height);
      gl.uniform1f(u.uTilt, s.tilt);
      gl.uniform1f(u.uZoom, s.zoom);
      gl.uniform2f(u.uLook, state.look[0], state.look[1]);
      gl.uniform1f(u.uFogDepth, s.fogDepth);
      gl.uniform1f(u.uBrightness, s.brightness);
      gl.uniform1f(u.uOpacity, s.opacity);
      gl.uniform1f(u.uGrain, s.grain);
      gl.uniform3fv(u.uHorizon, cur.horizon);
      gl.uniform3fv(u.uWave, cur.wave);
      gl.uniform3fv(u.uCrest, cur.crest);
      gl.uniform3f(u.uBackground, 0, 0, 0);
      gl.uniform1f(u.uOpaque, 0);
      gl.uniform1f(u.uLight, s.lightMode ? 1 : 0);
      const elevation = 0.52;
      const angle = cur.lightAngle + state.steer[0] * s.mouseStrength * 2;
      const altitude = elevation - state.steer[1] * s.mouseStrength * 0.7;
      gl.uniform3f(
        u.uSun,
        Math.cos(altitude) * Math.cos(angle),
        Math.cos(altitude) * Math.sin(angle),
        Math.sin(altitude),
      );
      gl.uniform1f(u.uRelief, s.relief);
      gl.uniform1f(u.uSheen, s.sheen);
      gl.uniform1f(u.uSteps, s.steps);
      const slope =
        cur.amplitude *
        ((cur.waveScale / 7) * (1 + Math.abs(cur.swell) / 20) +
          ((cur.waveScale * s.waveRatio) / 3) * (1 + Math.abs(cur.turbulence) / 23));
      const progress = introProgress(s, reduced);
      const shown = Math.min(1, progress / 0.22);
      const crest = 160 * Math.pow(3 / 160, easeInOut(Math.max(0, (progress - 0.1) / 0.9)));
      const settle = clamp((progress - 0.75) / 0.25, 0, 1);
      gl.uniform3f(u.uIntro, shown * shown * (3 - 2 * shown), crest, 1 - settle * settle * (3 - 2 * settle));
      swellData.fill(0);
      let swellPeak = 0;
      state.swells.forEach((swell, index) => {
        const age = state.clock - swell.at;
        const life = age / SWELL_SECONDS;
        const envelope = (1 - Math.exp(-age / 0.25)) * Math.pow(1 - life, 1.6);
        const lift = cur.amplitude * SWELL_GAIN * (swell.scale ?? 1) * envelope;
        swellData.set([swell.x - age * 12, swell.y, lift], index * 3);
        swellPeak = Math.max(swellPeak, lift);
      });
      gl.uniform3fv(u.uSwells, swellData);
      gl.uniform1f(u.uSwellWidth, SWELL_WIDTH);
      gl.uniform1f(u.uStride, 0.9 / Math.max(1, (slope + (swellPeak * 0.86) / SWELL_WIDTH) / 1.5));
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const tick = (now: number) => {
      state.raf = 0;
      if (!state.visible || document.hidden) return;
      const s = settingsRef.current;
      const elapsed = now - state.lastFrameAt;
      if (state.lastFrameAt > 0 && elapsed < MIN_FRAME_MS - 0.5) {
        state.raf = requestAnimationFrame(tick);
        return;
      }
      // Lock steady 30 fps phase without accelerating on preset/settings changes
      state.lastFrameAt = state.lastFrameAt > 0 ? now - (elapsed % MIN_FRAME_MS) : now;
      const dt = state.last ? Math.min((now - state.last) / 1000, 0.1) : 0;
      state.last = now;
      const reduced = prefersReduced();
      state.clock += dt;
      if (state.introAt < 0) state.introAt = state.clock;
      if (!reduced) state.time += dt * state.cur.speed;

      const nextPresetKey = `${s.horizon.join(',')}|${s.wave.join(',')}|${s.crest.join(',')}`;
      if (nextPresetKey !== state.presetKey) {
        state.presetKey = nextPresetKey;
        if (!reduced) {
          state.swells.push({ x: 4, y: 2, at: state.clock, scale: 0.36 });
          if (state.swells.length > MAX_SWELLS) state.swells.shift();
        }
      }

      const colorMorphK = reduced ? 1 : 1 - Math.exp(-dt / 0.14);
      const motionMorphK = reduced ? 1 : 1 - Math.exp(-dt / 0.55);
      const cur = state.cur;
      let colorDiff = 0;
      for (let i = 0; i < 3; i++) {
        cur.horizon[i] = lerp(cur.horizon[i], s.horizon[i], colorMorphK);
        cur.wave[i] = lerp(cur.wave[i], s.wave[i], colorMorphK);
        cur.crest[i] = lerp(cur.crest[i], s.crest[i], colorMorphK);
        colorDiff +=
          Math.abs(cur.horizon[i] - s.horizon[i]) +
          Math.abs(cur.wave[i] - s.wave[i]) +
          Math.abs(cur.crest[i] - s.crest[i]);
      }
      cur.amplitude = lerp(cur.amplitude, s.amplitude, motionMorphK);
      cur.swell = lerp(cur.swell, s.swell, motionMorphK);
      cur.turbulence = lerp(cur.turbulence, s.turbulence, motionMorphK);
      cur.lightAngle = lerp(cur.lightAngle, s.lightAngle, motionMorphK);
      cur.speed = lerp(cur.speed, s.speed, motionMorphK);
      const propDiff =
        colorDiff +
        Math.abs(cur.amplitude - s.amplitude) +
        Math.abs(cur.swell - s.swell) * 0.05 +
        Math.abs(cur.lightAngle - s.lightAngle);
      cur.morphing = propDiff > 0.002;

      const steering = s.mouseInteraction && state.inside && !reduced;
      const target = steering ? state.pointer : [0.5, 0.5];
      const ease = 1 - Math.exp(-dt / 0.45);
      const goalX = (target[0] - 0.5) * s.parallaxStrength * 0.35;
      const goalY = (target[1] - 0.5) * s.parallaxStrength * 0.18;
      state.look[0] += (goalX - state.look[0]) * ease;
      state.look[1] += (goalY - state.look[1]) * ease;
      const moving = Math.abs(goalX - state.look[0]) + Math.abs(goalY - state.look[1]) > 0.0002;

      const steerEase = 1 - Math.exp(-dt / 0.6);
      const steerX = steering ? state.pointer[0] - 0.5 : 0;
      const steerY = steering ? 0.5 - state.pointer[1] : 0;
      state.steer[0] += (steerX - state.steer[0]) * steerEase;
      state.steer[1] += (steerY - state.steer[1]) * steerEase;
      const turning = Math.abs(steerX - state.steer[0]) + Math.abs(steerY - state.steer[1]) > 0.0005;
      state.swells = state.swells.filter((swell) => state.clock - swell.at < SWELL_SECONDS);

      const still = reduced;
      const transient = moving || turning || cur.morphing || state.swells.length > 0 || introProgress(s, reduced) < 1;
      if (state.seen !== s || transient || !still) state.quiet = 0;
      else state.quiet += 1;
      state.seen = s;
      if (state.quiet > 3) return;

      state.raf = requestAnimationFrame(tick);
      fit();
      render(reduced);
    };

    const wake = () => {
      if (state.raf || !state.visible || document.hidden) return;
      state.last = 0;
      state.raf = requestAnimationFrame(tick);
    };
    wakeRef.current = wake;

    const measure = () => {
      state.cssWidth = container.clientWidth;
      state.cssHeight = container.clientHeight;
      state.quiet = 0;
      wake();
    };

    const local = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) / Math.max(rect.width, 1),
        y: (event.clientY - rect.top) / Math.max(rect.height, 1),
        inside:
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom,
      };
    };

    const onMove = (event: PointerEvent) => {
      const point = local(event);
      const was = state.inside;
      state.inside = point.inside;
      if (point.inside) state.pointer = [point.x, point.y];
      if ((point.inside || was) && settingsRef.current.mouseInteraction) wake();
    };

    const onLeave = () => {
      state.inside = false;
      wake();
    };

    const onDown = (event: PointerEvent) => {
      const s = settingsRef.current;
      if (!s.swellOnClick || event.button !== 0 || prefersReduced()) return;
      if (
        event.target instanceof Element &&
        event.target.closest('a, button, input, textarea, select, label, [role="button"]')
      ) {
        return;
      }
      const point = local(event);
      if (!point.inside) return;
      const ground = groundAt([point.x, point.y], state.width / Math.max(state.height, 1), s.height, s.zoom, s.tilt, state.look);
      if (!ground) return;
      state.swells.push({ x: ground[0], y: ground[1], at: state.clock });
      if (state.swells.length > MAX_SWELLS) state.swells.shift();
      wake();
    };

    const visibility = new IntersectionObserver((entries) => {
      state.visible = entries.some((entry) => entry.isIntersecting);
      wake();
    });
    visibility.observe(container);
    const sizes = new ResizeObserver(measure);
    sizes.observe(container);
    measure();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    document.addEventListener('mouseleave', onLeave);
    state.raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(state.raf);
      wakeRef.current = null;
      document.removeEventListener('visibilitychange', wake);
      visibility.disconnect();
      sizes.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      document.removeEventListener('mouseleave', onLeave);
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    };
  }, []);

  return <div ref={containerRef} className={[ROOT, className].filter(Boolean).join(' ')} />;
}
