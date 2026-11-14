import test from 'node:test';
import assert from 'node:assert/strict';

import {
  activeTargets,
  chooseNearest,
  pickTarget,
} from '../js/engine/targeting.js';

// Aim near the Moon on 14 November 2026, 17:30 in Tunis.
const TARGETS = [
  { id: 'moon', label: 'Moon', az: 169.6, alt: 27 },
  { id: 'mars', label: 'Mars', az: 311.8, alt: -22.5 },
  { id: 'ceres', label: 'Ceres', az: 346.2, alt: -26.8 },
  { id: 'pioneer10', label: 'Pioneer 10', az: 22.5, alt: -23 },
];

const ROBOTS = [
  { id: 'eagle', name: 'Eagle', sky_target: 'moon' },
  { id: 'sojourner', name: 'Sojourner', sky_target: 'mars' },
  { id: 'spirit', name: 'Spirit', sky_target: 'mars' },
  { id: 'perseverance', name: 'Perseverance', sky_target: 'mars' },
  { id: 'dawn', name: 'Dawn', sky_target: 'ceres' },
  { id: 'pioneer10', name: 'Pioneer 10', sky_target: 'pioneer10' },
];

const AIM_NEAR_MOON = { az: 181.4, alt: 27 };

test('aiming next to the Moon picks the Moon, not a far buried target', () => {
  const nearest = pickTarget(AIM_NEAR_MOON, TARGETS, ROBOTS, new Set());
  assert.equal(nearest.target.id, 'moon');
  assert.ok(nearest.distance > 10 && nearest.distance < 13);
});

test('a target with no unfound robots is no longer a candidate', () => {
  const found = new Set(['eagle']);
  const active = activeTargets(TARGETS, ROBOTS, found);
  assert.deepEqual(active.map((target) => target.id), ['mars', 'ceres', 'pioneer10']);

  const nearest = pickTarget(AIM_NEAR_MOON, TARGETS, ROBOTS, found);
  assert.equal(nearest.target.id, 'mars');
  assert.ok(nearest.target.alt < 0, 'the fallback target is flagged below the horizon');
});

test('Mars stays selectable while one of its three robots is unfound', () => {
  const found = new Set(['eagle', 'sojourner', 'spirit']);
  const active = activeTargets(TARGETS, ROBOTS, found);
  assert.ok(active.some((target) => target.id === 'mars'));
});

test('when every robot is found, targets are candidates again', () => {
  const found = new Set(ROBOTS.map((robot) => robot.id));
  const nearest = pickTarget(AIM_NEAR_MOON, TARGETS, ROBOTS, found);
  assert.equal(nearest.target.id, 'moon');
});

test('a visible target beats a nearer target under the horizon', () => {
  const targets = [
    { id: 'below', label: 'Below', az: 180, alt: -5 },
    { id: 'up', label: 'Up', az: 200, alt: 20 },
  ];
  const nearest = chooseNearest({ az: 180, alt: 0 }, targets);
  assert.equal(nearest.target.id, 'up');
});
