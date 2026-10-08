import { mountMorphingParticles } from './particle-engine.js';

const effects = [];
document.querySelectorAll('[data-solution-section]').forEach(section => {
  const container = section.querySelector('[data-container]');
  const component = section.querySelector('[data-morphing-particles-component]');
  const trigger = section.querySelector('[data-hover-trigger]');
  const effect = mountMorphingParticles(container, {
    trigger, shape: component.dataset.shape,
    density: Number(component.dataset.density || 50),
    particlesScale: Number(component.dataset.particlesScale || .6),
    cameraZoom: Number(component.dataset.cameraZoom || 8.8),
  });
  effect.ready.then(() => { component.dataset.state = 'ready'; }).catch(error => {
    component.dataset.state = 'error';
    console.error('Particle background failed:', error);
  });
  effects.push(effect);
});
window.addEventListener('pagehide', event => {
  if (!event.persisted) effects.forEach(effect => effect.dispose());
});
