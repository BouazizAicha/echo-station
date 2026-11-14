// Mini-game registry (Dev B). Each robot JSON says which template it uses:
//   "minigame": { "type": "drive", "settings": { ... }, "intro": "...", "success": "..." }
// To add a new template: create minigames/<type>.js exporting start(robot, ui) and register it here.
import * as drive from './drive.js';

const TEMPLATES = { drive };

export function startMinigame(robot, ui) {
  const tpl = TEMPLATES[robot.minigame?.type];
  if (!tpl) { console.warn('Unknown mini-game type', robot.minigame); return null; }
  return tpl.start(robot, ui);
}
