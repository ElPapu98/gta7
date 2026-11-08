import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createMotor, stepMotor, shortestTurn, cameraClearance } from '../src/character-motor.js';

test('locomotion is nearly frame-rate independent', () => {
  const one=createMotor(),two=createMotor(),input={forward:1,sideways:0,run:false};
  for(let i=0;i<60;i++)stepMotor(one,input,0,1/60);
  for(let i=0;i<120;i++)stepMotor(two,input,0,1/120);
  assert.ok(Math.abs(one.z-two.z)<.06);
});
test('body turns through shortest rotation path', () => {
  assert.ok(Math.abs(shortestTurn(Math.PI-.1,-Math.PI+.1)-.2)<1e-6);
});
test('movement slides along obstacles and cannot tunnel through wall', () => {
  const body=createMotor(),input={forward:1,sideways:1,run:true};
  for(let i=0;i<90;i++)stepMotor(body,input,0,1/30,(x)=>x< -1.5);
  assert.ok(body.x>=-1.5);
  assert.ok(body.z< -2);
});
test('player decelerates when input released', () => {
  const body=createMotor();for(let i=0;i<60;i++)stepMotor(body,{forward:1},0,1/60);
  const old=body.speed;for(let i=0;i<30;i++)stepMotor(body,{},0,1/60);
  assert.ok(body.speed<old*.1);
});
test('chase camera shortens when a building blocks line of sight', () => {
  const from={x:0,z:0},to={x:0,z:12};
  assert.ok(cameraClearance(from,to,[{x:0,z:8,w:5,d:5}])<.6);
  assert.equal(cameraClearance(from,to,[{x:30,z:8,w:5,d:5}]),1);
});
test('W/A/S/D directions align with what the chase camera sees', () => {
  const cases=[
    [{forward:1},'z',-1],
    [{forward:-1},'z',1],
    [{sideways:-1},'x',1],
    [{sideways:1},'x',-1],
  ];
  for(const [input,axis,sign] of cases){
    const body=createMotor();
    for(let i=0;i<20;i++)stepMotor(body,input,0,1/60);
    assert.ok(body[axis]*sign>0,`${JSON.stringify(input)} unexpectedly moved ${axis}=${body[axis]}`);
  }
});
test('camera rotation preserves directions in local screen coordinates', () => {
  const body=createMotor();
  for(let i=0;i<30;i++)stepMotor(body,{forward:1},Math.PI/2,1/60);
  assert.ok(body.x< -1);
  assert.ok(Math.abs(body.z)<.01);
});
