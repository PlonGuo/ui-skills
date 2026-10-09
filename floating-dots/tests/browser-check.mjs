/**
 * Browser-side verification for the floating-dots showcase.
 *
 * Run with a local server already serving floating-dots/ on 4331:
 *   python3 -m http.server 4331 --directory floating-dots
 *   node floating-dots/tests/browser-check.mjs
 *
 * playwright-core is resolved from the local npx cache rather than added
 * to this repo's dependencies; the effect itself has no dependencies.
 */
import assert from 'node:assert/strict';
import { chromium } from '/Users/plonguo/.npm/_npx/9833c18b2d85bc59/node_modules/playwright-core/index.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4331/';
const REPEL_RADIUS = 190;
const browser = await chromium.launch({ channel: 'chrome' });
const results = {};

/** Count pixels above the threshold: the drawn dots, and nothing else. */
const countLit = (threshold = 60) => {
  const source = document.querySelector('#backdrop canvas');
  const copy = document.createElement('canvas');
  copy.width = source.width;
  copy.height = source.height;
  const ctx = copy.getContext('2d');
  ctx.drawImage(source, 0, 0);
  const data = ctx.getImageData(0, 0, copy.width, copy.height).data;
  let lit = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i] > threshold) lit += 1;
  return lit;
};

// --- desktop, 1280x800 ---
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  assert.deepEqual(errors, [], `page reported errors: ${errors.join(' | ')}`);

  const canvasBox = await page.locator('#backdrop canvas').boundingBox();
  assert.ok(canvasBox && canvasBox.width > 1200 && canvasBox.height > 700,
    `canvas should cover the viewport, got ${JSON.stringify(canvasBox)}`);

  // 1. Static frame: dots must be drawn at all.
  await page.screenshot({ path: 'floating-dots/screenshot.png' });
  const painted = await page.evaluate(countLit);
  assert.ok(painted > 500, `expected drawn dots, counted ${painted} lit pixels`);
  results.paintedPixels = painted;

  // 2. Review Focus #5: the field must actually move. One frame cannot
  //    distinguish "animating" from "frozen", so compare two.
  const diff = await page.evaluate(async () => {
    const source = document.querySelector('#backdrop canvas');
    const grab = () => {
      const copy = document.createElement('canvas');
      copy.width = source.width;
      copy.height = source.height;
      copy.getContext('2d').drawImage(source, 0, 0);
      return copy.getContext('2d').getImageData(0, 0, copy.width, copy.height).data;
    };
    const a = grab();
    await new Promise(resolve => setTimeout(resolve, 400));
    const b = grab();
    let changed = 0;
    for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 12) changed += 1;
    return changed;
  });
  assert.ok(diff > 300, `field appears frozen; only ${diff} pixels changed between frames`);
  results.movedPixels = diff;

  // 3. Repulsion: the core of the field around the pointer must be empty.
  await page.mouse.move(640, 400);
  await page.waitForTimeout(900);
  const hole = await page.evaluate(({ radius }) => {
    const source = document.querySelector('#backdrop canvas');
    const ctx = source.getContext('2d');
    const dpr = source.width / source.getBoundingClientRect().width;
    const r = radius * dpr;
    const cx = 640 * dpr - r;
    const cy = 400 * dpr - r;
    const image = ctx.getImageData(cx, cy, r * 2, r * 2).data;
    let lit = 0;
    for (let y = 0; y < r * 2; y += 1) {
      for (let x = 0; x < r * 2; x += 1) {
        if (Math.hypot(x - r, y - r) > r * 0.72) continue;
        if (image[(y * r * 2 + x) * 4] > 60) lit += 1;
      }
    }
    return lit;
  }, { radius: REPEL_RADIUS });
  assert.equal(hole, 0, `no dot may sit in the repulsion core; found ${hole} lit pixels`);
  results.repulsionCoreLit = hole;
  await page.screenshot({ path: 'floating-dots/screenshot-repel.png' });

  // 4. Review Focus #1: the field still works with the pointer over the
  //    content layer, not over the canvas.
  const titleBox = await page.locator('.title').boundingBox();
  await page.mouse.move(titleBox.x + titleBox.width / 2, titleBox.y + titleBox.height / 2);
  await page.waitForTimeout(500);
  const overContent = await page.evaluate(() => window.__floatingDotsStats().pointer);
  assert.equal(overContent.active, true,
    'pointer over the content layer must still drive the field');
  results.pointerOverContent = overContent;

  // 5. Backfill after the pointer leaves.
  await page.mouse.move(5, 5);
  await page.waitForTimeout(2500);
  const backfilled = await page.evaluate(countLit);
  assert.ok(backfilled > painted * 0.85,
    `field should refill after the pointer leaves; ${backfilled} vs ${painted} lit pixels`);
  results.backfilledPixels = backfilled;

  // 6. The content layer still receives clicks. The flag is set by the
  //    page's own handler in app.js; if the canvas swallowed the event it
  //    would never flip.
  await page.evaluate(() => { window.__clickedThrough = false; });
  await page.click('#demo-action');
  const clickedThrough = await page.evaluate(() => window.__clickedThrough === true);
  assert.equal(clickedThrough, true, 'the button above the canvas must be clickable');
  results.clickThrough = true;

  await page.close();
}

// --- small viewport: no horizontal overflow ---
{
  const page = await browser.newPage({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 1 });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `horizontal overflow of ${overflow}px at 375px wide`);
  results.narrowViewport = 'ok';
  await page.close();
}

// --- reduced motion: one static frame, no loop ---
{
  const page = await browser.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const running = await page.evaluate(() => window.__floatingDotsStats().running);
  assert.equal(running, false, 'reduced motion must not run the frame loop');
  const still = await page.evaluate(async () => {
    const source = document.querySelector('#backdrop canvas');
    const copy = document.createElement('canvas');
    copy.width = source.width;
    copy.height = source.height;
    const ctx = copy.getContext('2d');
    ctx.drawImage(source, 0, 0);
    const a = ctx.getImageData(0, 0, copy.width, copy.height).data;
    await new Promise(resolve => setTimeout(resolve, 400));
    ctx.drawImage(source, 0, 0);
    const b = ctx.getImageData(0, 0, copy.width, copy.height).data;
    let changed = 0;
    for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i]) changed += 1;
    return changed;
  });
  assert.equal(still, 0, 'reduced motion must render exactly once and stay still');
  const stillPainted = await page.evaluate(countLit);
  assert.ok(stillPainted > 200, `reduced motion should still draw the field, saw ${stillPainted}`);
  results.reducedMotion = { running: false, changedPixels: still, painted: stillPainted };
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ status: 'PASS', ...results }, null, 2));
