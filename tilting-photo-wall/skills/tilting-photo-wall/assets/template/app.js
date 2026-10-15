import { mountPhotoWall } from './photo-wall-engine.js';

const params = new URLSearchParams(location.search);
const wall = mountPhotoWall(document.querySelector('#wall'), {
  images: Array.from({ length: 15 }, (_, i) => `./assets/photos/${String(i + 1).padStart(2, '0')}.svg`),
  showIndex: params.has('index'),
});
window.addEventListener('pagehide', event => {
  if (!event.persisted) wall.dispose();
});

// Browser checks use this handle to inspect motion and rendering.
window.__photoWall = wall;
window.__photoWallStats = () => wall.stats();
const toggle = document.querySelector('#notes-toggle');
function setNotes(on) {
  document.body.dataset.notes = on ? 'on' : 'off';
  toggle.setAttribute('aria-expanded', String(on));
  toggle.textContent = on ? 'Hide notes' : 'Show notes';
}
setNotes(params.has('notes'));
toggle.addEventListener('click', () => setNotes(document.body.dataset.notes !== 'on'));
