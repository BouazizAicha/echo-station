import test from 'node:test';
import assert from 'node:assert/strict';

import {
  angularDistance,
  formatLightTime,
  getHorizontal,
  normalize180,
  compassPoint,
} from '../js/engine/sky.js';

test('the Moon matches the brief for Tunis at 17:30 local (16:30 UTC)', () => {
  const moon = getHorizontal('moon', new Date('2026-11-14T16:30:00Z'));
  assert.ok(moon.az > 196 && moon.az < 200, `azimuth ${moon.az}`);
  assert.ok(moon.alt > 24 && moon.alt < 28, `altitude ${moon.alt}`);
  assert.ok(moon.dist_au > 0.0025 && moon.dist_au < 0.0028);
});

test('Mars is below the horizon at 17:30 on 14 November 2026', () => {
  const mars = getHorizontal('mars', new Date('2026-11-14T16:30:00Z'));
  assert.ok(mars.alt < 0, `Mars altitude ${mars.alt}`);
});

test('angular distance is zero against itself and 90° across the sky', () => {
  const moon = getHorizontal('moon');
  assert.ok(angularDistance(moon, moon) < 1e-9);
  const distance = angularDistance({ az: 0, alt: 0 }, { az: 90, alt: 0 });
  assert.ok(Math.abs(distance - 90) < 1e-6);
});

test('normalize180 wraps correctly', () => {
  assert.equal(normalize180(20), 20);
  assert.equal(normalize180(-20), -20);
  assert.equal(normalize180(340), -20);
  assert.equal(Math.abs(normalize180(180)), 180);
  assert.equal(normalize180(-180), -180);
});

test('light-time formatting matches the brief', () => {
  assert.equal(formatLightTime(1.4), '1.4 s');
  assert.equal(formatLightTime(1.28), '1.3 s');
  assert.equal(formatLightTime(11 * 60), '11 min');
  assert.equal(formatLightTime(19 * 3600 + 36 * 60), '19 h 36 min');
  assert.equal(formatLightTime(19 * 3600), '19 h');
});

test('compass points', () => {
  assert.equal(compassPoint(0), 'N');
  assert.equal(compassPoint(90), 'E');
  assert.equal(compassPoint(198), 'S');
  assert.equal(compassPoint(225), 'SW');
});
