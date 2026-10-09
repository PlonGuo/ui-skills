import assert from 'node:assert/strict';
import * as field from '../noise-field.js';
assert.equal(typeof field.simplex3D, 'function', 'floating motion needs continuous noise in both space and time');
let changed = 0;
for (let i = 0; i < 100; i++) {
  const x = i * 0.117 - 5;
  const a = field.simplex3D(x, 2.3, 0.4);
  const b = field.simplex3D(x + 0.001, 2.3, 0.4);
  assert.ok(Number.isFinite(a) && Math.abs(a) <= 1.1, 'noise must stay bounded');
  assert.ok(Math.abs(a - b) < 0.02, 'nearby positions must not flicker');
  changed += Math.abs(a - field.simplex3D(x, 2.3, 0.8));
}
assert.ok(changed > 5, 'time must change the floating pattern');
console.log('PASS simplex noise');
