/**
 * Independent image-shaped particle renderer.
 * Copyright (c) 2026 PlonGuo. Released under the MIT License.
 * Shapes, sampling, motion and drawing are implemented here without site bundles.
 */

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function cubicPoint(segment, t) {
  const u = 1 - t;
  return [
    u ** 3 * segment[0] + 3 * u ** 2 * t * segment[2] + 3 * u * t ** 2 * segment[4] + t ** 3 * segment[6],
    u ** 3 * segment[1] + 3 * u ** 2 * t * segment[3] + 3 * u * t ** 2 * segment[5] + t ** 3 * segment[7],
  ];
}

function braces(count) {
  // A mathematical curve for one brace, mirrored to create the second one.
  const curve = [
    [-.2, -.72, -.38, -.72, -.42, -.64, -.42, -.47],
    [-.42, -.47, -.42, -.19, -.42, -.11, -.57, 0],
    [-.57, 0, -.42, .11, -.42, .19, -.42, .47],
    [-.42, .47, -.42, .64, -.38, .72, -.2, .72],
  ];
  return Array.from({ length: count }, (_, index) => {
    const side = index % 2 ? 1 : -1;
    const progress = (Math.floor(index / 2) / Math.ceil(count / 2)) * curve.length;
    const point = cubicPoint(curve[Math.min(3, Math.floor(progress))], progress % 1);
    return [side * (point[0] - .3), point[1]];
  });
}

function cube(count) {
  // A projected cube: six outer vertices and three visible interior edges.
  const top = [0, -.72], left = [-.62, -.36], right = [.62, -.36];
  const bottomLeft = [-.62, .36], bottomRight = [.62, .36], bottom = [0, .72], center = [0, 0];
  const edges = [[top, left], [top, right], [left, bottomLeft], [right, bottomRight],
    [bottomLeft, bottom], [bottomRight, bottom], [left, center], [right, center], [center, bottom]];
  return Array.from({ length: count }, (_, index) => {
    const edge = edges[index % edges.length];
    const t = Math.floor(index / edges.length) / Math.max(1, Math.ceil(count / edges.length) - 1);
    return [lerp(edge[0][0], edge[1][0], t), lerp(edge[0][1], edge[1][1], t)];
  });
}

function sampleImage(imageUrl, signal) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    const clean = () => {
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener('abort', abort);
    };
    const abort = () => {
      clean(); image.src = '';
      reject(new DOMException('Particle loading was cancelled.', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });
    image.onerror = () => { clean(); reject(new Error(`Cannot load particle image: ${imageUrl}`)); };
    image.onload = () => {
      clean();
      try {
        const sample = document.createElement('canvas');
        sample.width = sample.height = 240;
        const context = sample.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0, 240, 240);
        const pixels = context.getImageData(0, 0, 240, 240).data;
        const points = [];
        for (let y = 0; y < 240; y += 2) for (let x = 0; x < 240; x += 2) {
          const i = (y * 240 + x) * 4;
          if (pixels[i + 3] > 64 && Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) < 235) {
            points.push([(x - 120) / 120, (y - 120) / 120]);
          }
        }
        if (!points.length) throw new Error('Particle image contains no visible foreground.');
        resolve(points);
      } catch (error) { reject(error); }
    };
    image.src = imageUrl;
  });
}

/** Mount after the container has dimensions. Await ready and dispose on unmount. */
export function mountMorphingParticles(container, {
  trigger = container,
  shape = 'braces',
  imageUrl,
  density = 50,
  particlesScale = .6,
  cameraZoom = 8.8,
  pixelRatio = Math.min(window.devicePixelRatio || 1, 2),
  colors = ['#676A72', '#FF4641', '#346BF1'],
} = {}) {
  if (!(container instanceof HTMLElement) || !container.offsetWidth || !container.offsetHeight) {
    throw new Error('Mount particles in a container with a nonzero width and height.');
  }
  if (!(trigger instanceof HTMLElement)) throw new Error('Particle trigger must be an HTML element.');
  if (!['braces', 'cube'].includes(shape)) throw new Error('Choose the braces or cube shape, or provide imageUrl.');
  if (![density, particlesScale, cameraZoom, pixelRatio].every(value => Number.isFinite(value) && value > 0)) {
    throw new Error('Particle sizing and density parameters must be positive finite numbers.');
  }

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'display:block;width:100%;height:100%;';
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable.');
  container.append(canvas);
  const controller = new AbortController();
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false, visible = false, initialized = false;
  let hovered = false, focused = false, progress = 0, pulse = 0;
  let width = 0, height = 0, frame = null, previous = 0, elapsed = 0;
  let customPoints = null, particles = [];
  const pointer = { x: -1000, y: -1000 };

  function build() {
    const area = width * height;
    const count = Math.round(clamp(area / 480 * (density / 50), 300, 1800));
    const featureCount = Math.round(count * .38);
    const targets = customPoints || (shape === 'cube' ? cube(featureCount) : braces(featureCount));
    const columns = Math.max(1, Math.round(Math.sqrt(count * width / height)));
    const rows = Math.ceil(count / columns);
    particles = Array.from({ length: count }, (_, index) => {
      const cell = index * 7919 % count;
      const homeX = ((cell % columns) + .15 + Math.random() * .7) / columns * width;
      const homeY = (Math.floor(cell / columns) + .15 + Math.random() * .7) / rows * height;
      const target = targets[index % targets.length];
      const feature = index < featureCount;
      return { homeX, homeY, feature, target,
        x: homeX, y: homeY, phase: Math.random() * Math.PI * 2,
        speed: .5 + Math.random(), radius: (feature ? .72 : .52) + Math.random() * .35,
        opacity: (feature ? .6 : .42) + Math.random() * .35,
        color: feature ? (shape === 'cube' ? colors[1] : colors[2]) : colors[index % 11 === 0 ? 1 : 0],
      };
    });
  }

  function resize() {
    if (disposed) return;
    const nextWidth = container.clientWidth, nextHeight = container.clientHeight;
    if (!nextWidth || !nextHeight) { stop(); return; }
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth; height = nextHeight;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    build();
    draw(0);
    schedule();
  }

  function draw(delta) {
    context.clearRect(0, 0, width, height);
    if (!initialized) return;
    const active = hovered || focused;
    progress += ((active ? 1 : 0) - progress) * (motion.matches ? 1 : 1 - Math.exp(-delta * 5));
    pulse *= Math.exp(-delta * 2.8);
    elapsed += delta;
    const scale = Math.min(width * .43, height * .43) * 8.8 / cameraZoom;
    for (const particle of particles) {
      const drift = motion.matches ? 0 : Math.sin(elapsed * particle.speed + particle.phase);
      const targetX = width / 2 + particle.target[0] * scale;
      const targetY = height / 2 + particle.target[1] * scale;
      const blend = particle.feature ? .96 + progress * .04 : 0;
      let x = lerp(particle.homeX, targetX, blend) + drift * 4;
      let y = lerp(particle.homeY, targetY, blend) + Math.cos(elapsed * .7 + particle.phase) * (motion.matches ? 0 : 5);
      if (!motion.matches) {
        const dx = x - pointer.x, dy = y - pointer.y;
        const distance = Math.hypot(dx, dy);
        const repulsion = Math.max(0, 1 - distance / 110) ** 2 * 22;
        x += dx / Math.max(1, distance) * repulsion;
        y += dy / Math.max(1, distance) * repulsion;
        x += (x - width / 2) * pulse * .1;
        y += (y - height / 2) * pulse * .1;
      }
      const settle = delta === 0 || motion.matches ? 1 : 1 - Math.exp(-delta * 7);
      particle.x = lerp(particle.x, x, settle);
      particle.y = lerp(particle.y, y, settle);
      context.fillStyle = particle.feature && progress > .3 ? colors[1] : particle.color;
      context.globalAlpha = particle.opacity * (particle.feature ? .8 + progress * .2 : 1 - progress * .18);
      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius * particlesScale / .6, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function animate(timestamp) {
    frame = null;
    if (disposed || !visible || document.hidden) return;
    const delta = previous ? Math.min((timestamp - previous) / 1000, .05) : 1 / 60;
    previous = timestamp;
    draw(delta);
    schedule();
  }
  function schedule() {
    if (disposed || !initialized || !visible || document.hidden || !container.clientWidth || !container.clientHeight) return;
    if (motion.matches) { draw(0); return; }
    if (frame === null) frame = requestAnimationFrame(animate);
  }
  function stop() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null; previous = 0;
  }
  function updateState() {
    pulse = motion.matches ? 0 : 1;
    schedule();
  }
  const enter = () => { hovered = true; updateState(); };
  const leave = () => { hovered = false; pointer.x = pointer.y = -1000; updateState(); };
  const focus = () => { focused = true; updateState(); };
  const blur = event => { if (!trigger.contains(event.relatedTarget)) { focused = false; updateState(); } };
  const move = event => {
    const bounds = container.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left; pointer.y = event.clientY - bounds.top;
  };
  const visibility = () => { if (document.hidden) stop(); else schedule(); };
  const reducedMotion = () => { stop(); schedule(); };
  const intersection = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) schedule(); else stop();
  });
  const dimensions = new ResizeObserver(resize);

  function dispose() {
    if (disposed) return;
    disposed = true;
    stop(); controller.abort();
    intersection.disconnect(); dimensions.disconnect();
    document.removeEventListener('visibilitychange', visibility);
    motion.removeEventListener('change', reducedMotion);
    trigger.removeEventListener('mouseenter', enter);
    trigger.removeEventListener('mouseleave', leave);
    trigger.removeEventListener('pointermove', move);
    trigger.removeEventListener('focusin', focus);
    trigger.removeEventListener('focusout', blur);
    canvas.remove(); particles = [];
  }

  resize();
  intersection.observe(container); dimensions.observe(container);
  document.addEventListener('visibilitychange', visibility);
  motion.addEventListener('change', reducedMotion);
  trigger.addEventListener('mouseenter', enter);
  trigger.addEventListener('mouseleave', leave);
  trigger.addEventListener('pointermove', move);
  trigger.addEventListener('focusin', focus);
  trigger.addEventListener('focusout', blur);
  const ready = (imageUrl ? sampleImage(imageUrl, controller.signal) : Promise.resolve(null)).then(points => {
    if (disposed) return;
    customPoints = points; initialized = true; build(); draw(0); schedule();
  }).catch(error => { dispose(); throw error; });
  return { ready, dispose };
}
