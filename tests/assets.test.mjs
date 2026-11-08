import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { assets } from '../tools/fetch-assets.mjs';

test('every bundled visual resource has a unique safe path and a trusted source', () => {
  const names = assets.map(a => a.name);
  assert.equal(new Set(names).size, names.length);
  assert.ok(assets.length >= 8);
  for (const asset of assets) {
    assert.match(asset.name, /^[a-z0-9-]+\.(jpg|hdr|glb)$/);
    assert.ok(asset.min >= 100_000);
    const url = new URL(asset.url);
    assert.equal(url.protocol, 'https:');
    assert.ok(['dl.polyhaven.org', 'raw.githubusercontent.com'].includes(url.hostname));
  }
});
