// Mini-game registry (Dev B). Each robot JSON can say which template it uses:
//   "minigame": { "type": "drive", "settings": { ... }, "intro": "...", "hint": "...", "success": "..." }
// Robots without a "minigame" field get the default below (C can override any text in the JSON).
// To add a new template: create minigames/<type>.js exporting start(robot, ui) and register it here.
import * as drive from './drive.js';
import * as lander from './lander.js';
import * as fly from './fly.js';
import * as storm from './storm.js';
import * as listen from './listen.js';

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
  // the templates read robot.minigame: give them the merged version
  return tpl.start({ ...robot, minigame: mg }, ui);
}

export const hasMinigame = robot => Boolean(TEMPLATES[minigameOf(robot)?.type]);
