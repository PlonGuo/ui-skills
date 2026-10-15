import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4342/';
const OUTPUT = process.env.SCREENSHOT_DIR || '/tmp/tilting-photo-wall-verification';
await mkdir(OUTPUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
const results = {};

// Reads the wall canvas and reports how much of it is lit photo pixels.
const readPixels = () => {
  const canvas = document.querySelector('#wall canvas');
  const ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let lit = 0;
  let black = 0;
  let redness = 0;
  for (let i = 0; i < data.length; i += 4) {
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    if (max > 40) {
      lit += 1;
      // Generated samples include warm colors; use them to confirm the images
      // decoded rather than leaving dark loading placeholders.
      if (data[i] > data[i + 2] + 12) redness += 1;
    } else if (max < 8) black += 1;
  }
  const total = data.length / 4;
  return { lit: lit / total, black: black / total, redness: redness / total };
};

try {
  const page = await browser.newPage({ viewport: { width: 1509, height: 715 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  assert.deepEqual(errors, [], 'page renders without script errors');

  // The photo has to have decoded and reached the canvas.
  await page.waitForFunction(() => window.__photoWall?.ready === true, null, { timeout: 8000 });
  const pixels = await page.evaluate(readPixels);
  results.pixels = pixels;
  assert.ok(pixels.black > 0.4, `background is mostly black (got ${pixels.black.toFixed(3)})`);
  assert.ok(pixels.lit > 0.05, `cards cover a visible share of the frame (got ${pixels.lit.toFixed(3)})`);
  assert.ok(pixels.redness > 0.01, `the photo decoded, not a flat fill (got ${pixels.redness.toFixed(3)})`);

  assert.equal(await page.locator('.ruler').count(), 0, 'reference composition has no side rulers');

  // Reproduce the affine texture bug using an all-white source. Sample just
  // inside each straight edge of the projected card, away from rounded corners.
  const textureCoverage = await page.evaluate(async () => {
    const { mountPhotoWall } = await import('./photo-wall-engine.js');
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0';
    document.body.append(host);
    const wall = mountPhotoWall(host, {
      imageUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="white"/></svg>'),
      images: [], farBrightness: 1, endFade: 0, cornerRadius: 0,
      helix: { turns: 1, cardsPerTurn: 1 },
      startAngleDeg: 125, cardWidth: 1.2, cameraFacing: 0,
      axisRollDeg: 0, axisPitchDeg: 0, cardTilt: 0,
      camera: { distance: 2.5, fovDeg: 45 },
    });
    wall.stop();
    await new Promise((resolve, reject) => {
      const deadline = performance.now() + 3000;
      function check() {
        if (wall.ready) resolve();
        else if (performance.now() > deadline) reject(new Error('White texture did not load'));
        else requestAnimationFrame(check);
      }
      check();
    });
    wall.renderOnce();
    const ctx = wall.canvas.getContext('2d');
    const misses = [];
    let samples = 0;
    for (const { index, pts: [a, b, c, d] } of wall.quads()) {
      for (const [u, v] of [0.2, 0.35, 0.5, 0.65, 0.8].flatMap(t => [[t, 0.015], [t, 0.985], [0.015, t], [0.985, t]])) {
        const z = a[2] + u * (b[2] - a[2]) + v * (d[2] - a[2]);
        const p = [0, 1].map(k => (a[k] * a[2] + u * (b[k] * b[2] - a[k] * a[2]) + v * (d[k] * d[2] - a[k] * a[2])) / z);
        if (p[0] < 1 || p[0] >= innerWidth - 1 || p[1] < 1 || p[1] >= innerHeight - 1) continue;
        const centre = p.map(n => Math.floor(n) + 0.5);
        const quad = [a, b, c, d];
        const edgeDistance = Math.min(...quad.map((from, i) => {
          const to = quad[(i + 1) % 4];
          return Math.abs((to[0] - from[0]) * (from[1] - centre[1])
            - (from[0] - centre[0]) * (to[1] - from[1])) / Math.hypot(to[0] - from[0], to[1] - from[1]);
        }));
        // A pixel within 1px of the silhouette is intentionally anti-aliased.
        if (edgeDistance < 1) continue;
        samples += 1;
        const pixel = ctx.getImageData(Math.floor(p[0]), Math.floor(p[1]), 1, 1).data;
        if (pixel[0] < 220) misses.push({ index, u, v, value: pixel[0] });
      }
    }
    wall.dispose(); host.remove();
    return { misses, samples };
  });
  assert.ok(textureCoverage.samples >= 12, 'coverage samples reach all card edges');
  assert.deepEqual(textureCoverage.misses, [], 'texture fills all four edges of the perspective card');
  await page.screenshot({ path: `${OUTPUT}/desktop.png` });

  // Idle motion must turn the helix in place: near strand left, far strand
  // right, preserving the approved motion model.
  const drift = await page.evaluate(async () => {
    const start = window.__photoWallStats();
    await new Promise(r => setTimeout(r, 900));
    const end = window.__photoWallStats();
    return { start, end };
  });
  results.drift = { v: drift.end.velocity, degPerSec: drift.end.degPerSec };
  results.strands = { near: drift.end.velocityNear, far: drift.end.velocityFar };
  assert.ok(drift.end.velocityNear.x < 0, `near strand travels left (got ${drift.end.velocityNear.x.toFixed(1)})`);
  assert.ok(drift.end.velocityFar.x > 0, `far strand travels right (got ${drift.end.velocityFar.x.toFixed(1)})`);
  assert.ok(drift.end.velocityNear.y < 0, `near strand climbs the spiral (got ${drift.end.velocityNear.y.toFixed(1)})`);

  // The canvas must actually change over time.
  const moved = await page.evaluate(async () => {
    const canvas = document.querySelector('#wall canvas');
    const ctx = canvas.getContext('2d');
    const a = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    await new Promise(r => setTimeout(r, 700));
    const b = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let changed = 0;
    for (let i = 0; i < a.length; i += 4 * 7) {
      if (Math.abs(a[i] - b[i]) > 10 || Math.abs(a[i + 1] - b[i + 1]) > 10) changed += 1;
    }
    return changed;
  });
  results.changedPixels = moved;
  assert.ok(moved > 400, `the wall animates while idle (got ${moved} changed samples)`);

  // Wheel input adds angular speed, and the sign follows the wheel direction.
  const spinDown = await page.evaluate(async () => {
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: 400, bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 60));
    return window.__photoWallStats().spin;
  });
  const spinUp = await page.evaluate(async () => {
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: -800, bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 60));
    return window.__photoWallStats().spin;
  });
  results.spin = { down: spinDown, up: spinUp };
  assert.ok(spinDown > 0, `wheel down accelerates the climb (got ${spinDown.toFixed(2)})`);
  assert.ok(spinUp < 0, `wheel up reverses the climb (got ${spinUp.toFixed(2)})`);

  // Spin decays back to rest.
  const decayed = await page.evaluate(async () => {
    await new Promise(r => setTimeout(r, 1500));
    return window.__photoWallStats().spin;
  });
  results.decayedSpin = decayed;
  assert.ok(Math.abs(decayed) < 3, `spin decays back to rest (got ${decayed.toFixed(2)})`);

  // Layout sweep: the wall must compose sensibly at other sizes.
  for (const [w, h, name] of [[390, 844, 'mobile'], [1024, 768, 'tablet']]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(500);
    const stat = await page.evaluate(() => window.__photoWallStats());
    assert.equal(stat.width, w, `${name}: engine tracks the new width`);
    assert.equal(stat.cardCount, 15, `${name}: all fifteen reference photos remain in the set`);
    const p = await page.evaluate(readPixels);
    assert.ok(p.lit > 0.02, `${name}: cards visible (got ${p.lit.toFixed(3)})`);
    await page.screenshot({ path: `${OUTPUT}/${name}.png` });
    results[name] = { cards: stat.cardCount, lit: p.lit };
  }

  // The loop: run one full cycle of the set at 60 fps and compare consecutive
  // frames. A visible pop at the seam (card 1 wrapping from the top back to
  // the bottom) would show as one frame changing far more than the rest.
  await page.setViewportSize({ width: 1509, height: 715 });
  await page.waitForTimeout(300);
  const loop = await page.evaluate(() => {
    const w = window.__photoWall;
    w.stop();
    const S = w.stats().settings;
    const loopSec = (S.helix.turns * 360) / S.driftDegPerSec;
    const dt = 1 / 60;
    for (let i = 0; i < 120; i += 1) w.advanceOnce(dt);
    const cv = document.querySelector('#wall canvas');
    const ctx = cv.getContext('2d');
    let prev = null;
    const diffs = [];
    const frames = Math.round(loopSec / dt);
    for (let i = 0; i < frames; i += 1) {
      w.advanceOnce(dt);
      if (i % 2) continue;
      w.renderOnce();
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      if (prev) {
        let s = 0; let n = 0;
        for (let k = 0; k < d.length; k += 4 * 17) {
          s += Math.abs(d[k] - prev[k]) + Math.abs(d[k + 1] - prev[k + 1]);
          n += 1;
        }
        diffs.push(s / n);
      }
      prev = d;
    }
    w.start();
    const sorted = [...diffs].sort((a, b) => a - b);
    return { loopSec, median: sorted[sorted.length >> 1], max: sorted[sorted.length - 1] };
  });
  results.loop = loop;
  assert.ok(loop.max < loop.median * 2.5,
    `no frame jumps across a full loop (max ${loop.max.toFixed(2)} vs median ${loop.median.toFixed(2)})`);

  // Reduced motion: a single static frame, no animation loop.
  await page.setViewportSize({ width: 1509, height: 715 });
  const reduced = await browser.newPage({
    viewport: { width: 1509, height: 715 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  await reduced.goto(BASE, { waitUntil: 'load' });
  await reduced.waitForTimeout(800);
  const before = await reduced.evaluate(() => window.__photoWallStats().angleDeg);
  await reduced.waitForTimeout(700);
  const after = await reduced.evaluate(() => window.__photoWallStats().angleDeg);
  results.reducedMotion = { before, after };
  assert.equal(before, after, 'reduced motion holds the wall still');
  await reduced.screenshot({ path: `${OUTPUT}/reduced-motion.png` });
  await reduced.close();

  console.log(JSON.stringify(results, null, 2));
  console.log('browser-check: ok');
} finally {
  await browser.close();
}
