// Settings & accessibility (Dev B). One ⚙ button (top right, on every screen) opens a simple panel:
//   Audio guide   – reads stories, directions and game events aloud (for players without a screen reader)
//   Text size     – Normal / Big / Bigger
//   High contrast – brighter text, solid panels, strong outlines
//   Vibration     – the phone buzzes with the signal and the echoes (Android)
//   Calm mode     – no animations, no moving backgrounds (also follows the system "reduce motion")
// Saved on this device. Other modules read `settings` and listen with onSettingsChange().
import { topTools } from './mode.js';

const KEY = 'echo-station-settings';
export const settings = { audioGuide: false, textSize: 'normal', contrast: false, vibration: true, calm: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }

const listeners = new Set();
export const onSettingsChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };

export function isCalm() {
  return settings.calm || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function apply() {
  const root = document.documentElement;
  root.style.fontSize = settings.textSize === 'bigger' ? '125%' : settings.textSize === 'big' ? '112.5%' : '';
  document.body.classList.toggle('a11y-contrast', settings.contrast);
  document.body.classList.toggle('a11y-calm', settings.calm);
  document.body.dataset.textSize = settings.textSize;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
  apply();
  for (const fn of listeners) fn(settings);
}

export function setSetting(name, value) {
  settings[name] = value;
  save();
}

/* ---------- the panel ---------- */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function toggleRow(name, icon, title, help) {
  const row = el('label', 'set-row');
  const input = el('input');
  input.type = 'checkbox';
  input.className = 'set-switch';
  input.checked = Boolean(settings[name]);
  input.addEventListener('change', () => setSetting(name, input.checked));
  const text = el('span', 'set-text');
  text.append(el('strong', null, title), el('span', 'set-help', help));
  row.append(el('span', 'set-icon', icon), text, input);
  row.querySelector('.set-icon').setAttribute('aria-hidden', 'true');
  return row;
}

function sizeRow() {
  const box = el('fieldset', 'set-row set-sizes');
  const legend = el('legend', 'set-text');
  legend.append(el('strong', null, 'Text size'));
  box.append(el('span', 'set-icon', 'Aa'), legend);
  box.querySelector('.set-icon').setAttribute('aria-hidden', 'true');
  const group = el('div', 'set-size-group');
  for (const [value, label] of [['normal', 'A'], ['big', 'A+'], ['bigger', 'A++']]) {
    const id = `set-size-${value}`;
    const input = el('input');
    input.type = 'radio'; input.name = 'set-size'; input.id = id; input.value = value;
    input.checked = settings.textSize === value;
    input.addEventListener('change', () => setSetting('textSize', value));
    const lab = el('label', `set-size set-size-${value}`, label);
    lab.htmlFor = id;
    lab.setAttribute('aria-label', { normal: 'Normal text', big: 'Big text', bigger: 'Bigger text' }[value]);
    group.append(input, lab);
  }
  box.appendChild(group);
  return box;
}

const dialog = el('dialog', 'settings');
dialog.id = 'settings';
dialog.setAttribute('aria-labelledby', 'settings-title');
const head = el('div', 'set-head');
const title = el('h2', null, 'Settings');
title.id = 'settings-title';
const close = el('button', 'set-close', '✕');
close.type = 'button';
close.setAttribute('aria-label', 'Close settings');
close.addEventListener('click', () => dialog.close());
head.append(title, close);
dialog.append(
  head,
  el('p', 'set-intro', 'Make Echo Station work the way you like.'),
  toggleRow('audioGuide', '🗣️', 'Audio guide', 'Reads the stories, directions and game events aloud. Best if you don\'t use a screen reader.'),
  sizeRow(),
  toggleRow('contrast', '◐', 'High contrast', 'Brighter text and solid backgrounds.'),
  toggleRow('vibration', '📳', 'Vibration', 'The phone buzzes when Belu hears a friend (Android phones).'),
  toggleRow('calm', '🐢', 'Calm mode', 'No animations and no moving backgrounds.'),
  el('p', 'set-note', 'Subtitles are always on for the robots\' voices. Keyboard: arrows to move, C for Belu\'s click, Space for engines.'),
);
const done = el('button', 'big set-done', 'Done');
done.type = 'button';
done.addEventListener('click', () => dialog.close());
dialog.appendChild(done);
dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });   // tap outside closes
document.body.appendChild(dialog);

const button = el('button');
button.id = 'settings-button';
button.type = 'button';
button.innerHTML = '<span aria-hidden="true">⚙</span><span class="settings-label">Settings</span>';
button.setAttribute('aria-label', 'Settings and accessibility');
button.setAttribute('aria-haspopup', 'dialog');
button.addEventListener('click', () => {
  if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  title.tabIndex = -1;
  title.focus();
});
topTools().prepend(button);

apply();
