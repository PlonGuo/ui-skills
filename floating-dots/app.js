import { mountFloatingDots } from './floating-dots-engine.js';

const backdrop = document.querySelector('#backdrop');
const effect = mountFloatingDots(backdrop);

window.addEventListener('pagehide', event => {
  if (!event.persisted) effect.dispose();
});

// Prove the field does not steal input. The background layer is
// pointer-events:none, so a click on the button above it must arrive
// normally. The flag is what the browser check reads.
document.querySelector('#demo-action').addEventListener('click', () => {
  window.__clickedThrough = true;
  console.log('Content layer received the click; the background did not intercept it.');
});

// Expose the handle for the browser-side verification in tests/.
window.__floatingDotsStats = () => effect.stats();

// --- Tuning panel -----------------------------------------------------
// An audit tool only. It renders behind ?tune=1 and is deliberately kept
// out of the skill template. Drag the sliders to find the feel, then use
// "Copy current parameters" and hand the values over to be fixed as
// defaults.
if (new URLSearchParams(location.search).has('tune')) {
  // [key, min, max, step]. The noise scales are tiny and their useful
  // range is narrow, so the sliders step in ten-thousandths.
  const spec = [
    ['spacing', 16, 64, 1],
    ['dotRadius', 0.5, 3, 0.05],
    ['baseAlpha', 0.05, 1, 0.01],
    ['alphaJitter', 0, 0.4, 0.01],
    ['driftSpeed', 0, 60, 0.5],
    ['noiseScale', 0.0002, 0.004, 0.0001],
    ['detailScale', 0.0005, 0.006, 0.0001],
    ['detailWeight', 0, 1.2, 0.02],
    ['homeStiffness', 0, 12, 0.1],
    ['damping', 0.2, 8, 0.05],
    ['repelRadius', 20, 400, 2],
    ['repelStrength', 0, 3000, 10],
    ['maxSpeed', 20, 800, 5],
  ];

  const panel = document.createElement('form');
  panel.dataset.tunePanel = '';
  panel.setAttribute('aria-label', 'Effect parameters');
  const current = effect.stats().settings;

  for (const [key, min, max, step] of spec) {
    const label = document.createElement('label');
    label.textContent = key;
    const value = document.createElement('output');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(current[key]);
    input.name = key;
    value.textContent = String(current[key]);
    input.addEventListener('input', () => {
      const next = Number(input.value);
      value.textContent = String(next);
      effect.setOptions({ [key]: next });
    });
    label.append(value, input);
    panel.append(label);
  }

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Copy current parameters';
  copy.addEventListener('click', async () => {
    const out = {};
    for (const [key] of spec) out[key] = effect.stats().settings[key];
    const text = JSON.stringify(out, null, 2);
    console.log(text);
    try {
      await navigator.clipboard.writeText(text);
      copy.textContent = 'Copied';
    } catch {
      copy.textContent = 'Copy failed — values are in the console';
    }
    setTimeout(() => { copy.textContent = 'Copy current parameters'; }, 1500);
  });
  panel.append(copy);
  document.body.append(panel);
}
