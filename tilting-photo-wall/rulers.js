// Side rulers.
//
// Measured from the reference screenshot at a 1509 x 715 CSS viewport:
//   - ticks are 2 CSS px tall, every 20 CSS px
//   - most are 25 px long; every 5th is 50 px
//   - one accent-coloured tick sits at the vertical middle, 80 px long
//   - the accent tick is NOT part of the 20 px grid: it is the centre marker
//
// The 20 px rhythm anchors to the viewport's vertical centre, and the centre
// marker is drawn on top of the tick that lands there.

const INK_MINOR = 'minor';
const INK_MAJOR = 'major';

export function mountRulers(root, options = {}) {
  if (!(root instanceof HTMLElement)) {
    throw new TypeError('mountRulers(root): root must be an HTMLElement');
  }

  const settings = {
    gap: 20,
    minor: 25,
    major: 50,
    accent: 80,
    ...options,
  };

  const layers = [];

  function build(side) {
    const layer = document.createElement('div');
    layer.className = `ruler ruler--${side}`;
    layer.setAttribute('aria-hidden', 'true');
    root.appendChild(layer);
    layers.push(layer);
    return layer;
  }

  const left = build('left');
  const right = build('right');

  function draw() {
    const height = root.getBoundingClientRect().height || globalThis.innerHeight || 0;
    if (!height) return;
    const centre = height / 2;
    // Anchor the rhythm to the centre so the pattern stays put across resizes.
    const steps = Math.ceil(height / settings.gap / 2) + 2;

    for (const layer of layers) {
      const frag = document.createDocumentFragment();
      for (let i = -steps; i <= steps; i += 1) {
        const y = centre + i * settings.gap;
        if (y < -settings.gap || y > height + settings.gap) continue;
        // Every 5th tick from the centre is a major tick (2*50 = 100 device px,
        // matching the measured 5-tick period).
        const index = Math.abs(i);
        const kind = index % 5 === 0 ? INK_MAJOR : INK_MINOR;
        const tick = document.createElement('span');
        tick.className = `ruler__tick ruler__tick--${kind}`;
        tick.style.top = `${y}px`;
        frag.appendChild(tick);
      }
      // Centre marker, drawn last so it sits on top of the tick at the centre.
      const marker = document.createElement('span');
      marker.className = 'ruler__tick ruler__tick--accent ruler__tick--red';
      marker.style.top = `${centre}px`;
      frag.appendChild(marker);
      layer.replaceChildren(frag);
    }
  }

  draw();

  let frame = 0;
  function onResize() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      draw();
    });
  }
  globalThis.addEventListener('resize', onResize);

  return {
    redraw: draw,
    dispose() {
      globalThis.removeEventListener('resize', onResize);
      if (frame) cancelAnimationFrame(frame);
      for (const layer of layers) layer.remove();
      layers.length = 0;
    },
  };
}
