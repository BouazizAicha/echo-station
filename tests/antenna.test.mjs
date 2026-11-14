import test from 'node:test';
import assert from 'node:assert/strict';

import { smoothDir, setSmoothing } from '../js/engine/antenna.js';

test('smoothing a vector never spins across north', () => {
  setSmoothing(0.2);
  const first = smoothDir({ az: 350, alt: 0 });
  assert.ok(first.az > 340 && first.az < 360);

  const second = smoothDir({ az: 10, alt: 0 });
  // A naive angle average would give ~180°. The vector average stays near north.
  assert.ok(second.az > 348 || second.az < 12, `azimuth ${second.az}`);
});

test('smoothing preserves altitude direction', () => {
  setSmoothing(1);
  const direction = smoothDir({ az: 90, alt: 45 });
  assert.ok(Math.abs(direction.az - 90) < 1e-6);
  assert.ok(Math.abs(direction.alt - 45) < 1e-6);
});
