import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { fetchVisualAssets } from '../src/asset-stream.js';

test('progress reports actual received bytes, not an animated estimate', async () => {
  const progress = [];
  const fetcher = async url => {
    if (String(url).endsWith('manifest.json')) return { ok: true, json: async () => [{ name: 'x.jpg', bytes: 5 }, { name: 'y.hdr', bytes: 3 }] };
    const bytes = String(url).endsWith('x.jpg') ? [1, 2, 3, 4, 5] : [6, 7, 8];
    return { ok: true, body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(bytes));controller.close(); } }) };
  };
  const result = await fetchVisualAssets('https://example.org/assets/manifest.json', { fetcher, onProgress: p => progress.push(p), concurrency: 2 });
  assert.equal(result.downloaded, 8);
  assert.equal(result.total, 8);
  assert.equal(result.errors.length, 0);
  assert.equal(result.files.size, 2);
  assert.equal(progress.at(-1).completed, 2);
  assert.equal(progress.at(-1).loaded, 8);
  assert.ok(progress.every(p => p.loaded <= p.total));
});
test('failed file stays visible as an error', async () => {
  const fetcher = async url => String(url).endsWith('manifest.json')
    ? { ok: true, json: async () => [{ name: 'x.jpg', bytes: 10 }] }
    : { ok: false, status: 404 };
  const result = await fetchVisualAssets('https://example.org/assets/manifest.json', { fetcher });
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /404/);
});
test('selecting a streaming phase excludes other files from its byte budget', async () => {
  const fetcher=async url=>String(url).endsWith('manifest.json')
    ? {ok:true,json:async()=>[{name:'core.jpg',bytes:2},{name:'detail.glb',bytes:8}]}
    : {ok:true,body:new ReadableStream({start(c){c.enqueue(new Uint8Array([1,2]));c.close();}})};
  const result=await fetchVisualAssets('https://example.org/assets/manifest.json',{fetcher,select:a=>a.name==='core.jpg'});
  assert.equal(result.total,2);
  assert.equal(result.files.size,1);
  assert.equal(result.errors.length,0);
});
