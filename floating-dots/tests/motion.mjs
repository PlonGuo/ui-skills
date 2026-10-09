import assert from 'node:assert/strict';
import { stepPoints } from '../motion.js';

function makePoint(homeX, homeY) {
  return { homeX, homeY, x: homeX, y: homeY, vx: 0, vy: 0, phase: 0, speed: 1, alpha: 0.4, size: 1 };
}

function baseParams(overrides = {}) {
  return {
    width: 800, height: 600, time: 0,
    driftSpeed: 9, noiseScale: 0.0006, detailScale: 0.0015, detailWeight: 0.4,
    homeStiffness: 1.6, damping: 2.4,
    repelRadius: 190, repelStrength: 900, maxSpeed: 260,
    // How far a dot may wander from home before the field is considered
    // to be draining away. Roughly one grid cell.
    spacingBound: 34,
    pointer: { x: -10000, y: -10000, active: false },
    ...overrides,
  };
}

const dt = 1 / 60;

// --- 1. Points stay near home over a long run ---
// This is the anti-random-walk guarantee. Without the home spring the
// dots would wander off and the field would drain to its edges.
{
  const points = [];
  for (let i = 0; i < 400; i += 1) {
    // Keep every home inside the 800x600 field: a home outside the bounds
    // would be clamped at an edge and could never be returned to.
    points.push(makePoint(20 + (i % 20) * 28, 20 + Math.floor(i / 20) * 28));
  }
  const field = baseParams();
  for (let frame = 0; frame < 3600; frame += 1) { // 60 seconds
    field.time = frame * dt;
    stepPoints(points, field, dt);
    for (const p of points) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), 'coordinates must stay finite');
  }
  let worst = 0;
  for (const p of points) worst = Math.max(worst, Math.hypot(p.x - p.homeX, p.y - p.homeY));
  assert.ok(worst < field.spacingBound, `dots should stay in their neighbourhood; worst excursion ${worst}`);
}

// --- 2. Review Focus #5: points actually move ---
{
  const points = [makePoint(400, 300)];
  const field = baseParams();
  const start = { x: points[0].x, y: points[0].y };
  for (let frame = 0; frame < 120; frame += 1) {
    field.time = frame * dt;
    stepPoints(points, field, dt);
  }
  const travelled = Math.hypot(points[0].x - start.x, points[0].y - start.y);
  assert.ok(travelled > 0.5, `point should drift away from home, moved only ${travelled}`);
}

// --- 3. Fluid feel: the flow field varies smoothly in space ---
// This is the difference between "water" and "visual static", and it is
// a property of the field itself, so it is asserted directly rather than
// inferred from dot positions. Wavelength is 1/scale, so both scales must
// stay well above the dot spacing or neighbours will disagree.
{
  const field = baseParams();
  const spacing = 34;
  const sample = [];
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const x = 400 + col * spacing;
      const y = 300 + row * spacing;
      sample.push([x, y]);
    }
  }
  const angleAt = (x, y, time) => {
    const points = [makePoint(x, y)];
    const params = { ...field, time, pointer: { x: -10000, y: -10000, active: false } };
    stepPoints(points, params, dt);
    return Math.atan2(points[0].vy, points[0].vx);
  };
  const angleDelta = (a, b) => { const d = Math.abs(a - b); return d > Math.PI ? Math.PI * 2 - d : d; };

  let worstStep = 0;
  for (const [x, y] of sample) {
    worstStep = Math.max(worstStep, angleDelta(angleAt(x, y, 0), angleAt(x + spacing, y, 0)));
    worstStep = Math.max(worstStep, angleDelta(angleAt(x, y, 0), angleAt(x, y + spacing, 0)));
  }
  assert.ok(worstStep < Math.PI / 3,
    `flow direction must vary smoothly over one grid step; worst delta was ${(worstStep * 180 / Math.PI).toFixed(1)} degrees`);

  // The field must also change over time, or the dots would sit still.
  const centre = angleAt(400, 300, 0);
  let timeDelta = 0;
  for (let t = 0; t < 5; t += 0.25) timeDelta = Math.max(timeDelta, angleDelta(centre, angleAt(400, 300, t)));
  assert.ok(timeDelta > 0.1, 'the flow field must evolve over time');
}

// --- 4. Review Focus: hard position correction — no point inside the field ---
{
  const points = [];
  for (let i = 0; i < 200; i += 1) {
    points.push(makePoint(Math.random() * 800, Math.random() * 600));
  }
  const repelRadius = 190;
  // Teleporting pointer plus a fast sweep is the case that beats force alone.
  for (let frame = 0; frame < 240; frame += 1) {
    const sweep = (frame / 240) * 800;
    const field = baseParams({ pointer: { x: sweep, y: 300, active: true }, time: frame * dt, repelStrength: 900 });
    stepPoints(points, field, dt);
    for (const p of points) {
      const distance = Math.hypot(p.x - sweep, p.y - 300);
      assert.ok(distance >= repelRadius - 0.001,
        `point entered the repulsion field: distance ${distance} < ${repelRadius}`);
    }
  }
}

// --- 5. Field backfills after the pointer leaves ---
{
  const points = [makePoint(400, 300)];
  let field = baseParams({ pointer: { x: 400, y: 300, active: true } });
  for (let frame = 0; frame < 120; frame += 1) {
    field.time = frame * dt;
    stepPoints(points, field, dt);
  }
  const pushed = Math.hypot(points[0].x - 400, points[0].y - 300);
  assert.ok(pushed > 100, 'point should have been pushed out of the field');
  field = baseParams();
  for (let frame = 0; frame < 600; frame += 1) {
    field.time = frame * dt;
    stepPoints(points, field, dt);
  }
  const home = Math.hypot(points[0].x - 400, points[0].y - 300);
  assert.ok(home < 20, `point should settle back near home, ended ${home} away`);
}

// --- 6. dt is clamped so a stalled tab cannot explode the simulation ---
{
  const points = [makePoint(400, 300)];
  const field = baseParams();
  stepPoints(points, field, 5); // a 5 second frame, as after a background tab
  for (const p of points) {
    assert.ok(Number.isFinite(p.x) && Math.abs(p.vx) <= field.maxSpeed + 1,
      'a huge dt must be clamped, not integrated at face value');
  }
}

console.log('PASS motion');
