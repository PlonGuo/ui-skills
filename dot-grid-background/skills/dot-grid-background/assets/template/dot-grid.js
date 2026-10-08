const DEFAULTS = {
  background: '#191b1f',
  spacing: 29,
  dotRadius: 1.25,
  baseAlpha: 0.37,
  hoverRadius: 170,
  pixelRatioCap: 2,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function mountDotGridBackground(container, options = {}) {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError('mountDotGridBackground() expects an HTMLElement.');
  }

  const settings = { ...DEFAULTS, ...options };
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.replaceChildren(canvas);
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas 2D is unavailable.');

  const pointer = { x: -10_000, y: -10_000, active: false };
  let width = 0;
  let height = 0;
  let frame = 0;
  let redrawPending = false;

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, settings.pixelRatioCap);
    const bounds = container.getBoundingClientRect();
    width = Math.max(1, Math.round(bounds.width));
    height = Math.max(1, Math.round(bounds.height));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  function draw() {
    redrawPending = false;
    context.fillStyle = settings.background;
    context.fillRect(0, 0, width, height);
    const firstX = settings.spacing / 2;
    const firstY = settings.spacing / 2;
    const hoverRadiusSquared = settings.hoverRadius * settings.hoverRadius;

    for (let y = firstY; y < height + settings.spacing; y += settings.spacing) {
      for (let x = firstX; x < width + settings.spacing; x += settings.spacing) {
        const dx = x - pointer.x;
        const dy = y - pointer.y;
        const distanceSquared = dx * dx + dy * dy;
        const proximity = pointer.active
          ? 1 - smoothstep(0, hoverRadiusSquared, distanceSquared)
          : 0;
        const glow = proximity * proximity;
        const red = Math.round(157 + 58 * glow);
        const green = Math.round(162 + 58 * glow);
        const blue = Math.round(172 + 83 * glow);
        const alpha = settings.baseAlpha + 0.34 * glow;
        context.beginPath();
        context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
        context.arc(x, y, settings.dotRadius + glow * 0.18, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function requestDraw() {
    if (redrawPending) return;
    redrawPending = true;
    frame = requestAnimationFrame(draw);
  }

  function updatePointer(event) {
    const bounds = canvas.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
    pointer.active = true;
    requestDraw();
  }

  function clearPointer() {
    pointer.active = false;
    pointer.x = -10_000;
    pointer.y = -10_000;
    requestDraw();
  }

  window.addEventListener('resize', resize, { passive: true });
  canvas.addEventListener('pointermove', updatePointer, { passive: true });
  canvas.addEventListener('pointerleave', clearPointer, { passive: true });
  canvas.addEventListener('pointercancel', clearPointer, { passive: true });
  resize();

  return {
    canvas,
    redraw: resize,
    dispose() {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointermove', updatePointer);
      canvas.removeEventListener('pointerleave', clearPointer);
      canvas.removeEventListener('pointercancel', clearPointer);
      if (frame) cancelAnimationFrame(frame);
      if (canvas.parentNode === container) canvas.remove();
    },
  };
}
