import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { deadzone, radialDeadzone, movement, readGamepad } from '../src/controls.js';
import { cameraRelativeDirection } from '../src/character-motor.js';

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
test('radial gamepad deadzone preserves diagonals', () => {
  const v=radialDeadzone(.5,-.5);
  assert.ok(Math.abs(v.x+v.y)<1e-12);
  assert.deepEqual(radialDeadzone(.04,-.05),{x:0,y:0});
});
test('standard gamepad D-pad moves right and forward even with centered stick', () => {
  const buttons=Array.from({length:16},()=>({pressed:false}));
  buttons[12].pressed=buttons[15].pressed=true;
  const pad=readGamepad([{connected:true,mapping:'standard',axes:[0,0,0,0],buttons}]);
  assert.equal(pad.forward,1);
  assert.equal(pad.sideways,1);
});
test('keyboard, touch and gamepad all move right in camera-space', () => {
  const inactive=readGamepad([]);
  const inputs=[
    movement(new Set(['d']),inactive),
    movement(new Set(),inactive,{x:1,y:0,run:false}),
    movement(new Set(),readGamepad([{connected:true,mapping:'standard',axes:[1,0,0,0],buttons:[]}]))
  ];
  for(const input of inputs)for(const yaw of [0,Math.PI/2,Math.PI]){
    const right=cameraRelativeDirection(0,1,yaw);
    const actual=cameraRelativeDirection(input.forward,input.sideways,yaw);
    assert.ok(actual.x*right.x+actual.z*right.z>.99);
  }
});
