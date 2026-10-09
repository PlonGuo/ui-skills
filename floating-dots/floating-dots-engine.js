/**
 * Independent drifting-dot background with a pointer repulsion field.
 * Copyright (c) 2026 PlonGuo. Released under the MIT License.
 * The noise field, motion model and rendering are implemented here
 * without site bundles, third-party libraries, fonts or image assets.
 */

import { stepPoints } from './motion.js';

const DEFAULTS = {
  background: '#191b1f',
  spacing: 34,
  dotRadius: 1.25,
  baseColor: [157, 162, 172],
  baseAlpha: 0.37,
  alphaJitter: 0.15,
  driftSpeed: 9,
  // The two scales below are a coherent pair: the flow direction must not
  // turn sharply over one grid step, or neighbouring dots stop agreeing
  // and the field reads as visual static instead of water. Wavelength is
  // 1/scale, so noiseScale 0.0006 is a ~1670px swell and detailScale
  // 0.0015 is a ~670px ripple. Measured over the 34px spacing these give
  // at most ~35 degrees of turn per step, comfortably inside the 60 degree
  // test bound, while still varying ~125 degrees across 200px so large
  // swirls stay visible. Raising either scale shortens wavelengths and
  // pushes the field toward noise.
  noiseScale: 0.0006,
  detailScale: 0.0015,
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

  // Shared with the motion and event layers. Declared once here; later
  // tasks reuse these bindings rather than redeclaring them.
  const pointer = { x: -10000, y: -10000, active: false };
  let elapsed = 0;
  let sprites = [];
  let frame = 0;
  let previous = 0;
  let frames = 0;
  let running = false;
  let visible = true;
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const ALPHA_TIERS = 8;

  /**
   * Build one pre-rendered dot per alpha tier.
   *
   * Drawing ~2500 arcs per frame is too slow to hold 60fps, and setting
   * globalAlpha per dot breaks canvas batching. Blitting from a small set
   * of pre-rendered dots avoids both costs: the per-dot work in the draw
   * loop becomes a plain drawImage with no state change.
   */
  function buildSprites() {
    sprites = [];
    const radius = Math.max(0.5, finiteOr(settings.dotRadius, DEFAULTS.dotRadius));
    const pad = 2;
    const size = Math.max(1, Math.ceil((radius * 2 + pad * 2) * ratio));
    for (let tier = 0; tier < ALPHA_TIERS; tier += 1) {
      const alpha = (tier + 1) / ALPHA_TIERS;
      const sprite = document.createElement('canvas');
      sprite.width = size;
      sprite.height = size;
      const spriteContext = sprite.getContext('2d');
      spriteContext.setTransform(ratio, 0, 0, ratio, 0, 0);
      spriteContext.fillStyle = `rgba(${settings.baseColor[0]}, ${settings.baseColor[1]}, ${settings.baseColor[2]}, ${alpha})`;
      spriteContext.beginPath();
      spriteContext.arc(radius + pad, radius + pad, radius, 0, Math.PI * 2);
      spriteContext.fill();
      sprites.push({ image: sprite, logicalSize: (radius + pad) * 2 });
    }
  }

  function render() {
    context.fillStyle = settings.background;
    context.fillRect(0, 0, width, height);
    if (!sprites.length) return;
    for (const point of points) {
      const tier = clamp(Math.round(point.alpha * ALPHA_TIERS) - 1, 0, ALPHA_TIERS - 1);
      const sprite = sprites[tier];
      const half = (sprite.logicalSize * point.size) / 2;
      context.drawImage(sprite.image, point.x - half, point.y - half, half * 2, half * 2);
    }
  }

  function animate(timestamp) {
    frame = 0;
    if (disposed || !running) return;
    const dt = previous ? (timestamp - previous) / 1000 : 1 / 60;
    previous = timestamp;
    const step = Math.min(dt, 0.05);
    elapsed += step;
    advance(step);
    render();
    frames += 1;
    frame = window.requestAnimationFrame(animate);
  }

  function start() {
    if (disposed || running) return;
    // Reduced motion means one static frame, never a running loop. The
    // check lives here so every caller inherits it.
    if (motionQuery.matches) { render(); return; }
    running = true;
    previous = 0;
    frame = window.requestAnimationFrame(animate);
  }

  function stop() {
    running = false;
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    previous = 0;
  }

  /** Step the simulation and draw once, without the frame loop. */
  function advanceOnce(dt) {
    if (disposed) return;
    const step = Math.min(dt, 0.05);
    elapsed += step;
    advance(step);
    render();
    frames += 1;
  }

  function renderOnce() {
    render();
  }

  /** Advance the simulation by one step. Called by the frame loop. */
  function advance(dt) {
    if (disposed) return;
    stepPoints(points, {
      width,
      height,
      time: elapsed,
      driftSpeed: finiteOr(settings.driftSpeed, DEFAULTS.driftSpeed),
      noiseScale: finiteOr(settings.noiseScale, DEFAULTS.noiseScale),
      detailScale: finiteOr(settings.detailScale, DEFAULTS.detailScale),
      detailWeight: finiteOr(settings.detailWeight, DEFAULTS.detailWeight),
      homeStiffness: finiteOr(settings.homeStiffness, DEFAULTS.homeStiffness),
      damping: finiteOr(settings.damping, DEFAULTS.damping),
      repelRadius: finiteOr(settings.repelRadius, DEFAULTS.repelRadius),
      repelStrength: finiteOr(settings.repelStrength, DEFAULTS.repelStrength),
      maxSpeed: finiteOr(settings.maxSpeed, DEFAULTS.maxSpeed),
      pointer,
    }, dt);
  }

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
    buildSprites();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    window.removeEventListener('pointermove', pointerMove);
    window.removeEventListener('pointerleave', pointerOut);
    window.removeEventListener('blur', pointerOut);
    document.removeEventListener('visibilitychange', visibilityChange);
    motionQuery.removeEventListener('change', reducedMotionChange);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    if (canvas.parentNode === container) canvas.remove();
    points = [];
    sprites = [];
  }

  function setOptions(partial = {}) {
    if (disposed) return;
    // Rebuilding the point set re-randomises every dot's jitter, phase and
    // alpha, so the whole field visibly jumps. Doing that on every slider
    // change would make the tuning panel useless: you could not tell
    // whether the feel changed because of the parameter or because the
    // dots were rerolled. Only the options that actually define the point
    // set trigger a rebuild; motion-only options take effect on the next
    // frame, and pure presentation options just redraw.
    let needsBuild = false;
    let needsSprites = false;
    let needsRender = false;

    for (const [key, value] of Object.entries(partial)) {
      if (!(key in DEFAULTS)) continue;
      if (key === 'background') {
        if (settings.background !== value) { settings.background = value; needsRender = true; }
        continue;
      }
      if (typeof value === 'number' && !Number.isFinite(value)) continue;
      if (settings[key] === value) continue;
      settings[key] = value;
      if (key === 'spacing' || key === 'maxParticles' || key === 'pixelRatioCap'
        || key === 'baseAlpha' || key === 'alphaJitter') {
        needsBuild = true;
      } else if (key === 'dotRadius' || key === 'baseColor') {
        needsSprites = true;
      } else {
        needsRender = true;
      }
    }

    if (needsBuild) { resize(); return; }
    if (needsSprites) buildSprites();
    if (needsSprites || needsRender) render();
  }

  // --- Event wiring ---------------------------------------------------
  // Every listener is registered on `window` or `document`, never on the
  // canvas. The canvas sits under a content layer and is set to
  // pointer-events:none, so it never receives pointer events at all;
  // listening there would leave the field dead in exactly the
  // configuration this effect is built for. Coordinates are translated
  // from viewport space into container-local space here.

  function pointerMove(event) {
    const bounds = container.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
    pointer.active = true;
    if (motionQuery.matches) render();
  }

  function pointerOut() {
    pointer.active = false;
    pointer.x = -10000;
    pointer.y = -10000;
    if (motionQuery.matches) render();
  }

  function visibilityChange() {
    if (document.hidden) stop(); else start();
  }

  function reducedMotionChange() {
    if (motionQuery.matches) { stop(); render(); } else { start(); }
  }

  function resizeObserverCallback() { resize(); render(); }

  function intersectionCallback(entries) {
    visible = entries[0].isIntersecting;
    if (visible && !document.hidden) start(); else stop();
  }

  const resizeObserver = new ResizeObserver(resizeObserverCallback);
  const intersectionObserver = new IntersectionObserver(intersectionCallback);

  window.addEventListener('pointermove', pointerMove, { passive: true });
  window.addEventListener('pointerleave', pointerOut, { passive: true });
  window.addEventListener('blur', pointerOut);
  document.addEventListener('visibilitychange', visibilityChange);
  // AbortController could cover the DOM listeners above, but not a
  // MediaQueryList, so every listener is removed explicitly instead —
  // that also keeps removal verifiable in a plain DOM stub.
  motionQuery.addEventListener('change', reducedMotionChange);
  resizeObserver.observe(container);
  intersectionObserver.observe(container);

  resize();
  if (!document.hidden) start();

  return {
    canvas,
    ready: Promise.resolve(),
    stats: () => ({
      count: points.length,
      spacing: settings.spacing,
      width,
      height,
      frames,
      running,
      pointer: { ...pointer },
      settings: { ...settings },
    }),
    debugPoints: () => points.map(({ x, y }) => ({ x, y })),
    setOptions,
    start,
    stop,
    advanceOnce,
    renderOnce,
    dispose,
  };
}
