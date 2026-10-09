/**
 * Independent drifting-dot background with a pointer repulsion field.
 * Copyright (c) 2026 PlonGuo. Released under the MIT License.
 * The noise field, motion model and rendering are implemented here
 * without site bundles, third-party libraries, fonts or image assets.
 */

const DEFAULTS = {
  background: '#191b1f',
  spacing: 34,
  dotRadius: 1.25,
  baseColor: [157, 162, 172],
  baseAlpha: 0.37,
  alphaJitter: 0.15,
  driftSpeed: 9,
  // The two scales below are a coherent pair and must stay well above
  // the reciprocal of `spacing`. Wavelength is 1/scale, so noiseScale
  // 0.0022 is a ~455px swell and detailScale 0.006 is a ~167px ripple —
  // roughly 13x and 5x the 34px dot spacing. A detail wavelength near
  // the spacing would give neighbouring dots unrelated directions, which
  // is the dust-in-air look, not water.
  noiseScale: 0.0022,
  detailScale: 0.006,
  detailWeight: 0.4,
  homeStiffness: 1.6,
  damping: 2.4,
  repelRadius: 190,
  repelStrength: 900,
  maxSpeed: 260,
  pixelRatioCap: 2,
  maxParticles: 4000,
};

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** A finite value, or the fallback. Guards every numeric option. */
function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

export function mountFloatingDots(container, options = {}) {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError('mountFloatingDots() expects an HTMLElement.');
  }

  const settings = { ...DEFAULTS, ...options };
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none;';
  container.replaceChildren(canvas);
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas 2D is unavailable.');

  let width = 0;
  let height = 0;
  let ratio = 1;
  let points = [];
  let disposed = false;

  function build() {
    const spacing = Math.max(1, finiteOr(settings.spacing, DEFAULTS.spacing));
    const columns = Math.max(1, Math.ceil(width / spacing));
    const rows = Math.max(1, Math.ceil(height / spacing));
    const count = Math.min(columns * rows, settings.maxParticles);
    const jitter = spacing * 0.5;
    const next = [];
    for (let index = 0; index < count; index += 1) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const homeX = clamp((column + 0.5) * spacing + (Math.random() - 0.5) * jitter, 0, width);
      const homeY = clamp((row + 0.5) * spacing + (Math.random() - 0.5) * jitter, 0, height);
      next.push({
        homeX,
        homeY,
        x: homeX,
        y: homeY,
        vx: 0,
        vy: 0,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 0.8,
        alpha: clamp(
          finiteOr(settings.baseAlpha, DEFAULTS.baseAlpha) + (Math.random() * 2 - 1) * finiteOr(settings.alphaJitter, DEFAULTS.alphaJitter),
          0.05,
          1,
        ),
        size: 0.85 + Math.random() * 0.3,
      });
    }
    points = next;
  }

  function resize() {
    if (disposed) return;
    ratio = Math.min(window.devicePixelRatio || 1, finiteOr(settings.pixelRatioCap, DEFAULTS.pixelRatioCap));
    const bounds = container.getBoundingClientRect();
    width = Math.max(1, Math.round(bounds.width));
    height = Math.max(1, Math.round(bounds.height));
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    build();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (canvas.parentNode === container) canvas.remove();
    points = [];
  }

  function setOptions(partial = {}) {
    if (disposed) return;
    for (const [key, value] of Object.entries(partial)) {
      if (!(key in DEFAULTS)) continue;
      if (key === 'background') { settings[key] = value; continue; }
      if (typeof value === 'number' && !Number.isFinite(value)) continue;
      settings[key] = value;
    }
    resize();
  }

  resize();

  return {
    canvas,
    ready: Promise.resolve(),
    stats: () => ({ count: points.length, spacing: settings.spacing, width, height, settings: { ...settings } }),
    debugPoints: () => points.map(({ x, y }) => ({ x, y })),
    setOptions,
    dispose,
  };
}
