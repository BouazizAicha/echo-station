// Mini-game registry (Dev B). Each robot JSON can say which template it uses:
//   "minigame": { "type": "drive", "settings": { ... }, "intro": "...", "hint": "...", "success": "..." }
// Robots without a "minigame" field get the default below (C can override any text in the JSON).
// To add a new template: create minigames/<type>.js exporting start(robot, ui) and register it here.
import * as drive from './drive.js';
import * as lander from './lander.js';
import * as fly from './fly.js';
import * as storm from './storm.js';
import * as listen from './listen.js';
import { howTo, helpButton, closeHowTo } from './kit.js';

const TEMPLATES = { drive, lander, fly, storm, listen };

const DEFAULTS = {
  spirit: { type: 'drive', title: 'Drive with a stuck wheel' },
  'apollo11-eagle': {
    type: 'lander',
    title: 'Land the Eagle',
    intro: 'July 20, 1969. The computer is taking Eagle toward a crater full of boulders! Take control like Neil Armstrong: fly past them and land softly on flat ground before the fuel runs out.',
  },
  ingenuity: {
    type: 'fly',
    title: 'Scout for Perseverance',
    intro: 'Fly over Jezero Crater, hover low over the 3 camera marks to photograph them for the rover, then land on airfield B before the battery runs out. Watch out for gusts and smooth sand!',
  },
  opportunity: {
    type: 'storm',
    title: 'Survive the dust storm',
    intro: 'A dust storm is coming! Keep my battery alive for 8 Martian days. Science earns points but uses power, and at night my heaters need energy. Drive into dust devils: they clean my solar panels!',
  },
  pioneer10: {
    type: 'listen',
    title: 'Catch the last signal',
    intro: 'You control a giant radio dish of NASA\'s Deep Space Network. Keep it on my faint signal while the years go by, from 1972 to 2003. Every year I am farther away… and harder to hear.',
  },
};

// "How to play" cards: one goal, 3–4 short steps, one warning. C can override with "minigame.how".
const HOW = {
  drive: {
    goal: 'Drive Spirit to Home Plate (the dashed circle) and uncover what is hidden under the dust.',
    steps: [
      { icon: '▲▼', text: 'Drive forward or backward' },
      { icon: '◀▶', text: 'Turn left or right' },
      { icon: '🔋', text: 'Watch the battery at the bottom' },
    ],
    warn: 'One wheel is stuck. Try different ways to drive!',
  },
  lander: {
    goal: 'Land the Eagle softly on the FLAT GROUND.',
    steps: [
      { icon: '▲', text: 'Hold to fire the engine and slow down' },
      { icon: '◀▶', text: 'Move sideways, past the boulders' },
      { icon: '↓', text: 'Touch down slowly: DOWN speed blue, not pink' },
    ],
    warn: 'Fuel is limited: do not keep the engine on all the time.',
  },
  fly: {
    goal: 'Take 3 photos, then land on AIRFIELD B.',
    steps: [
      { icon: '▲', text: 'Hold to climb. Let go to come down' },
      { icon: '◀▶', text: 'Fly left or right' },
      { icon: '📷', text: 'Hover low over a pink CAMERA box' },
      { icon: '🛬', text: 'Land slowly on AIRFIELD B, far right' },
    ],
    warn: 'Gusts of wind push you, and smooth sand makes you drift.',
  },
  storm: {
    goal: 'Keep Opportunity alive for 8 Martian days.',
    steps: [
      { icon: '▲', text: 'Science ON earns points but uses power' },
      { icon: '🔋', text: 'Battery low? Turn science OFF' },
      { icon: '◀▶', text: 'Drive into dust devils: they clean the panels' },
    ],
    warn: 'Around day 4 the storm makes the sky very dark.',
  },
  listen: {
    goal: 'Keep the circle on Pioneer 10\'s purple glow, from 1972 to 2003.',
    steps: [
      { icon: '◀▲▼▶', text: 'Move the circle (the radio dish)' },
      { icon: '🟣', text: 'Stay on the glow: the DATA bar fills up' },
      { icon: '🔊', text: 'The tone gets louder when you are on it' },
    ],
    warn: 'Every year the signal is weaker and moves more.',
  },
};

/** The mini-game of a robot: its own JSON first, then the default. */
export function minigameOf(robot) {
  if (!robot) return null;
  const own = robot.minigame;
  const base = DEFAULTS[robot.id];
  if (own && TEMPLATES[own.type]) return { ...(base?.type === own.type ? base : {}), ...own };
  return base || null;
}

export function startMinigame(robot, ui) {
  const mg = minigameOf(robot);
  const tpl = TEMPLATES[mg?.type];
  if (!tpl) { console.warn('Unknown mini-game type', robot.minigame); return null; }
  const how = { ...HOW[mg.type], ...(mg.how || {}) };
  let inner = null, cancelled = false, removeHelp = null;
  ui.result.hidden = true;
  ui.hud.textContent = '';
  // 1. the rules, in big and simple words — 2. the game starts when the player presses Start
  howTo(ui, how).then(() => {
    if (cancelled) return;
    // the templates read robot.minigame: give them the merged version
    inner = tpl.start({ ...robot, minigame: mg }, ui);
    if (mg.type !== 'drive') removeHelp = helpButton(ui, how);   // ? = rules again (pauses)
  });
  return {
    stop() { cancelled = true; closeHowTo(ui); removeHelp?.(); inner?.stop(); },
    peek: () => inner?.peek?.(),
  };
}

export const hasMinigame = robot => Boolean(TEMPLATES[minigameOf(robot)?.type]);
