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

// Top-right toolbar shared by the sound button and the mode switch
export function topTools() {
  let tools = document.getElementById('top-tools');
  if (!tools) {
    const bar = document.createElement('header');
    bar.id = 'app-bar';
    bar.innerHTML = `
      <button id="app-back" type="button" aria-label="Back" hidden><svg class="icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg><span class="app-back-label">Back</span></button>
      <span id="app-brand" aria-hidden="true"><img src="assets/images/favicon-32.png" alt="" width="24" height="24"> ECHO STATION</span>
      <div id="top-tools"></div>`;
    document.body.prepend(bar);
    // The back arrow presses the current screen's own back button (each screen keeps its logic)
    bar.querySelector('#app-back').addEventListener('click', () => {
      document.querySelector('.screen:not([hidden]) [data-back]')?.click();
    });
    tools = bar.querySelector('#top-tools');
  }
  return tools;
}

/** Called when the screen changes: show ← Back where the screen has a way back. */
export function updateAppBar() {
  const back = document.getElementById('app-back');
  if (!back) return;
  const target = document.querySelector('.screen:not([hidden]) [data-back]');
  back.hidden = !target;
  const label = target?.dataset.back || 'Back';
  back.querySelector('.app-back-label').textContent = label;
  back.setAttribute('aria-label', label);
  document.getElementById('app-brand').hidden = Boolean(target);
}

// The floating switch (hidden on the first screen by CSS, where the choice is made)
function createSwitch() {
  if (document.getElementById('mode-switch')) return;
  const button = document.createElement('button');
  button.id = 'mode-switch';
  button.type = 'button';
  button.innerHTML = '<span class="mode-switch-icon" aria-hidden="true"></span><span class="mode-switch-label"></span><span class="mode-switch-short" aria-hidden="true"></span>';
  button.addEventListener('click', () => setMode(button.dataset.target));
  topTools().appendChild(button);
}

createSwitch();
apply();
