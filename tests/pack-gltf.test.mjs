import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { packGltf } from '../tools/pack-gltf.mjs';

test('packs a geometry buffer and image into a valid aligned GLB 2 container', () => {
  const gltf={asset:{version:'2.0'},buffers:[{uri:'mesh.bin',byteLength:3}],bufferViews:[{buffer:0,byteOffset:0,byteLength:3}],images:[{uri:'tex.jpg'}]};
  const result=packGltf(gltf,new Map([['mesh.bin',Buffer.from([1,2,3])],['tex.jpg',Buffer.from([9,8,7,6,5])]]));
  assert.equal(result.readUInt32LE(0),0x46546c67);
  assert.equal(result.readUInt32LE(4),2);
  assert.equal(result.readUInt32LE(8),result.length);
  const json=JSON.parse(result.subarray(20,20+result.readUInt32LE(12)).toString());
  assert.equal(json.images[0].bufferView,1);
  assert.equal(json.images[0].mimeType,'image/jpeg');
  assert.equal(json.bufferViews[1].byteOffset,4);
  assert.equal(json.buffers[0].byteLength,12);
  assert.equal(result.length%4,0);
});
