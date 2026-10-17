import assert from 'node:assert/strict';

// Handlers are tracked per type as a list, because more than one effect is
// alive during this test. A plain Map would let the second effect's dispose
// evict the first effect's handlers, and an earlier test would then be
// asserting against a listener that had silently vanished.
const windowListeners = new Map();
const documentListeners = new Map();
const observers = [];
const pendingFrames = new Map();
let nextFrame = 0;

function addListener(store, type, fn) {
  if (!store.has(type)) store.set(type, []);
  const list = store.get(type);
  if (!list.includes(fn)) list.push(fn);
}
function removeListener(store, type, fn) {
  const list = store.get(type);
  if (!list) return;
  const at = list.indexOf(fn);
  if (at >= 0) list.splice(at, 1);
  if (!list.length) store.delete(type);
}
function dispatch(store, type, event) {
  const list = store.get(type);
  assert.ok(list && list.length, `no listener registered for ${type}`);
  for (const fn of [...list]) fn(event);
}
function totalListeners(store) {
  let count = 0;
  for (const list of store.values()) count += list.length;
  return count;
}

function stubCanvas() {
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
    getContext: () => ({
      setTransform() {}, clearRect() {}, fillRect() {}, drawImage() {},
      beginPath() {}, arc() {}, fill() {}, save() {}, restore() {}, moveTo() {}, lineTo() {}, stroke() {},
      fillStyle: '', createRadialGradient: () => ({ addColorStop() {} }),
    }),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    // Real tracking, so "the canvas carries no listener" is actually tested.
    addEventListener(type, fn) { addListener(listeners, type, fn); },
    removeEventListener(type, fn) { removeListener(listeners, type, fn); },
    __listeners: listeners,
  };
}

function stubContainer(x = 0, y = 0, w = 800, h = 600) {
  const children = [];
  // Must be an instance of the stubbed HTMLElement: the engine guards with
  // `instanceof HTMLElement`, which is the correct check for real nodes.
  const node = Object.assign(new globalThis.HTMLElement(), {
    __rect: { left: x, top: y, width: w, height: h },
    offsetWidth: w, offsetHeight: h, clientWidth: w, clientHeight: h,
    children,
    replaceChildren(child) { children.length = 0; if (child) { child.parentNode = node; children.push(child); } },
    getBoundingClientRect() { return node.__rect; },
  });
  return node;
}

globalThis.HTMLElement = class HTMLElement {};
globalThis.window = {
  devicePixelRatio: 1,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  addEventListener(type, fn) { addListener(windowListeners, type, fn); },
  removeEventListener(type, fn) { removeListener(windowListeners, type, fn); },
  requestAnimationFrame(fn) { const id = ++nextFrame; pendingFrames.set(id, fn); return id; },
  cancelAnimationFrame(id) { pendingFrames.delete(id); },
};
globalThis.document = {
  hidden: false,
  createElement: () => stubCanvas(),
  addEventListener(type, fn) { addListener(documentListeners, type, fn); },
  removeEventListener(type, fn) { removeListener(documentListeners, type, fn); },
};
globalThis.ResizeObserver = class {
  constructor(fn) { this.fn = fn; this.target = null; observers.push(this); }
  observe(target) { this.target = target; }
  disconnect() { this.target = null; this.disconnected = true; }
};
globalThis.IntersectionObserver = class {
  constructor(fn) { this.fn = fn; this.target = null; observers.push(this); }
  observe(target) { this.target = target; }
  disconnect() { this.target = null; this.disconnected = true; }
};

const { mountFloatingDots } = await import('../floating-dots-engine.js');

// --- Review Focus #1: the listener lives on window, not on the canvas ---
// The canvas sits beneath a content layer and never receives pointer
// events, so a canvas-scoped listener would leave the field dead in the
// exact configuration this effect exists for.
const effect = mountFloatingDots(stubContainer(40, 20));
await effect.ready;
assert.ok(windowListeners.has('pointermove'),
  'pointermove must be listened for on window, after mount');
assert.equal(effect.canvas.__listeners.size, 0,
  'the canvas must not receive pointer listeners');

// --- coordinate translation: screen point -> canvas-local point ---
dispatch(windowListeners, 'pointermove', { clientX: 340, clientY: 220 });
const pointer = effect.stats().pointer;
assert.equal(pointer.active, true, 'pointer should be active after a move');
assert.equal(pointer.x, 300, 'pointer x must subtract the container left offset');
assert.equal(pointer.y, 200, 'pointer y must subtract the container top offset');

// --- leaving the window clears the field ---
dispatch(windowListeners, 'pointerleave', {});
assert.equal(effect.stats().pointer.active, false, 'leaving should deactivate the field');

// --- reduced motion: static, no frame loop ---
{
  const container = stubContainer();
  const realMatchMedia = globalThis.window.matchMedia;
  globalThis.window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  const motionEffect = mountFloatingDots(container);
  await motionEffect.ready;
  motionEffect.start();
  assert.equal(motionEffect.stats().running, false, 'reduced motion must not start the frame loop');
  globalThis.window.matchMedia = realMatchMedia;
  motionEffect.dispose();
}

// --- hidden document pauses, visible resumes ---
document.hidden = true;
dispatch(documentListeners, 'visibilitychange', {});
assert.equal(effect.stats().running, false, 'hidden document must stop the loop');
document.hidden = false;
dispatch(documentListeners, 'visibilitychange', {});
assert.equal(effect.stats().running, true, 'visible document must resume the loop');

// --- dispose removes every listener it added ---
effect.dispose();
assert.equal(totalListeners(windowListeners), 0, 'dispose must remove window listeners');
assert.equal(totalListeners(documentListeners), 0, 'dispose must remove document listeners');
assert.equal(pendingFrames.size, 0, 'dispose must cancel the pending animation frame');

// --- changing viewport, input type and motion preferences during a mount ---
{
  const mediaListeners = new Map();
  const motionQuery = {
    matches: false,
    addEventListener(type, fn) { addListener(mediaListeners, type, fn); },
    removeEventListener(type, fn) { removeListener(mediaListeners, type, fn); },
  };
  const realMatchMedia = window.matchMedia;
  window.matchMedia = () => motionQuery;
  const container = stubContainer();
  const firstObserver = observers.length;
  const dynamicEffect = mountFloatingDots(container);
  const [resizeObserver, intersectionObserver] = observers.slice(firstObserver);
  try {
    await dynamicEffect.ready;
    assert.equal(resizeObserver.target, container, 'resize must observe the mounted container');
    assert.equal(intersectionObserver.target, container, 'visibility must observe the mounted container');
    assert.equal(dynamicEffect.stats().running, true);
    assert.equal(pendingFrames.size, 1, 'mount must schedule one frame');

    container.__rect.width = 400;
    container.__rect.height = 300;
    resizeObserver.fn();
    assert.equal(dynamicEffect.canvas.width, 400, 'resize must update canvas backing width');
    assert.equal(dynamicEffect.canvas.height, 300, 'resize must update canvas backing height');
    assert.equal(dynamicEffect.stats().width, 400, 'resize must update the pointer coordinate bounds');
    assert.equal(dynamicEffect.stats().height, 300);
    assert.ok(dynamicEffect.debugPoints().every(p => Number.isFinite(p.x) && Number.isFinite(p.y)),
      'resize must retain finite particle positions');

    dispatch(windowListeners, 'pointermove', { clientX: 200, clientY: 150, pointerType: 'touch' });
    assert.equal(dynamicEffect.stats().pointer.active, false, 'touch must not activate pointer following');
    dispatch(windowListeners, 'pointermove', { clientX: 200, clientY: 150, pointerType: 'mouse' });
    const mousePointer = dynamicEffect.stats().pointer;
    assert.equal(mousePointer.active, true);
    dispatch(windowListeners, 'pointermove', { clientX: 10, clientY: 10, pointerType: 'touch' });
    assert.deepEqual(dynamicEffect.stats().pointer, mousePointer, 'touch must not move an active mouse pointer');
    dispatch(windowListeners, 'pointerout', { relatedTarget: {} });
    assert.deepEqual(dynamicEffect.stats().pointer, mousePointer, 'moving between page elements must retain pointer following');
    dispatch(windowListeners, 'pointerout', { relatedTarget: null });
    assert.equal(dynamicEffect.stats().pointer.active, false, 'leaving the document must release pointer following');

    intersectionObserver.fn([{ isIntersecting: false }]);
    assert.equal(dynamicEffect.stats().running, false, 'offscreen effects must pause');
    assert.equal(pendingFrames.size, 0, 'offscreen pause must cancel the pending frame');
    dynamicEffect.start();
    assert.equal(dynamicEffect.stats().running, false, 'explicit start must respect offscreen visibility');
    intersectionObserver.fn([{ isIntersecting: true }]);
    assert.equal(dynamicEffect.stats().running, true, 'reentering the viewport must resume');

    motionQuery.matches = true;
    dispatch(mediaListeners, 'change', {});
    assert.equal(dynamicEffect.stats().running, false, 'enabling reduced motion must pause an active effect');
    assert.equal(pendingFrames.size, 0, 'reduced motion must cancel the pending frame');
    motionQuery.matches = false;
    dispatch(mediaListeners, 'change', {});
    assert.equal(dynamicEffect.stats().running, true, 'disabling reduced motion must resume a visible effect');
    assert.equal(pendingFrames.size, 1, 'resuming must schedule one frame');
  } finally {
    dynamicEffect.dispose();
    window.matchMedia = realMatchMedia;
  }
  assert.equal(totalListeners(mediaListeners), 0, 'dispose must remove motion preference listeners');
  assert.equal(totalListeners(windowListeners), 0, 'dispose must remove dynamic window listeners');
  assert.equal(totalListeners(documentListeners), 0, 'dispose must remove dynamic document listeners');
  assert.ok(resizeObserver.disconnected && intersectionObserver.disconnected, 'dispose must disconnect both observers');
  assert.equal(pendingFrames.size, 0, 'dispose must cancel the resumed frame');
  dynamicEffect.start();
  resizeObserver.fn();
  intersectionObserver.fn([{ isIntersecting: true }]);
  assert.equal(dynamicEffect.stats().running, false, 'callbacks after disposal must not restart the effect');
  assert.equal(pendingFrames.size, 0, 'callbacks after disposal must not schedule frames');
  assert.equal(container.children.length, 0, 'callbacks after disposal must leave the canvas detached');
}

console.log('PASS engine-lifecycle');
