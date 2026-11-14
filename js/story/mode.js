// Two ways to explore (Dev B):
//   "story"   = Story with Belu: cinematic, animated, mini-moments, no technical readouts.
//   "science" = Scientist mode: the full radio / sky map with coordinates, data and sources.
// The choice is made on the first screen and can be changed anytime with the switch button.
// It is remembered in localStorage; ?mode=story or ?mode=science forces it (handy for filming).

const KEY = 'echo-station-mode';
const MODES = ['story', 'science'];
const listeners = new Set();

let mode = 'story';
try {
  const forced = new URLSearchParams(location.search).get('mode');
  const saved = localStorage.getItem(KEY);
  if (MODES.includes(forced)) mode = forced;
  else if (MODES.includes(saved)) mode = saved;
} catch (e) { /* private mode: default */ }

function apply() {
  document.body.classList.toggle('mode-story', mode === 'story');
  document.body.classList.toggle('mode-science', mode === 'science');
  document.body.dataset.mode = mode;
  const button = document.getElementById('mode-switch');
  if (button) {
    const other = mode === 'story' ? 'Scientist mode' : 'Story with Belu';
    button.querySelector('.mode-switch-label').textContent = other;
    button.querySelector('.mode-switch-short').textContent = mode === 'story' ? 'Scientist' : 'Story';
    button.setAttribute('aria-label', `Switch to ${other}`);
    button.dataset.target = mode === 'story' ? 'science' : 'story';
  }
}

export const getMode = () => mode;
export const isStory = () => mode === 'story';

export function setMode(next) {
  if (!MODES.includes(next)) return;
  const changed = next !== mode;
  mode = next;
  try { localStorage.setItem(KEY, mode); } catch (e) { /* ignore */ }
  apply();
  if (changed) for (const fn of listeners) fn(mode);
}

export function onModeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// The floating switch (hidden on the first screen by CSS, where the choice is made)
function createSwitch() {
  if (document.getElementById('mode-switch')) return;
  const button = document.createElement('button');
  button.id = 'mode-switch';
  button.type = 'button';
  button.innerHTML = '<span class="mode-switch-icon" aria-hidden="true"></span><span class="mode-switch-label"></span><span class="mode-switch-short" aria-hidden="true"></span>';
  button.addEventListener('click', () => setMode(button.dataset.target));
  document.body.appendChild(button);
}

createSwitch();
apply();
