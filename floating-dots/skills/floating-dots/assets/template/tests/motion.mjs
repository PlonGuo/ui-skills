import assert from 'node:assert/strict';
import * as motion from '../motion.js';

assert.equal(typeof motion.createRingState, 'function', 'the field needs a persistent ring, rather than a hard pointer exclusion circle');
assert.equal(typeof motion.stepRingPoints, 'function');
const settings = { ringWidth: 0.15, ringWidth2: 0.05, ringDisplacement: 0.23, followSpeed: 1.212, idleSpeed: 0.603 };
const makePoint = (x, y) => ({ homeX: x, homeY: y, x: x * 1.25, y: y * 1.25, scale: 0, velocity: 0 });
const params = (time, pointer = { active: false }) => ({ time, width: 1740, height: 832, settings, pointer });

// A pointer jump must move the ring gradually, not project every point out instantly.
const ring = motion.createRingState(17);
motion.stepRingPoints([], ring, params(0, { active: true, x: 1450, y: 416 }), 1 / 60);
assert.ok(ring.x > 0 && ring.x < 0.03, `ring should lag the cursor, got ${ring.x}`);
const initial = ring.x;
for (let i = 1; i < 120; i++) motion.stepRingPoints([], ring, params(i / 60, { active: true, x: 1450, y: 416 }), 1 / 60);
assert.ok(ring.x > initial + 0.1, 'ring should eventually follow the pointer');

// Follow response must not double in speed on a 120 Hz display.
const run = fps => {
  const state = motion.createRingState(17);
  for (let i = 0; i < fps; i++) motion.stepRingPoints([], state, params(i / fps, { active: true, x: 1450, y: 416 }), 1 / fps);
  return state.x;
};
assert.ok(Math.abs(run(60) - run(120)) < 0.003, 'follow smoothing should use elapsed time');

// A ring has enlarged dashes at its rim and fine background specks outside it.
const state = motion.createRingState(17);
const points = [makePoint(0.175, 0), makePoint(0.7, 0.7)];
for (let i = 0; i < 60; i++) motion.stepRingPoints(points, state, params(0, { active: true, x: 870, y: 416 }), 1 / 60);
assert.ok(points[0].scale > points[1].scale * 2, 'the rim should be larger than the background');
const unpushed = [makePoint(0.175, 0)];
const unpushedRing = motion.createRingState(17);
for (let i = 0; i < 60; i++) motion.stepRingPoints(unpushed, unpushedRing, { ...params(0, { active: true, x: 870, y: 416 }), settings: { ...settings, ringDisplacement: 0 } }, 1 / 60);
assert.ok(points[0].x > unpushed[0].x, 'the ring should displace rim particles outward relative to their floating positions');
const before = points.map(p => ({ ...p }));
for (let i = 1; i <= 120; i++) motion.stepRingPoints(points, state, params(i / 60), 1 / 60);
assert.ok(points.some((p, i) => Math.hypot(p.x - before[i].x, p.y - before[i].y) > 0.005), 'the floating field should evolve with time');
assert.ok(Math.abs(state.radius - 0.175) > 0.005, 'the ring should breathe');
for (let i = 0; i < 1200; i++) motion.stepRingPoints(points, state, params(i / 30), 1 / 30);
for (const p of points) {
  assert.ok([p.x, p.y, p.scale, p.angle, p.color].every(Number.isFinite), 'all render values must stay finite');
  assert.ok(Math.hypot(p.x - p.homeX * 1.25, p.y - p.homeY * 1.25) < 0.4, 'particles should not drain away');
}
console.log('PASS ring motion');
