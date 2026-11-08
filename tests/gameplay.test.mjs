import test from 'node:test';
import assert from 'node:assert/strict';
import { JOBS, newGame, objective, interact, tickGame, saveProgress } from '../src/gameplay.js';

test('complete full contract and unlock next route', () => {
  const g = newGame();
  assert.equal(interact(g, { x: 80, z: 80 }), null);
  assert.equal(interact(g, { x: 8, z: -9 }).type, 'accepted');
  assert.equal(g.stage, 'pickup');
  assert.equal(interact(g, JOBS[0].dropoff), null);
  assert.equal(interact(g, JOBS[0].pickup).type, 'collected');
  assert.equal(interact(g, JOBS[0].dropoff).type, 'completed');
  assert.equal(g.cash, 450); assert.equal(g.completed, 1);
  assert.equal(interact(g, objective(g)).job.id, JOBS[1].id);
});
test('failure expires without reward', () => {
  const g = newGame(); interact(g, objective(g));
  const fail = tickGame(g, 250);
  assert.equal(fail.type, 'failed'); assert.equal(g.cash, 0); assert.equal(g.stage, 'idle');
});
test('saved economy restores without active job', () => {
  const g = newGame({cash: 1234, completed: 2});
  assert.deepEqual(saveProgress(g), {cash:1234,completed:2});
  assert.equal(g.mission,null);assert.equal(interact(g,objective(g)).job.id,JOBS[2].id);
});
