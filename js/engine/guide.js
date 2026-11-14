/**
 * guide.js — the arrow that turns a kid's random sky-sweeping into a path.
 *
 * We compare the horizontal gap (wrapped to -180..180, positive = right)
 * and the height gap. The horizontal gap is multiplied by cos(altitude):
 * near the zenith a large azimuth change is only a small movement.
 * atan2 gives the rotation angle, with CSS conventions (0 = right, -90 = up).
 */

import { normalize180 } from './sky.js';

const RADIANS = Math.PI / 180;

/**
 * @param {{az:number, alt:number}} dir current aim
 * @param {{az:number, alt:number, label?:string}} target
 */
export function computeGuide(dir, target) {
  const dAzRaw = normalize180(target.az - dir.az); // -180..180, + = to the right
  const dAlt = target.alt - dir.alt; // + = higher
  const horiz = dAzRaw * Math.cos(dir.alt * RADIANS);
  const rotateDeg = Math.atan2(-dAlt, horiz) / RADIANS; // CSS: 0 = right, -90 = up
  const dist = Math.hypot(horiz, dAlt);
  const dAz = normalize180(target.az - dir.az);

  return { dAz, dAzRaw, dAlt, horiz, rotateDeg, dist };
}

/**
 * Human instruction. Kept short because a screen reader may read it.
 * The caller only writes it to the DOM when the text actually changes.
 */
export function guideMessage(guide, target) {
  const label = target.label || 'the target';
  // A target under the horizon cannot be aimed at: never tell the player to
  // turn toward it or to "look down" past the ground.
  if (target.alt < 0) return `${label} is below the horizon right now.`;
  if (guide.dist <= 6) return "You're on it! Hold still.";

  const parts = [];
  const azGap = Math.abs(guide.dAz);
  if (azGap >= 4) {
    parts.push(`Turn ${Math.round(azGap)}° ${guide.dAz > 0 ? 'right' : 'left'}`);
  }

  const altGap = Math.abs(guide.dAlt);
  if (altGap >= 4) {
    parts.push(`look ${guide.dAlt > 0 ? 'up' : 'down'} ${Math.round(altGap)}°`);
  }

  if (!parts.length) return `${label} is close — small movements.`;
  return `${capitalize(parts.join(' and '))} toward ${label}.`;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
