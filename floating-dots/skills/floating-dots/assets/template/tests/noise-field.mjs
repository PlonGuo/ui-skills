import assert from 'node:assert/strict';
import { createNoise2D, fbm } from '../noise-field.js';

const noise = createNoise2D(1337);

// 1. Range: stays inside -1..1
for (let i = 0; i < 20000; i += 1) {
  const value = noise(Math.random() * 1000 - 500, Math.random() * 1000 - 500);
  assert.ok(value >= -1 && value <= 1, `noise out of range: ${value}`);
}

// 2. Continuity: nearby inputs give nearby outputs. This is the property
// that separates a noise field from random numbers, and the reason
// neighbouring dots move together instead of jittering independently.
let maxNeighbourDelta = 0;
for (let i = 0; i < 20000; i += 1) {
  const x = Math.random() * 200 - 100;
  const y = Math.random() * 200 - 100;
  const delta = Math.abs(noise(x, y) - noise(x + 0.01, y + 0.01));
  maxNeighbourDelta = Math.max(maxNeighbourDelta, delta);
}
assert.ok(maxNeighbourDelta < 0.05, `noise is not continuous; max delta over 0.01 step was ${maxNeighbourDelta}`);

// 3. Determinism: same seed, same field
const again = createNoise2D(1337);
for (let i = 0; i < 200; i += 1) {
  const x = i * 1.37, y = i * 0.71;
  assert.equal(noise(x, y), again(x, y), 'same seed must reproduce the same field');
}

// 4. Different seeds diverge
const other = createNoise2D(99);
let differences = 0;
for (let i = 0; i < 200; i += 1) {
  if (noise(i * 1.37, i * 0.71) !== other(i * 1.37, i * 0.71)) differences += 1;
}
assert.ok(differences > 150, 'different seeds should produce different fields');

// 5. fbm stays bounded and is continuous
for (let i = 0; i < 5000; i += 1) {
  const x = Math.random() * 300 - 150;
  const y = Math.random() * 300 - 150;
  const value = fbm(noise, x, y, 3);
  assert.ok(value >= -1.5 && value <= 1.5, `fbm out of range: ${value}`);
  assert.ok(Math.abs(value - fbm(noise, x + 0.01, y + 0.01, 3)) < 0.1, 'fbm must be continuous');
}

// 6. Integer lattice points still land inside -1..1 (the hash path with
//    fx=fy=0 skips interpolation entirely, so it is a distinct code path).
for (let x = -50; x <= 50; x += 1) {
  for (let y = -50; y <= 50; y += 1) {
    const value = noise(x, y);
    assert.ok(value >= -1 && value <= 1, `integer lattice value out of range at ${x},${y}: ${value}`);
  }
}

console.log('PASS noise-field');
