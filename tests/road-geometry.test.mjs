import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roadRibbon, combineRoadRibbons } from '../src/road-geometry.js';

test('road is a continuous pair of vertices per surveyed point',()=>{
  const road=roadRibbon([{x:0,z:0},{x:0,z:10},{x:0,z:20}],8);
  assert.equal(road.vertices.length,18);
  assert.equal(road.indices.length,12);
  assert.ok(road.vertices.every(Number.isFinite));
  assert.ok(road.vertices.every((v,i)=>i%3!==1||Math.abs(v-.14)<1e-8));
});
test('sharp corners cannot make road width explode into white spikes',()=>{
  const road=roadRibbon([{x:0,z:0},{x:0,z:10},{x:10,z:10}],8);
  const x=road.vertices[6],z=road.vertices[8];
  assert.ok(Math.hypot(x,z-10)<9);
});
test('duplicate points do not produce degenerate strips',()=>{
  const road=roadRibbon([{x:0,z:0},{x:0,z:0},{x:0,z:10}],7);
  assert.equal(road.indices.length,6);
});
test('multiple OSM roads join one indexed buffer without shared vertices',()=>{
  const roads=[{points:[{x:0,z:0},{x:0,z:10}]},{points:[{x:10,z:0},{x:10,z:10}]}];
  const mesh=combineRoadRibbons(roads,()=>6,()=>0);
  assert.equal(mesh.indices.length,12);
  assert.equal(Math.max(...mesh.indices),7);
});
