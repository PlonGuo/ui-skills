import { mountFloatingDots } from './floating-dots-engine.js';

const backdrop = document.querySelector('#backdrop');
const effect = mountFloatingDots(backdrop);

window.addEventListener('pagehide', event => {
  if (!event.persisted) effect.dispose();
});

// Expose the handle for the browser-side verification in tests/.
window.__floatingDotsStats = () => effect.stats();

// --- Tuning panel -----------------------------------------------------
// An audit tool only. It renders behind ?tune=1 and is deliberately kept
// out of the skill template. Drag the sliders to find the feel, then use
// "Copy current parameters" and hand the values over to be fixed as
// defaults.
if (new URLSearchParams(location.search).has('tune')) {
  // [key, min, max, step]. Ring dimensions use normalized plane units.
  const spec = [
    ['density', 100, 290, 1],
    ['particlesScale', 0.1, 2, 0.01],
    ['ringWidth', 0.001, 0.3, 0.001],
    ['ringWidth2', 0.001, 0.2, 0.001],
    ['ringDisplacement', 0, 1, 0.01],
    ['followSpeed', 0.1, 6, 0.05],
    ['idleSpeed', 0.1, 3, 0.05],
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
