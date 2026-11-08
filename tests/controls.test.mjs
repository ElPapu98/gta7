import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { deadzone, movement, readGamepad } from '../src/controls.js';

test('deadzone suppresses controller stick drift', () => {
  assert.equal(deadzone(.1), 0);
  assert.equal(deadzone(-.1), 0);
  assert.ok(deadzone(.7) > .5);
});
test('keyboard and touch movements are clamped to unit speed', () => {
  const input = movement(new Set(['w', 'd', 'shift']), readGamepad([]), { x: 1, y: 1, run: false });
  assert.ok(Math.hypot(input.forward, input.sideways) <= 1.000001);
  assert.equal(input.run, true);
});
test('standard gamepad maps sticks and action buttons', () => {
  const pad = readGamepad([{ connected: true, mapping: 'standard', axes: [0, -1, .5, 0], buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 0 || i === 5 })) }]);
  assert.equal(pad.forward, 1);
  assert.equal(pad.actions.interact, true);
  assert.equal(pad.actions.vehicle, false);
  assert.equal(pad.run, true);
});
