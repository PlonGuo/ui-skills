// Node-side contract test. The engine is DOM-dependent, so this file
// provides a minimal stub and checks the mount/dispose contract only.
// Rendering is verified in the browser (Task 7).
import assert from 'node:assert/strict';

function makeStubCanvas() {
  const listeners = new Map();
  return {
    width: 0, height: 0, style: {}, parentNode: null,
    setAttribute() {},
    remove() {
      const parent = this.parentNode;
      if (parent && Array.isArray(parent.children)) {
        const at = parent.children.indexOf(this);
        if (at >= 0) parent.children.splice(at, 1);
      }
      this.parentNode = null;
    },
    getContext: () => ({ setTransform() {}, clearRect() {}, fillRect() {}, drawImage() {}, fill() {}, beginPath() {}, arc() {}, save() {}, restore() {} }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: this.__w ?? 800, height: this.__h ?? 600 }),
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
    __listeners: listeners,
  };
}

function makeStubContainer(w = 800, h = 600) {
  const children = [];
  // The engine guards on `instanceof HTMLElement`, which is the right check
  // for real DOM nodes. The stub must therefore BE an instance of the stubbed
  // HTMLElement class, not a plain object literal.
  const node = Object.assign(new globalThis.HTMLElement(), {
    __w: w, __h: h,
    offsetWidth: w, offsetHeight: h, clientWidth: w, clientHeight: h,
    children,
    appendChild(child) { child.parentNode = node; children.push(child); },
    replaceChildren(child) { children.length = 0; if (child) { child.parentNode = node; children.push(child); } },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: node.__w, height: node.__h }),
  });
  return node;
}

function installGlobals() {
  const created = [];
  globalThis.HTMLElement = class HTMLElement {};
  globalThis.window = {
    devicePixelRatio: 2,
    innerWidth: 800, innerHeight: 600,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {}, removeEventListener() {},
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
  };
  globalThis.document = {
    hidden: false,
    createElement(tag) { const node = makeStubCanvas(); node.__tag = tag; created.push(node); return node; },
    addEventListener() {}, removeEventListener() {},
  };
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  return created;
}

const created = installGlobals();
const { mountFloatingDots } = await import('../floating-dots-engine.js');

// --- normal mount ---
const container = makeStubContainer(800, 600);
const effect = mountFloatingDots(container);
assert.equal(container.children.length, 1, 'mount should append exactly one canvas');
const canvas = container.children[0];
assert.equal(canvas.width, 1600, 'canvas backing width should be container width x DPR (800 x 2)');
assert.equal(canvas.height, 1200, 'canvas backing height should be container height x DPR (600 x 2)');
assert.equal(canvas.__listeners.size, 0, 'canvas must not receive pointer listeners (background mode)');
await effect.ready;

// --- the resolved settings are observable (the tuning panel reads them) ---
const exposed = effect.stats().settings;
assert.equal(typeof exposed, 'object', 'stats() must expose the resolved settings');
assert.equal(exposed.spacing, 34, 'exposed settings should carry the resolved spacing');
assert.equal(exposed.noiseScale, 0.0006, 'exposed settings should carry the resolved noise scale');
assert.notEqual(exposed, effect.stats().settings, 'settings should be copied, not handed out by reference');

// --- Review Focus #3: double dispose and dispose-after-mount ---
effect.dispose();
effect.dispose();
assert.equal(container.children.length, 0, 'dispose should remove the canvas exactly once');

const early = mountFloatingDots(makeStubContainer());
early.dispose();
await early.ready;
assert.equal(early.canvas.parentNode, null, 'dispose before ready should leave no canvas attached');

// --- Review Focus #2: zero-size container ---
const zero = makeStubContainer(0, 0);
const zeroEffect = mountFloatingDots(zero);
await zeroEffect.ready;
assert.equal(zero.children.length, 1, 'zero-size container should still mount without throwing');
zeroEffect.dispose();

// --- Review Focus #4: tiny viewport must not produce NaN ---
const tiny = makeStubContainer(40, 30);
const tinyEffect = mountFloatingDots(tiny);
await tinyEffect.ready;
const stats = tinyEffect.stats();
assert.ok(Number.isFinite(stats.count), 'particle count must be finite on tiny viewports');
assert.ok(stats.count >= 1, 'tiny viewport should still produce at least one particle');
for (const p of tinyEffect.debugPoints()) {
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), 'particle coordinates must be finite');
}
tinyEffect.dispose();

// --- setOptions contract ---
const opt = mountFloatingDots(makeStubContainer());
await opt.ready;
opt.setOptions({ spacing: 60 });
assert.equal(opt.stats().spacing, 60, 'setOptions should apply the new spacing');
opt.setOptions({ spacing: Number.NaN });
assert.equal(opt.stats().spacing, 60, 'setOptions must ignore non-finite values');
opt.dispose();

// --- bad container ---
assert.throws(() => mountFloatingDots(null), TypeError, 'null container should throw TypeError');
assert.throws(() => mountFloatingDots({}), TypeError, 'non-HTMLElement container should throw TypeError');

console.log('PASS engine-smoke', { canvasesCreated: created.length });
