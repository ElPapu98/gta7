import test from 'node:test';
import assert from 'node:assert/strict';
import { tilePosition, terrariumHeight, createElevationSampler } from '../src/terrain.js';

test('Terrarium RGB decodes elevations in metres', () => {
  assert.equal(terrariumHeight(128,0,0),0);
  assert.equal(terrariumHeight(128,1,0),1);
  assert.equal(terrariumHeight(127,255,0),-1);
});

test('Web Mercator tile position advances east and south', () => {
  const a=tilePosition(-.1865,-78.4865);
  assert.ok(tilePosition(-.1865,-78.4765).x>a.x);
  assert.ok(tilePosition(-.1965,-78.4865).y>a.y);
});

test('relative DEM sampler returns zero at its origin', () => {
  const origin={lat:-.1865,lon:-78.4865};
  const p=tilePosition(origin.lat,origin.lon);
  const tile=new Uint8ClampedArray(256*256*4);
  for(let i=0;i<tile.length;i+=4){tile[i]=137;tile[i+1]=200;tile[i+2]=0;tile[i+3]=255;}
  const sample=createElevationSampler(origin,new Map([[`${Math.floor(p.x)}/${Math.floor(p.y)}`,tile]]));
  assert.equal(sample(0,0),0);
});
