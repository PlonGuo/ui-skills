import { mountPhotoWall } from './photo-wall-engine.js';

const wallHost = document.querySelector('#wall');

const params = new URLSearchParams(location.search);
const wall = mountPhotoWall(wallHost, {
  images: [
    'motocross', 'eye', 'sandboarding', 'runner', 'climbing',
    'polo', 'race', 'tennis', 'football', 'track',
    'formula', 'golf', 'skydiving', 'basketball', 'soccer',
  ].map(name => `./assets/photos/${name}.jpg`),
  // `?index=1` numbers the cards, to watch the set play 1..15 and loop.
  showIndex: params.has('index'),
});

window.addEventListener('pagehide', event => {
  if (!event.persisted) {
    wall.dispose();
  }
});

// Exposed for the browser-side verification in tests/.
window.__photoWall = wall;
window.__photoWallStats = () => wall.stats();

// --- notes toggle -----------------------------------------------------
// Documentation chrome only: it is not part of the effect, and it stays
// hidden until asked for.
const toggle = document.querySelector('#notes-toggle');
function setNotes(on) {
  document.body.dataset.notes = on ? 'on' : 'off';
  toggle.setAttribute('aria-expanded', String(on));
  toggle.textContent = on ? 'Hide notes' : 'Show notes';
}
setNotes(new URLSearchParams(location.search).has('notes'));
toggle.addEventListener('click', () => {
  setNotes(document.body.dataset.notes !== 'on');
});
