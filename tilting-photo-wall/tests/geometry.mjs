// Pure-geometry checks on the measured reference values.
//
// Everything here is arithmetic on constants plus a headless run of the real
// projection maths: no DOM, no canvas.

import assert from 'node:assert/strict';

// --- the engine really projects in 3D ----------------------------------
const { mountPhotoWall, WALL_DEFAULTS, buildCards } = await import('../photo-wall-engine.js');

// Minimal element stub: enough for mountPhotoWall to run its setup path.
class StubElement {
  constructor(w = 1509, h = 715) {
    this._w = w; this._h = h;
    this.children = [];
    this.clientWidth = w; this.clientHeight = h;
    this.style = {};
  }
  getBoundingClientRect() { return { width: this._w, height: this._h, left: 0, top: 0 }; }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { this.children = this.children.filter(x => x !== c); }
  addEventListener() {}
  removeEventListener() {}
}

const stubCtx = new Proxy({}, {
  get: (_, key) => {
    if (key === 'canvas') return null;
    return () => {};
  },
  set: () => true,
});

globalThis.HTMLElement = StubElement;
globalThis.Image = class {
  constructor() { this.naturalWidth = 4; this.naturalHeight = 4; }
  addEventListener() {}
  set src(_v) {}
};
globalThis.document = {
  createElement: () => ({
    style: { cssText: '' },
    setAttribute() {},
    getContext: () => stubCtx,
    remove() {},
    addEventListener() {},
  }),
  addEventListener() {},
  removeEventListener() {},
  hidden: false,
};
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
globalThis.devicePixelRatio = 1;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};

const container = new StubElement();
const wall = mountPhotoWall(container);

// Every card must project to a quad whose opposite edges are NOT parallel.
// That non-parallelism is the whole point: a 2D transform of a rectangle can
// never produce it.
const quads = wall.quads();
// The October 15 reference has large foreground cards spread across the
// viewport, with their centres descending from left to right. The old camera
// put the foreground above/below the viewport and left tiny cards in the middle.
const foreground = quads.filter(q => q.near).map(q => ({
  x: q.pts.reduce((s, p) => s + p[0], 0) / 4 / 1509,
  y: q.pts.reduce((s, p) => s + p[1], 0) / 4 / 715,
  width: (Math.max(...q.pts.map(p => p[0])) - Math.min(...q.pts.map(p => p[0]))) / 1509,
})).filter(q => q.y > 0 && q.y < 1 && q.width > 0.12).sort((a, b) => a.x - b.x);
assert.ok(foreground.length >= 4, `foreground spans the frame with four large cards (got ${foreground.length})`);
assert.ok(foreground[0].x < 0.2 && foreground.at(-1).x > 0.85,
  'foreground reaches both edges instead of clustering in the centre');
assert.ok(foreground.at(-1).y - foreground[0].y > 0.45,
  'foreground descends diagonally from upper left to lower right');
assert.ok(quads.length > 5, `cards project to screen quads (got ${quads.length})`);

function edgeAngle(a, b) {
  return ((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI + 180) % 180;
}
function minAngleDiff(a, b) {
  const d = Math.abs(a - b) % 180;
  return Math.min(d, 180 - d);
}
function quadArea([a, b, c, d]) {
  return Math.abs((b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0])) / 2;
}

// Only measure the slope of an edge long enough for the angle to be meaningful.
// A card seen nearly edge-on has an edge a few pixels long, whose slope is set
// by pixel quantisation rather than by perspective.
const MIN_EDGE_PX = 40;
function measurable(q) {
  const [tl, tr, br, bl] = q;
  return Math.hypot(tr[0] - tl[0], tr[1] - tl[1]) > MIN_EDGE_PX
      && Math.hypot(bl[0] - tl[0], bl[1] - tl[1]) > MIN_EDGE_PX;
}

const measured = quads.filter(q => measurable(q.pts));
assert.ok(measured.length > 5,
  `enough cards are seen face-on to measure (got ${measured.length} of ${quads.length})`);

let converging = 0;
let maxDiv = 0;
for (const q of measured) {
  const [tl, tr, br, bl] = q.pts;
  const dTop = minAngleDiff(edgeAngle(tl, tr), edgeAngle(bl, br));
  const dLeft = minAngleDiff(edgeAngle(tl, bl), edgeAngle(tr, br));
  const d = Math.max(dTop, dLeft);
  if (d > 0.05) converging += 1;
  maxDiv = Math.max(maxDiv, d);
}
assert.ok(converging > measured.length * 0.5,
  `most face-on cards show perspective convergence (${converging} of ${measured.length})`);
assert.ok(maxDiv > 0.5,
  `the convergence is measurable, not floating-point dust (max ${maxDiv.toFixed(2)} deg)`);

// --- depth behaviour ---------------------------------------------------
// A rotating ring has to bring cards toward the camera and carry them away.
// Follow one specific card through a quarter turn: if the projection ignored
// depth, its size would never change.
const cam = wall.stats();
assert.ok(cam.probe.depth > 0, 'the near point of the helix is in front of the camera');

const areasById = () => {
  const m = new Map();
  for (const q of wall.quads()) m.set(q.index, quadArea(q.pts));
  return m;
};

// Turn the helix: each card stays at its height and swings around the axis.
// A card swinging from the front toward the back shrinks: with depth ignored
// its size would never change.
const series = new Map();
const STEPS = 18;
for (let i = 0; i < STEPS; i += 1) {
  wall.advanceOnce(1);                     // 7 deg per step at the default rate
  for (const [idx, area] of areasById()) {
    if (!series.has(idx)) series.set(idx, []);
    series.get(idx).push(area);
  }
}

let best = null;
for (const [idx, list] of series) {
  if (list.length < 6) continue;
  const ratio = Math.max(...list) / Math.max(Math.min(...list), 1);
  if (!best || ratio > best.ratio) best = { idx, ratio, list };
}
assert.ok(best, 'cards stay on screen long enough to follow');
assert.ok(best.ratio > 1.4,
  `a card changes size as it swings round, so the projection is 3D (ratio ${best.ratio.toFixed(2)})`);

wall.dispose();

// --- layout -------------------------------------------------------------
// The set contains all fifteen subjects from the supplied reference.
const H = WALL_DEFAULTS.helix;
const total = Math.round(H.turns * H.cardsPerTurn);
assert.equal(total, 15, 'all reference subjects have a card');
const built = buildCards(total, 7, WALL_DEFAULTS);
assert.ok(built.every(c => c.w > 0 && c.h > 0), 'every card has a positive size');

// Successive images stay one step apart, including the top/bottom seam.
const length = H.pitch * H.turns;
for (let i = 0; i < built.length; i += 1) {
  const next = built[(i + 1) % built.length];
  const gap = ((built[i].y - next.y) % length + length) % length;
  assert.ok(Math.abs(gap - length / total) < 1e-9, 'uniform photo spacing across the seam');
}

// Strands: the rise per turn leaves clear black between turns, so the near
// and far halves read as two strands, as in the reference.
const cardH = WALL_DEFAULTS.cardWidth / WALL_DEFAULTS.cardAspect;
assert.ok(H.pitch > cardH * 1.5,
  `turns are separated by a visible gap (pitch ${H.pitch} vs card height ${cardH.toFixed(3)})`);

// --- the loop -------------------------------------------------------------
// After card 1 climbs off the top, it comes back at the bottom one regular
// step behind card 15, so the set replays 1..15 forever. Check the seam is
// exactly one step and the fade hides the wrap.
{
  const wall2 = mountPhotoWall(new StubElement());
  const st = wall2.stats();
  const L = st.loopLength;
  const step = H.pitch / H.cardsPerTurn;
  assert.ok(Math.abs(L - total * step) < 1e-9,
    'the loop length is exactly fifteen steps, so the seam is the same size as every other gap');

  // Run past several loops and record which card leads (sits highest).
  const leaders = [];
  let last = null;
  const loopSec = (H.turns * 360) / st.settings.driftDegPerSec;
  const dt = loopSec / 400;
  for (let i = 0; i < 400 * 2.2; i += 1) {
    wall2.advanceOnce(dt);
    const s = wall2.stats();
    let best = -Infinity; let lead = -1;
    for (const c of s.cards) {
      let y = c.y + s.rise;
      y -= Math.round(y / L) * L;
      if (y > best) { best = y; lead = c.index; }
    }
    if (lead !== last) { leaders.push(lead + 1); last = lead; }
  }
  const seq = leaders.join(' ');
  assert.ok(seq.includes('1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 1 2 3'),
    `cards lead in order and the set restarts at 1 (got ${seq})`);
  const stable = wall2.quads();
  wall2.advanceOnce(loopSec);
  const repeated = wall2.quads();
  assert.deepEqual(repeated.map(q => q.index), stable.map(q => q.index), 'one loop restores the same visible photos');
  for (let i = 0; i < stable.length; i += 1) {
    for (let corner = 0; corner < 4; corner += 1) {
      assert.ok(Math.hypot(...stable[i].pts[corner].slice(0, 2).map((v, k) => v - repeated[i].pts[corner][k])) < 0.001,
        'a complete loop returns each photo to its original projected position');
    }
  }
  wall2.dispose();
}

console.log('geometry: ok');
