import test from 'node:test';
import assert from 'node:assert/strict';
import { project, classifyWays, roadWidth, buildingHeight, CITY_CONFIG } from '../src/portoviejo.js';

test('geographic origin maps to scene origin in metres', () => {
  assert.equal(project(-1.0545, -80.4545).x, 0);
  assert.equal(Math.abs(project(-1.0545, -80.4545).z), 0);
  assert.ok(project(-1.0545, -80.4535).x > 100);
  assert.ok(project(-1.0535, -80.4545).z < -100);
});

test('OpenStreetMap roads and building footprints are classified', () => {
  const geometry = [{lat:-1.0545,lon:-80.4545},{lat:-1.0546,lon:-80.4545},
    {lat:-1.0546,lon:-80.4544},{lat:-1.0545,lon:-80.4545}];
  const features=classifyWays([
    {type:'way', tags:{highway:'residential'}, geometry},
    {type:'way', tags:{building:'yes','building:levels':'2'}, geometry},
    {type:'node', tags:{building:'yes'}}]);
  assert.equal(features.roads.length,1);
  assert.equal(features.buildings.length,1);
  assert.equal(buildingHeight(features.buildings[0].tags),6.2);
  assert.equal(roadWidth('primary'),12);
});

test('Quito has its own geographic origin and reproducible projection', () => {
  const q = CITY_CONFIG.quito;
  assert.equal(q.name, 'Quito');
  assert.ok(Math.abs(project(q.lat, q.lon, q).x) < .001);
  assert.ok(Math.abs(project(q.lat, q.lon, q).z) < .001);
  assert.ok(project(q.lat + .001, q.lon, q).z < 0);
});
