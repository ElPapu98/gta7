import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, step, incident, snapshot } from '../src/simulation.js';

test('identical seeds and inputs yield identical state', () => {
  const a = createWorld(42, 100), b = createWorld(42, 100);
  for (let i = 0; i < 300; i++) { step(a); step(b); }
  assert.deepEqual(snapshot(a), snapshot(b));
});
test('no witnesses means no police dispatch', () => {
  const w = createWorld(7, 0);
  const e = incident(w);
  for (let i = 0; i < 100; i++) step(w);
  assert.equal(e.witnesses.length, 0); assert.equal(w.dispatches.length, 0);
});
test('nearby witness remembers and files one report', () => {
  const w = createWorld(7, 1);
  w.agents[0].x = w.player.x + 10; w.agents[0].y = w.player.y;
  const e = incident(w);
  assert.deepEqual(e.witnesses, [0]); assert.equal(w.agents[0].memory[0].incidentId, 1);
  for (let i = 0; i < 100; i++) step(w);
  assert.equal(w.stats.reports, 1); assert.equal(w.dispatches.length, 1);
});
test('agent count and positions remain stable under long simulation', () => {
  const w = createWorld(99, 240);
  for (let i = 0; i < 2500; i++) step(w);
  assert.equal(w.agents.length, 240);
  assert.ok(w.agents.every(a => Number.isFinite(a.x) && Number.isFinite(a.y)));
});
