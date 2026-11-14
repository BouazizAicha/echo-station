import test from 'node:test';
import assert from 'node:assert/strict';

import { computeGuide, guideMessage } from '../js/engine/guide.js';

const at = (az, alt) => ({ az, alt });

test('target straight up gives a -90° arrow (CSS up)', () => {
  const guide = computeGuide(at(180, 20), at(180, 70));
  assert.ok(Math.abs(guide.rotateDeg - -90) < 1e-9);
  assert.ok(guide.dAlt > 49 && guide.dAlt < 51);
});

test('target to the right gives a 0° arrow', () => {
  const guide = computeGuide(at(180, 20), at(190, 20));
  assert.ok(Math.abs(guide.rotateDeg) < 1e-9);
  assert.ok(guide.dAz > 9.9);
});

test('azimuth wraps across north (350 -> 10 = +20, not -340)', () => {
  const guide = computeGuide(at(350, 10), at(10, 10));
  assert.ok(Math.abs(guide.dAz - 20) < 1e-9);
  assert.ok(guide.dAz > 0);
});

test('horizontal gap is scaled by cos(altitude)', () => {
  const low = computeGuide(at(180, 0), at(200, 0));
  const high = computeGuide(at(180, 80), at(200, 80));
  assert.ok(high.dist < low.dist / 4);
});

test('guide message points right and up', () => {
  const guide = computeGuide(at(180, 20), at(200, 30));
  const text = guideMessage(guide, { label: 'Mars', ...at(200, 30) });
  assert.match(text, /right/i);
  assert.match(text, /up/i);
});

test('guide message locks under 6°', () => {
  const guide = computeGuide(at(180, 20), at(181, 21));
  assert.equal(guideMessage(guide, { label: 'Moon', ...at(181, 21) }), "You're on it! Hold still.");
});

test('a target below the horizon never gets a turn/look instruction', () => {
  const guide = computeGuide(at(180, 20), at(310, -22));
  const text = guideMessage(guide, { label: 'Mars', ...at(310, -22) });
  assert.equal(text, 'Mars is below the horizon right now.');
  assert.doesNotMatch(text, /turn|look/i);
});
