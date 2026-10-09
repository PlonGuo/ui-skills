import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4331/';
// Keep generated evidence away from the user's existing screenshots.
const OUTPUT = process.env.SCREENSHOT_DIR || '/tmp/floating-dots-verification';
await mkdir(OUTPUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const results = {};
const readPixels = () => {
  const canvas = document.querySelector('#backdrop canvas');
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let blue = 0, other = 0, black = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 2] > 50 && data[i + 2] > data[i] * 1.4) blue++;
    else if (Math.max(data[i], data[i + 1], data[i + 2]) > 50) other++;
    if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0) black++;
  }
  return { blue, other, black: black / (data.length / 4) };
};
try {
  const page = await browser.newPage({ viewport: { width: 1740, height: 832 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  assert.deepEqual(errors, [], 'page should render without script errors');
  const pixels = await page.evaluate(readPixels);
  assert.ok(pixels.blue > 700 && pixels.other < 50, `expected blue dashes, got ${JSON.stringify(pixels)}`);
  assert.ok(pixels.black > 0.97, 'the section should have a pure black, sparse background');
  results.pixels = pixels;
  const heading = await page.locator('.title').boundingBox();
  assert.ok(heading.x < 100 && heading.y > 250 && heading.y < 400, 'heading should match the left-aligned reference');
  await page.screenshot({ path: `${OUTPUT}/desktop.png` });

  const movement = await page.evaluate(async () => {
    const canvas = document.querySelector('#backdrop canvas');
    const ctx = canvas.getContext('2d');
    const a = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    await new Promise(resolve => setTimeout(resolve, 450));
    const b = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let changed = 0;
    for (let i = 2; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 12) changed++;
    return changed;
  });
  assert.ok(movement > 500, 'the floating pattern must move');
  results.changedPixels = movement;

  await page.mouse.move(1340, 416);
  await page.waitForTimeout(1600);
  const right = await page.evaluate(() => window.__floatingDotsStats());
  assert.ok(right.ring.screenX > 1100, 'ring should follow the pointer to the right');
  await page.screenshot({ path: `${OUTPUT}/pointer-right.png` });
  await page.mouse.move(380, 416);
  await page.waitForTimeout(1600);
  const left = await page.evaluate(() => window.__floatingDotsStats());
  assert.ok(left.ring.screenX < right.ring.screenX - 500, 'ring should travel across the section');
  assert.ok(left.pointer.active, 'pointer over content must still drive the background');
  await page.screenshot({ path: `${OUTPUT}/pointer-left.png` });
  // Do not navigate away to download. Verify the overlaid link receives input.
  await page.locator('#demo-action').evaluate(a => a.addEventListener('click', event => {
    event.preventDefault(); window.__clickedThrough = true;
  }));
  await page.click('#demo-action');
  assert.equal(await page.evaluate(() => window.__clickedThrough), true, 'content must remain clickable');
  await page.mouse.move(-10, -10);
  await page.waitForTimeout(120);
  assert.equal((await page.evaluate(() => window.__floatingDotsStats())).pointer.active, false, 'leaving the section should restore autonomous motion');
  results.interaction = 'follow, leave and click-through passed';
  await page.close();

  for (const [name, width, height, scale] of [['mobile', 375, 667, 2], ['tablet', 768, 1024, 1], ['retina', 1280, 800, 2]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
    await page.goto(BASE, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name} must not overflow`);
    assert.ok((await page.evaluate(readPixels)).blue > 100, `${name} should render particles`);
    await page.screenshot({ path: `${OUTPUT}/${name}.png` });
    await page.close();
  }
  results.responsive = 'mobile, tablet, retina passed';

  const still = await browser.newPage({ viewport: { width: 900, height: 600 }, reducedMotion: 'reduce' });
  await still.goto(`${BASE}?tune=1`, { waitUntil: 'load' });
  await still.waitForTimeout(200);
  const a = await still.evaluate(readPixels);
  await still.waitForTimeout(400);
  assert.deepEqual(await still.evaluate(readPixels), a, 'reduced motion should stay still');
  assert.ok(a.blue > 300, 'reduced motion must still display the particle field');
  assert.equal(await still.evaluate(() => window.__floatingDotsStats().running), false);
  await still.locator('input[name="ringDisplacement"]').evaluate(input => {
    input.value = '1'; input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.notDeepEqual(await still.evaluate(readPixels), a, 'tuning reduced-motion mode must refresh its static frame');
  assert.equal(await still.evaluate(() => window.__floatingDotsStats().running), false, 'tuning must not start animation for reduced-motion users');
  results.reducedMotion = 'static field passed';
  await still.close();
  console.log(JSON.stringify({ status: 'PASS', ...results, screenshots: OUTPUT }, null, 2));
} finally { await browser.close(); }
