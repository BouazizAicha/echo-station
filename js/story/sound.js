// Sound button (Dev B): 3 settings, remembered on this device.
//   All sounds  →  No radio static (clicks, echoes and voices stay)  →  Muted
// When muted, voices are replaced by read-along subtitles.
import { setMuted, setStaticEnabled } from './radio.js';
import { topTools } from './mode.js';
import { ICONS } from './icons.js';

const KEY = 'echo-station-sound';
const MODES = [
  { id: 'all', icon: ICONS.soundOn, label: 'Sound on', next: 'No radio static' },
  { id: 'quiet', icon: ICONS.soundQuiet, label: 'No static', next: 'Muted' },
  { id: 'off', icon: ICONS.soundOff, label: 'Muted', next: 'Sound on' },
];

let mode = 'all';
try { if (MODES.some(m => m.id === localStorage.getItem(KEY))) mode = localStorage.getItem(KEY); } catch (e) { /* ignore */ }

const button = document.createElement('button');
button.id = 'sound-switch';
button.type = 'button';
button.innerHTML = '<span class="sound-icon" aria-hidden="true"></span><span class="sound-label"></span>';
topTools().prepend(button);

function apply() {
  const m = MODES.find(x => x.id === mode);
  setStaticEnabled(mode === 'all');
  setMuted(mode === 'off');
  if (mode === 'off') { try { window.speechSynthesis?.cancel(); } catch (e) { /* ignore */ } }
  button.querySelector('.sound-icon').innerHTML = m.icon;
  button.querySelector('.sound-label').textContent = m.label;
  button.setAttribute('aria-label', `${m.label}. Tap for: ${m.next}.`);
  button.title = `${m.label} (tap for: ${m.next})`;
  document.body.dataset.sound = mode;
  window.dispatchEvent(new CustomEvent('soundchange', { detail: mode }));
}

button.addEventListener('click', () => {
  const i = MODES.findIndex(x => x.id === mode);
  mode = MODES[(i + 1) % MODES.length].id;
  try { localStorage.setItem(KEY, mode); } catch (e) { /* ignore */ }
  apply();
});

apply();

export const soundMode = () => mode;
// Used by the story's voice button: "sound is off → tap to hear the voices"
export function setSoundMode(id) {
  if (!MODES.some(m => m.id === id) || id === mode) return;
  mode = id;
  try { localStorage.setItem(KEY, mode); } catch (e) { /* ignore */ }
  apply();
}
// Call after the audio starts (the Start tap), so the setting applies to it
export const applySound = apply;
