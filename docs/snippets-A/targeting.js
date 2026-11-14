/**
 * targeting.js — which target the radio is currently tuned to.
 *
 * Kept pure so the "nearest target" rule is testable without a browser.
 * Targets whose robots have all been found are dropped, because guiding a
 * player back to a finished target is confusing; if nothing is left, every
 * target is a candidate again.
 */

import { angularDistance } from './sky.js';

/**
 * A target under the horizon cannot be aimed at. The penalty is larger than
 * the sky's half-sphere, so any visible target wins; a buried target is only
 * picked when it is the only one left.
 */
export const BELOW_HORIZON_PENALTY = 90;

/** Targets that still have at least one unfound robot. */
export function activeTargets(targets, robots, found) {
  const activeIds = new Set(
    robots.filter((robot) => !found.has(robot.id)).map((robot) => robot.sky_target),
  );
  return targets.filter((target) => activeIds.has(target.id));
}

/** Nearest target to a direction, with a horizon penalty. */
export function chooseNearest(aim, targets) {
  let best = null;
  for (const target of targets) {
    const distance = angularDistance(aim, target);
    const score = target.alt < 0 ? distance + BELOW_HORIZON_PENALTY : distance;
    if (!best || score < best.score) best = { target, distance, score };
  }
  return best;
}

/**
 * Nearest still-relevant target for an aim.
 * @param {{az:number, alt:number}} aim
 * @param {Array<object>} targets sky targets
 * @param {Array<{id:string, sky_target:string}>} robots
 * @param {Set<string>} found robot ids already locked
 */
export function pickTarget(aim, targets, robots, found) {
  const active = activeTargets(targets, robots, found);
  return chooseNearest(aim, active.length ? active : targets);
}
