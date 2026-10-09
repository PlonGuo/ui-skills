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
    getContext: () => ({ setTransform() {}, clearRect() {}, fillRect() {}, drawImage() {}, fill() {}, beginPath() {}, arc() {}, save() {}, restore() {}, moveTo() {}, lineTo() {}, stroke() {} }),
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
assert.ok(exposed.ringWidth > 0 && exposed.density > 0, 'resolved settings should expose the ring and density controls');
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
const lowCount = opt.stats().count;
opt.setOptions({ density: 260 });
assert.ok(opt.stats().count > lowCount, 'increasing density should produce more particles');
opt.setOptions({ density: Number.NaN });
assert.equal(opt.stats().settings.density, 260, 'setOptions must ignore non-finite values');
opt.stop();
const beforeStaticTune = opt.debugPoints();
opt.setOptions({ ringDisplacement: 1 });
assert.ok(opt.debugPoints().some((p, i) => Math.hypot(p.x - beforeStaticTune[i].x, p.y - beforeStaticTune[i].y) > 1),
  'tuning a paused field should update its static particle positions');
opt.dispose();

// --- bad container ---
assert.throws(() => mountFloatingDots(null), TypeError, 'null container should throw TypeError');
assert.throws(() => mountFloatingDots({}), TypeError, 'non-HTMLElement container should throw TypeError');

// --- Task 4: rendering uses pre-rendered sprites via drawImage ---
{
  const drawCalls = { drawImage: 0, arc: 0, globalAlphaSets: 0 };
  const probe = makeStubContainer(600, 400);
  const originalCreate = globalThis.document.createElement;
  globalThis.document.createElement = function (tag) {
    const node = originalCreate.call(globalThis.document, tag);
    if (tag === 'canvas') {
      node.getContext = () => ({
        setTransform() {}, clearRect() {}, fillRect() {},
        drawImage() { drawCalls.drawImage += 1; },
        arc() { drawCalls.arc += 1; },
        beginPath() {}, fill() {}, save() {}, restore() {}, moveTo() {}, lineTo() {}, stroke() {},
        set globalAlpha(v) { drawCalls.globalAlphaSets += 1; },
        get globalAlpha() { return 1; },
        fillStyle: '', createRadialGradient: () => ({ addColorStop() {} }),
      });
    }
    return node;
  };
  const spriteEffect = mountFloatingDots(probe);
  await spriteEffect.ready;
  // Building the sprites legitimately uses arc() once per tier. Reset the
  // counters so the assertions below measure the per-frame draw pass only.
  drawCalls.drawImage = 0;
  drawCalls.arc = 0;
  drawCalls.globalAlphaSets = 0;
  spriteEffect.renderOnce();
  assert.ok(drawCalls.drawImage > 50, `expected sprite blits, saw ${drawCalls.drawImage}`);
  assert.equal(drawCalls.arc, 0, 'per-dot arc() is too slow at this density; use sprites');
  assert.equal(drawCalls.globalAlphaSets, 0, 'per-dot globalAlpha breaks batching; use alpha-tier sprites');
  spriteEffect.dispose();
  globalThis.document.createElement = originalCreate;
}

// --- Task 4: the frame loop advances the simulation ---
{
  const loopEffect = mountFloatingDots(makeStubContainer(600, 400));
  await loopEffect.ready;
  const framesBefore = loopEffect.stats().frames;
  loopEffect.advanceOnce(1 / 60);
  loopEffect.advanceOnce(1 / 60);
  assert.equal(loopEffect.stats().frames, framesBefore + 2, 'advanceOnce should count frames');
  loopEffect.dispose();
}

console.log('PASS engine-smoke', { canvasesCreated: created.length });
