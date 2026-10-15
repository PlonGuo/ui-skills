// Node-side contract test for the photo wall engine.
//
// The engine needs a canvas and a real image decode, neither of which exists
// under plain Node. This file stubs the small surface the engine touches and
// checks the mount / resize / input / dispose contract. The actual rendering
// is verified in the browser pass (tests/browser-check.mjs).

import assert from 'node:assert/strict';

// --- minimal DOM stubs -------------------------------------------------
class StubClassList {
  constructor() { this.set = new Set(); }
  add(...c) { c.forEach(x => this.set.add(x)); }
  remove(...c) { c.forEach(x => this.set.delete(x)); }
  contains(c) { return this.set.has(c); }
}

class StubElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.style = { cssText: '', setProperty() {} };
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.classList = new StubClassList();
    this.attributes = new Map();
    this.listeners = new Map();
    this.textContent = '';
    this._rect = { left: 0, top: 0, width: 900, height: 600 };
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }

  appendChild(child) {
    if (child.parentNode) child.remove();
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  replaceChildren(...nodes) {
    for (const c of this.children) c.parentNode = null;
    this.children = [];
    for (const n of nodes) this.appendChild(n);
  }

  remove() {
    const parent = this.parentNode;
    if (!parent) return;
    const at = parent.children.indexOf(this);
    if (at >= 0) parent.children.splice(at, 1);
    this.parentNode = null;
  }

  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }

  removeEventListener(type, fn) {
    this.listeners.get(type)?.delete(fn);
  }

  listenerCount(type) { return this.listeners.get(type)?.size ?? 0; }

  getBoundingClientRect() { return { ...this._rect }; }

  // The engine draws through a 2D context. Record the calls so the test can
  // assert that drawing happened without asserting on pixels.
  getContext() {
    const calls = [];
    const ctx = new Proxy({ calls }, {
      get(target, prop) {
        if (prop === 'calls') return calls;
        if (prop === 'canvas') return target.canvas;
        if (prop in target) return target[prop];
        return (...args) => { calls.push([prop, ...args]); };
      },
      set(target, prop, value) { target[prop] = value; return true; },
    });
    return ctx;
  }
}

class StubImage extends StubElement {
  constructor() {
    super('img');
    this.naturalWidth = 1200;
    this.naturalHeight = 800;
    this.src = '';
    this.decoding = '';
  }
}

const documentListeners = new Map();
const windowListeners = new Map();

const stubDocument = {
  hidden: false,
  createElement: tag => (tag === 'img' ? new StubImage() : new StubElement(tag)),
  addEventListener(type, fn) {
    if (!documentListeners.has(type)) documentListeners.set(type, new Set());
    documentListeners.get(type).add(fn);
  },
  removeEventListener(type, fn) { documentListeners.get(type)?.delete(fn); },
  listenerCount: type => documentListeners.get(type)?.size ?? 0,
};

globalThis.document = stubDocument;
globalThis.HTMLElement = StubElement;
globalThis.Image = StubImage;
globalThis.devicePixelRatio = 2;
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
globalThis.addEventListener = (type, fn) => {
  if (!windowListeners.has(type)) windowListeners.set(type, new Set());
  windowListeners.get(type).add(fn);
};
globalThis.removeEventListener = (type, fn) => windowListeners.get(type)?.delete(fn);
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const { mountPhotoWall } = await import('../photo-wall-engine.js');

// --- tests --------------------------------------------------------------

// 1. Type guard.
assert.throws(() => mountPhotoWall({}), TypeError, 'rejects a non-element container');

// 2. Mount appends exactly one canvas and reports state.
const host = new StubElement('div');
host._rect = { left: 0, top: 0, width: 1200, height: 700 };
const wall = mountPhotoWall(host, { imageUrl: './assets/photo.jpg' });
assert.equal(host.children.length, 1, 'mounts a single canvas');
assert.equal(host.children[0].tagName, 'CANVAS');
assert.equal(host.children[0].getAttribute('aria-hidden'), 'true');

const stats = wall.stats();
assert.equal(stats.width, 1200);
assert.equal(stats.height, 700);
assert.ok(stats.cardCount >= 8, `lays out a wall of cards (got ${stats.cardCount})`);
assert.ok(Math.abs(stats.driftRate - stats.settings.driftDegPerSec) < 1e-6
  || stats.driftRate === 0, 'idle rate starts at (or eases toward) the configured drift');

// 3. Cards are pinned to a helix: finite geometry, positive size, and spread
// over both the angle and the height of the spiral.
for (const c of stats.cards) {
  assert.ok(Number.isFinite(c.angle) && Number.isFinite(c.y), 'card position is finite');
  assert.ok(Number.isFinite(c.radius) && c.radius > 0, 'card sits at a positive radius');
  assert.ok(c.w > 0 && c.h > 0, 'card has positive size');
}
const angles = stats.cards.map(c => c.angle);
const heights = stats.cards.map(c => c.y);
assert.ok(Math.max(...angles) - Math.min(...angles) > Math.PI,
  'cards wrap at least half a turn around the axis');
assert.ok(Math.max(...heights) - Math.min(...heights) > 0.5,
  'cards span a usable height on the spiral');

// 5. Idle motion: the helix turns in place, like a spinning DNA strand.
// Measured on the reference recording, the large cards in front travel left
// while the small cards behind travel right. Turning in place is the only
// motion that sends the two strands in opposite directions.
for (let i = 0; i < 120; i += 1) wall.advanceOnce(1 / 30);
const s2 = wall.stats();
assert.ok(s2.driftRate > 0, 'idle turn rate is positive');
assert.ok(Math.abs(s2.driftRate - s2.settings.driftDegPerSec) < 0.05,
  'the idle rate settles on the configured turn rate');
assert.ok(s2.velocityNear.x < 0, `the near strand travels left (got ${s2.velocityNear.x.toFixed(1)})`);
assert.ok(s2.velocityFar.x > 0, `the far strand travels right (got ${s2.velocityFar.x.toFixed(1)})`);
// As it turns, the photos climb the spiral: the near strand moves up as well
// as left, like steps carried up a turning staircase.
assert.ok(s2.velocityNear.y < 0, `the near strand climbs (got ${s2.velocityNear.y.toFixed(1)})`);
assert.ok(Math.abs(s2.velocityNear.y) > Math.abs(s2.velocityNear.x) * 0.2,
  'the climb is a visible share of the near strand motion, not a rounding error');
assert.ok(s2.angleDeg > 0, 'the helix turns while idle');

// 6. Wheel input changes the spin, and the sign follows the wheel direction.
const before = wall.stats().spin;
windowListeners.get('wheel').forEach(fn => fn({ deltaY: 120, deltaMode: 0, preventDefault() {} }));
const after = wall.stats().spin;
assert.notEqual(before, after, 'wheel input changes spin');
assert.ok(after > before, 'wheel down accelerates the climb (positive spin)');

windowListeners.get('wheel').forEach(fn => fn({ deltaY: -120, deltaMode: 0, preventDefault() {} }));
assert.ok(wall.stats().spin < after, 'wheel up slows or reverses the climb (negative spin)');

// 7. Line-mode deltas are scaled, not used raw.
const spinBefore = wall.stats().spin;
windowListeners.get('wheel').forEach(fn => fn({ deltaY: 3, deltaMode: 1, preventDefault() {} }));
assert.ok(wall.stats().spin - spinBefore > 3 * 0.12 * 2, 'line deltas are converted to pixels');

// 8. Spin decays back toward the idle rate.
wall.setOptions({ maxSpin: 200 });
windowListeners.get('wheel').forEach(fn => fn({ deltaY: 3000, deltaMode: 0, preventDefault() {} }));
const spun = Math.abs(wall.stats().spin);
assert.ok(spun <= 200.0001, 'spin is clamped to maxSpin');
// The reference settles from a burst back to the idle rate in about 0.8 s.
for (let i = 0; i < 60; i += 1) wall.advanceOnce(1 / 60);
assert.ok(Math.abs(wall.stats().spin) < 5,
  `spin decays to near rest within 1 s (got ${wall.stats().spin.toFixed(2)})`);
for (let i = 0; i < 120; i += 1) wall.advanceOnce(1 / 60);
assert.equal(wall.stats().spin, 0, 'spin reaches exactly zero');

// 9. Resize rebuilds the layout for the new box.
host._rect = { left: 0, top: 0, width: 640, height: 900 };
wall.setOptions({});
const s3 = wall.stats();
assert.equal(s3.width, 640);
assert.equal(s3.height, 900);
assert.ok(s3.cardCount >= 8, 'layout survives a resize');

// 10. renderOnce draws without advancing.
const angleBefore = wall.stats().angleDeg;
wall.renderOnce();
assert.equal(wall.stats().angleDeg, angleBefore, 'renderOnce does not advance time');

// 11. dispose removes the canvas and every listener.
wall.dispose();
assert.equal(host.children.length, 0, 'dispose removes the canvas');
assert.equal(windowListeners.get('wheel')?.size ?? 0, 0, 'dispose removes the wheel listener');
assert.equal(host.listenerCount('touchstart'), 0, 'dispose removes touch listeners');
assert.equal(document.listenerCount('visibilitychange'), 0, 'dispose removes visibility listener');

// 12. dispose is idempotent.
wall.dispose();

console.log('engine-contract: ok');
