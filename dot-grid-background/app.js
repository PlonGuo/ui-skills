const canvas = document.querySelector('#dot-grid');
const context = canvas.getContext('2d', { alpha: false });

const settings = {
  spacing: 29,
  dotRadius: 1.25,
  baseColor: [157, 162, 172],
  baseAlpha: 0.37,
  hoverRadius: 170,
  pixelRatioCap: 2,
};

const pointer = {
  x: -10_000,
  y: -10_000,
  active: false,
};

let width = 0;
let height = 0;
let frame = 0;
let redrawPending = false;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, settings.pixelRatioCap);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  draw();
}

function draw() {
  redrawPending = false;
  context.fillStyle = '#191b1f';
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
document.addEventListener('visibilitychange', () => {
  if (document.hidden && frame) cancelAnimationFrame(frame);
  if (!document.hidden) draw();
});

resize();
